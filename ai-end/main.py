from model import YOLOModel
from wsClient import WSClient
import asyncio
import multiprocessing
import os
import time
import requests
import base64
import hashlib
import hmac


def getAllCameraIDs(httpServerUrl, adminUsername, password):
    __SHA256KEY = "campus-surveillance-system".encode("utf-8")
    r = requests.get(
        httpServerUrl + "/api/ai/getAllCameraList",
        params={
            "adminUsername": adminUsername,
            "password": base64.b64encode(
                hmac.new(__SHA256KEY, password.encode("utf-8"), hashlib.sha256).digest()
            ).decode("utf-8"),
        },
    )
    res = r.json()
    if not res["success"]:
        raise Exception(res["message"])

    return [str(x["cameraID"]) for x in res.get("data", [])]


def ffmpegStreamToRtmpServer(streamUrl: str, rtmpUrl: str):
    print("exec ffmpeg...")
    extra = [
        "-err_detect", "ignore_err",
        "-fflags", "+discardcorrupt+genpts+igndts",
        "-max_delay", "5000000",
        "-reorder_queue_size", "10",
        "-analyzeduration", "5000000",
        "-probesize", "5000000",
    ]
    cmd = (
        ["/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error"]
        + extra
        + ["-rtsp_transport", "tcp", "-i", streamUrl,
           "-c:v", "libx264", "-preset:v", "ultrafast", "-tune:v", "zerolatency",
           "-g", "30", "-f:v", "flv", "-an", rtmpUrl]
    ) if streamUrl.startswith("rtsp") else (
        ["/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error"]
        + extra
        + ["-i", streamUrl,
           "-c:v", "libx264", "-preset:v", "ultrafast", "-tune:v", "zerolatency",
           "-g", "30", "-f:v", "flv", "-an", rtmpUrl]
    )
    os.execvp(cmd[0], cmd)


async def beginWork(ws: WSClient):
    rtmpUrl = ws.rtmpServerUrl + "/" + ws.cameraID
    detection_interval = float(ws.context.get("interval", 1))

    while True:
        ffmpegProcess = None
        model = None
        try:
            try:
                model = YOLOModel(device=ws.context.get("modelDevice", "cpu"))
            except Exception as e:
                print(f"[Camera {ws.cameraID}] YOLOModel init failed: {e}, retrying in 10s...")
                await asyncio.sleep(10)
                continue

            ffmpeg_started = False
            for attempt in range(5):
                try:
                    ffmpegProcess = multiprocessing.Process(
                        target=ffmpegStreamToRtmpServer, args=(ws.rtspUrl, rtmpUrl), daemon=True
                    )
                    ffmpegProcess.start()
                    ffmpeg_started = True
                    break
                except Exception as e:
                    wait = min(5 * (2 ** attempt), 60)
                    print(f"[Camera {ws.cameraID}] FFmpeg launch failed (attempt {attempt+1}/5): {e}, retrying in {wait}s...")
                    await asyncio.sleep(wait)

            if not ffmpeg_started:
                print(f"[Camera {ws.cameraID}] FFmpeg failed to start after 5 attempts, will retry...")
                if model:
                    del model
                await asyncio.sleep(30)
                continue

            print("Begin to detect video for camera " + ws.cameraID + ", streamUrl: " + ws.rtspUrl + "\n"
                  "If wait too long, please check if the stream url is correct.")

            try:
                results = model.detectVideo(ws.rtspUrl, classList=[0, 2])
                for frameResult in results:
                    if ffmpegProcess is not None and not ffmpegProcess.is_alive():
                        print(f"[Camera {ws.cameraID}] FFmpeg process died, waiting for restart...")
                        break

                    try:
                        await ws.trySendAlarm(
                            {"algorithmType": "body", "count": model.getResultClsCount(frameResult).get("person", 0), "predictResult": frameResult}
                        )
                        await ws.trySendAlarm(
                            {"algorithmType": "vehicle", "count": model.getResultClsCount(frameResult).get("car", 0), "predictResult": frameResult}
                        )
                    except Exception as e:
                        print(f"[Camera {ws.cameraID}] Alarm send failed: {e}")

                    await asyncio.sleep(detection_interval)

            except Exception as e:
                print(f"[Camera {ws.cameraID}] YOLO detection error: {e}, retrying in 5s...")
            finally:
                if ffmpegProcess is not None:
                    ffmpegProcess.kill()
                    ffmpegProcess.join(timeout=3)

        except Exception as e:
            print(f"[Camera {ws.cameraID}] Fatal error: {e}, retrying in 5s...")
        finally:
            if ffmpegProcess is not None:
                try:
                    ffmpegProcess.kill()
                except:
                    pass
            if model is not None:
                try:
                    del model
                except:
                    pass

        print(f"[Camera {ws.cameraID}] Restarting detection in 5s...")
        await asyncio.sleep(5)


def main(
    wsServerUrl="", rtmpServerUrl="", adminUsername="", password="",
    cameraID="", detectionInterval=0.5, modelDevice="cpu",
):
    asyncio.run(
        WSClient(
            wsServerUrl, rtmpServerUrl, adminUsername, password,
            str(cameraID), beginWork,
            {"interval": float(detectionInterval), "modelDevice": modelDevice},
        ).stayConnected()
    )


if __name__ == "__main__":
    multiprocessing.freeze_support()
    httpServerUrl = os.getenv("HTTP_SERVER_URL", "http://localhost")
    wsServerUrl = httpServerUrl
    rtmpServerUrl = os.getenv("RTMP_SERVER_URL", "rtmp://front-backend:1515/live")
    adminUsername = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD", "admin")

    RETRY_INTERVAL = 30
    cameraIDs = []

    while True:
        try:
            if os.getenv("CAMERA_IDS") is not None:
                cameraIDs = os.getenv("CAMERA_IDS").split(",")
                break

            cameraIDs = getAllCameraIDs(httpServerUrl, adminUsername, password)

            if not cameraIDs:
                print(f"No offline cameras found. Retrying in {RETRY_INTERVAL}s...")
                time.sleep(RETRY_INTERVAL)
                continue

            break
        except Exception as e:
            print(f"Error getting camera list: {e}. Retrying in {RETRY_INTERVAL}s...")
            time.sleep(RETRY_INTERVAL)

    print(f"Found {len(cameraIDs)} camera(s): {cameraIDs}")
    detectionInterval = float(os.getenv("DETECTION_INTERVAL", 0.5))
    modelDevice = os.getenv("MODEL_DEVICE", "cpu")
    processes = []

    for cameraID in cameraIDs:
        p = multiprocessing.Process(
            target=main,
            args=(wsServerUrl, rtmpServerUrl, adminUsername, password,
                  cameraID, detectionInterval, modelDevice),
        )
        p.start()
        processes.append(p)

    restart_backoff = {i: 5 for i in range(len(cameraIDs))}
    max_backoff = 300

    while True:
        for i, p in enumerate(processes):
            if not p.is_alive():
                cameraID = cameraIDs[i]
                wait = restart_backoff[i]
                print(f"[Camera {cameraID}] Process died (exit code: {p.exitcode}), restarting in {wait}s...")
                time.sleep(wait)
                restart_backoff[i] = min(wait * 2, max_backoff)

                p_new = multiprocessing.Process(
                    target=main,
                    args=(wsServerUrl, rtmpServerUrl, adminUsername, password,
                          cameraID, detectionInterval, modelDevice),
                )
                p_new.start()
                processes[i] = p_new
                print(f"[Camera {cameraID}] Process restarted (PID: {p_new.pid})")
                restart_backoff[i] = 5
        time.sleep(5)
