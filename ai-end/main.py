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


__SHA256KEY = "campus-surveillance-system".encode("utf-8")


def aiLogin(httpServerUrl, adminUsername, password):
    """Login to backend and get JWT token using HMAC-hashed password."""
    hashed_pw = base64.b64encode(
        hmac.new(__SHA256KEY, password.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8")
    r = requests.post(
        httpServerUrl + "/api/user/login",
        json={"username": adminUsername, "password": hashed_pw},
    )
    res = r.json()
    if not res.get("success", False):
        raise Exception("Login failed: " + res.get("message", "unknown error"))
    return res["data"]["token"]


def getAllCameraIDs(httpServerUrl, adminUsername, password, token=None):
    """Get all camera IDs. Supports JWT Bearer token or legacy HMAC auth."""
    headers = {}
    params = {}

    if token:
        headers["Authorization"] = "Bearer " + token
    else:
        params = {
            "adminUsername": adminUsername,
            "password": base64.b64encode(
                hmac.new(__SHA256KEY, password.encode("utf-8"), hashlib.sha256).digest()
            ).decode("utf-8"),
        }

    r = requests.get(
        httpServerUrl + "/api/ai/getAllCameraList",
        params=params,
        headers=headers,
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
    token="",
):
    asyncio.run(
        WSClient(
            wsServerUrl, rtmpServerUrl, adminUsername, password,
            str(cameraID), beginWork,
            {"interval": float(detectionInterval), "modelDevice": modelDevice},
            token=token,
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
    CAMERA_SYNC_INTERVAL = 10  # seconds between camera list syncs (was 60)

    token = None
    cameraIDs = []

    # Step 1: Login and get JWT token
    while True:
        try:
            if os.getenv("CAMERA_IDS") is not None:
                cameraIDs = os.getenv("CAMERA_IDS").split(",")
                break

            token = aiLogin(httpServerUrl, adminUsername, password)
            print("JWT token obtained successfully")
            break
        except Exception as e:
            print(f"Error logging in: {e}. Retrying in {RETRY_INTERVAL}s...")
            time.sleep(RETRY_INTERVAL)

    # Step 2: Get camera list using token
    while True:
        try:
            if cameraIDs:
                break

            cameraIDs = getAllCameraIDs(httpServerUrl, adminUsername, password, token=token)

            if not cameraIDs:
                print(f"No cameras found. Retrying in {RETRY_INTERVAL}s...")
                time.sleep(RETRY_INTERVAL)
                continue

            break
        except Exception as e:
            # If token expired, re-login
            if "Unauthorized" in str(e) or "401" in str(e):
                try:
                    print("Token may have expired, re-logging in...")
                    token = aiLogin(httpServerUrl, adminUsername, password)
                    print("Re-login successful")
                    continue
                except Exception as le:
                    print(f"Re-login failed: {le}")
            print(f"Error getting camera list: {e}. Retrying in {RETRY_INTERVAL}s...")
            time.sleep(RETRY_INTERVAL)

    print(f"Found {len(cameraIDs)} camera(s): {cameraIDs}")
    detectionInterval = float(os.getenv("DETECTION_INTERVAL", 0.5))
    modelDevice = os.getenv("MODEL_DEVICE", "cpu")

    # cameraIDs -> processes mapping
    processes = {}  # cameraID -> Process

    def start_camera(cid):
        p = multiprocessing.Process(
            target=main,
            args=(wsServerUrl, rtmpServerUrl, adminUsername, password,
                  cid, detectionInterval, modelDevice, token),
        )
        p.start()
        return p

    # Start initial cameras
    for cameraID in cameraIDs:
        processes[cameraID] = start_camera(cameraID)

    # Track restart backoff per camera
    restart_backoff = {}
    max_backoff = 300

    # Periodic camera list sync timer
    last_sync = time.time()

    while True:
        # --- Monitor existing processes ---
        for cid, p in list(processes.items()):
            if not p.is_alive():
                wait = restart_backoff.get(cid, 5)
                print(f"[Camera {cid}] Process died (exit code: {p.exitcode}), restarting in {wait}s...")
                time.sleep(wait)
                restart_backoff[cid] = min(wait * 2, max_backoff)

                p_new = start_camera(cid)
                processes[cid] = p_new
                print(f"[Camera {cid}] Process restarted (PID: {p_new.pid})")
                restart_backoff[cid] = 5

        # --- Periodic camera list sync ---
        if os.getenv("CAMERA_IDS") is None and time.time() - last_sync >= CAMERA_SYNC_INTERVAL:
            last_sync = time.time()
            try:
                latest = getAllCameraIDs(httpServerUrl, adminUsername, password, token=token)
                latest_set = set(latest)
                current_set = set(processes.keys())

                # Detect new cameras
                new_cameras = latest_set - current_set
                if new_cameras:
                    print(f"[Camera Sync] New camera(s) detected: {new_cameras}, starting...")
                    for cid in new_cameras:
                        processes[cid] = start_camera(cid)
                        print(f"[Camera {cid}] Started (PID: {processes[cid].pid})")

                # Note: removed cameras are kept running (will fail gracefully)
                # to avoid disrupting active streams on accidental DB changes
            except Exception as e:
                # If token expired, re-login
                if "Unauthorized" in str(e) or "401" in str(e):
                    try:
                        print("Token expired during sync, re-logging in...")
                        token = aiLogin(httpServerUrl, adminUsername, password)
                        print("Re-login successful")
                    except Exception as le:
                        print(f"Re-login failed: {le}")
                else:
                    print(f"[Camera Sync] Error fetching camera list: {e}")

        time.sleep(5)
