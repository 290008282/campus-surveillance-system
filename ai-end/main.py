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


def getOfflineCameraIDs(httpServerUrl, adminUsername, password):
    __SHA256KEY = "campus-surveillance-system".encode("utf-8")
    r = requests.get(
        httpServerUrl + "/api/ai/getOfflineCameraList",
        params={
            "adminUsername": adminUsername,
            "password": base64.b64encode(
                hmac.new(__SHA256KEY, password.encode("utf-8"), hashlib.sha256).digest()
            ).decode("utf-8"),
        },
        timeout=15,
    )
    res = r.json()
    if not res["success"]:
        raise Exception(res["message"])

    return list(map(lambda x: x["cameraID"], res["data"]))


def ffmpegStreamToRtmpServer(streamUrl: str, rtmpUrl: str):
    print("exec ffmpeg...")
    cmd = [
        "/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error",
        "-rtsp_transport", "tcp", "-i", streamUrl,
        "-c:v", "libx264", "-preset:v", "ultrafast", "-tune:v", "zerolatency",
        "-g", "30", "-f:v", "flv", "-an", rtmpUrl
    ] if streamUrl.startswith("rtsp") else [
        "/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error",
        "-i", streamUrl,
        "-c:v", "libx264", "-preset:v", "ultrafast", "-tune:v", "zerolatency",
        "-g", "30", "-f:v", "flv", "-an", rtmpUrl
    ]
    os.execvp(cmd[0], cmd)


async def beginWork(ws: WSClient):
    rtmpUrl = ws.rtmpServerUrl + "/" + ws.cameraID
    detection_interval = float(ws.context.get("interval", 1))

    while True:
        ffmpegProcess = None
        model = None
        try:
            model = YOLOModel(device=ws.context.get("modelDevice", "cpu"))
            ffmpegProcess = multiprocessing.Process(
                target=ffmpegStreamToRtmpServer, args=(ws.rtspUrl, rtmpUrl), daemon=True
            )
            ffmpegProcess.start()
            print(
                f"Begin to detect video for camera {ws.cameraID}, streamUrl: {ws.rtspUrl}\n"
                f"If wait too long, please check if the stream url is correct."
            )

            try:
                results = model.detectVideo(ws.rtspUrl, classList=[0, 2])
                for frameResult in results:
                    # If ws disconnected/rtspUrl changed, stop current detection loop
                    if not ws.ready:
                        print(f"Camera {ws.cameraID}: ws not ready, stopping detection loop...")
                        break

                    # Check ffmpeg is still alive before processing each frame
                    if ffmpegProcess is not None and not ffmpegProcess.is_alive():
                        print(f"ffmpeg process for camera {ws.cameraID} is dead, waiting for restart...")
                        break

                    try:
                        await ws.trySendAlarm(
                            {"algorithmType": "body", "count": model.getResultClsCount(frameResult).get("person", 0), "predictResult": frameResult}
                        )
                        await ws.trySendAlarm(
                            {"algorithmType": "vehicle", "count": model.getResultClsCount(frameResult).get("car", 0), "predictResult": frameResult}
                        )
                    except Exception as e:
                        print(f"Warning: alarm send failed for camera {ws.cameraID}: {e}")

                    await asyncio.sleep(detection_interval)

            except Exception as e:
                print(f"YOLO detection error for camera {ws.cameraID}: {e}, retrying in 5s...")
            finally:
                if ffmpegProcess is not None:
                    ffmpegProcess.kill()
                    ffmpegProcess.join(timeout=3)

        except Exception as e:
            print(f"Fatal error for camera {ws.cameraID}: {e}, retrying in 5s...")
        finally:
            if ffmpegProcess is not None:
                try:
                    ffmpegProcess.kill()
                except Exception:
                    pass
            if model is not None:
                try:
                    del model
                except Exception:
                    pass

        # Wait until ws is ready again before retrying (handles reconnect / rtspUrl change)
        print(f"Restarting detection for camera {ws.cameraID} in 5s...")
        await asyncio.sleep(5)
        if not ws.ready:
            print(f"Camera {ws.cameraID}: waiting for ws to become ready...")
            while not ws.ready:
                await asyncio.sleep(2)
            print(f"Camera {ws.cameraID}: ws is ready, restarting detection.")


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


def start_camera_process(wsServerUrl, rtmpServerUrl, adminUsername, password,
                          cameraID, detectionInterval, modelDevice):
    """Create and start a new subprocess for the given cameraID."""
    p = multiprocessing.Process(
        target=main,
        args=(wsServerUrl, rtmpServerUrl, adminUsername, password,
              cameraID, detectionInterval, modelDevice),
        daemon=False,
    )
    p.start()
    print(f"Started process PID={p.pid} for camera {cameraID}")
    return p


if __name__ == "__main__":
    multiprocessing.freeze_support()
    httpServerUrl = os.getenv("HTTP_SERVER_URL", "http://localhost")
    wsServerUrl = httpServerUrl
    rtmpServerUrl = os.getenv("RTMP_SERVER_URL", "rtmp://front-backend:1515/live")
    adminUsername = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD", "admin")
    detectionInterval = float(os.getenv("DETECTION_INTERVAL", 0.5))
    modelDevice = os.getenv("MODEL_DEVICE", "cpu")

    # How often (seconds) to poll for newly-added cameras
    POLL_INTERVAL = int(os.getenv("CAMERA_POLL_INTERVAL", 30))
    RETRY_INTERVAL = 30

    # ---- Initial camera list ----
    cameraIDs = []

    if os.getenv("CAMERA_IDS") is not None:
        cameraIDs = [c.strip() for c in os.getenv("CAMERA_IDS").split(",") if c.strip()]
        print(f"Using CAMERA_IDS env: {cameraIDs}")
    else:
        while True:
            try:
                cameraIDs = [str(c) for c in getOfflineCameraIDs(httpServerUrl, adminUsername, password)]
                if not cameraIDs:
                    print(f"No offline cameras found. Retrying in {RETRY_INTERVAL}s...")
                    time.sleep(RETRY_INTERVAL)
                    continue
                break
            except Exception as e:
                print(f"Error getting camera list: {e}. Retrying in {RETRY_INTERVAL}s...")
                time.sleep(RETRY_INTERVAL)

    print(f"Found {len(cameraIDs)} camera(s): {cameraIDs}")

    # Map: cameraID (str) -> Process
    processes: dict[str, multiprocessing.Process] = {}
    for cameraID in cameraIDs:
        processes[str(cameraID)] = start_camera_process(
            wsServerUrl, rtmpServerUrl, adminUsername, password,
            cameraID, detectionInterval, modelDevice
        )

    # ---- Main supervisor loop ----
    # Periodically:
    #   1. Restart dead processes (crash recovery)
    #   2. Poll for newly-added cameras (hot-add support)
    while True:
        time.sleep(POLL_INTERVAL)

        # 1. Restart dead processes
        for cid, p in list(processes.items()):
            if not p.is_alive():
                print(f"Process for camera {cid} died (exit={p.exitcode}), restarting...")
                processes[cid] = start_camera_process(
                    wsServerUrl, rtmpServerUrl, adminUsername, password,
                    cid, detectionInterval, modelDevice
                )

        # 2. Poll for new cameras (skip if CAMERA_IDS env is set)
        if os.getenv("CAMERA_IDS") is not None:
            continue

        try:
            latest_ids = [str(c) for c in getOfflineCameraIDs(httpServerUrl, adminUsername, password)]
        except Exception as e:
            print(f"Warning: failed to poll camera list: {e}")
            continue

        new_ids = set(latest_ids) - set(processes.keys())
        if new_ids:
            print(f"Detected new camera(s): {new_ids}. Starting processes...")
            for cid in new_ids:
                processes[cid] = start_camera_process(
                    wsServerUrl, rtmpServerUrl, adminUsername, password,
                    cid, detectionInterval, modelDevice
                )
