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
import threading
from concurrent.futures import ThreadPoolExecutor


def getAllCameraIDs(httpServerUrl, adminUsername, password):
    hmacKey = os.getenv("HMAC_KEY", "campus-surveillance-system").encode("utf-8")
    r = requests.get(
        httpServerUrl + "/api/ai/getAllCameraList",
        params={
            "adminUsername": adminUsername,
            "password": base64.b64encode(
                hmac.new(hmacKey, password.encode("utf-8"), hashlib.sha256).digest()
            ).decode("utf-8"),
        },
        timeout=30,
    )
    res = r.json()
    if not res["success"]:
        raise Exception(res["message"])
    return [str(x["cameraID"]) for x in res.get("data", [])]


def ffmpegStreamToRtmpServer(streamUrl, rtmpUrl):
    """Transcode RTSP to RTMP - optimized for Celeron J1900."""
    print(f"[FFmpeg] exec: {streamUrl} -> {rtmpUrl}")
    cmd = [
        "/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error",
        "-fflags", "nobuffer", "-flags", "low_delay",
        "-rtsp_transport", "tcp", "-i", streamUrl,
        "-c:v", "libx264", "-preset:v", "ultrafast", "-tune:v", "zerolatency",
        "-profile:v", "baseline", "-level", "3.1",
        "-r", "15", "-g", "30",
        "-b:v", "800k", "-maxrate", "1200k", "-bufsize", "1500k",
        "-threads", "1",
        "-f:v", "flv", "-an", rtmpUrl
    ] if streamUrl.startswith("rtsp") else [
        "/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error",
        "-i", streamUrl,
        "-c:v", "libx264", "-preset:v", "ultrafast", "-tune:v", "zerolatency",
        "-profile:v", "baseline", "-level", "3.1",
        "-r", "15", "-g", "30",
        "-b:v", "800k", "-maxrate", "1200k", "-bufsize", "1500k",
        "-threads", "1",
        "-f:v", "flv", "-an", rtmpUrl
    ]
    os.execvp(cmd[0], cmd)


def _detection_worker_lowfreq(ws, model, ffmpegProcess, detection_interval, loop, stop_event):
    """Low-frequency YOLO detection: open RTSP, grab 1 frame, detect, close, sleep.
    
    This avoids keeping the RTSP stream open continuously, which saves CPU
    because OpenCV doesn't need to decode H.265 frames we won't process.
    """
    import cv2
    
    try:
        while not stop_event.is_set():
            if ffmpegProcess is not None and not ffmpegProcess.is_alive():
                print(f"[Camera {ws.cameraID}] FFmpeg died, stopping detection")
                break
            
            # Open RTSP, grab ONE frame, then close
            cap = None
            frame = None
            try:
                cap = cv2.VideoCapture(ws.rtspUrl, cv2.CAP_FFMPEG)
                # RTMP (H.264) is much faster to decode than RTSP (H.265)
                cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
                cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
                
                # Read a few frames to get a fresh one (skip initial keyframe issues)
                for _ in range(1):
                    ret, frame = cap.read()
                    if not ret:
                        break
                
                if cap is not None:
                    cap.release()
                cap = None
            except Exception as e:
                print(f"[Camera {ws.cameraID}] Frame grab error: {e}")
                if cap is not None:
                    try:
                        cap.release()
                    except:
                        pass
                cap = None
            
            if frame is not None:
                try:
                    # Run YOLO on single frame
                    # Use model.detectImage for correct YOLO API
                    # Resize frame to reduce YOLO preprocessing overhead
                    frame = cv2.resize(frame, (320, 320))
                    result = model.detectImage(frame, classList=[0, 2], imgsz=320)
                    cls_counts = model.getResultClsCount(result)
                    person_count = cls_counts.get("person", 0)
                    car_count = cls_counts.get("car", 0)

                    asyncio.run_coroutine_threadsafe(
                        ws.trySendAlarm({
                            "algorithmType": "body",
                            "count": person_count,
                            "predictResult": result,
                        }),
                        loop,
                    )
                    asyncio.run_coroutine_threadsafe(
                        ws.trySendAlarm({
                            "algorithmType": "vehicle",
                            "count": car_count,
                            "predictResult": result,
                        }),
                        loop,
                    )
                except Exception as e:
                    print(f"[Camera {ws.cameraID}] Detection error: {e}")
            
            # Sleep between detections (saves CPU)
            for _ in range(int(detection_interval * 10)):
                if stop_event.is_set():
                    break
                time.sleep(0.1)
    
    except Exception as e:
        print(f"[Camera {ws.cameraID}] Detection worker error: {e}")
    finally:
        stop_event.set()


async def beginWork(ws):
    rtmpUrl = ws.rtmpServerUrl + "/" + ws.cameraID
    # Min 3 seconds between detections to save CPU on weak hardware
    detection_interval = max(15.0, float(ws.context.get("interval", 1)))
    loop = asyncio.get_event_loop()

    while True:
        ffmpegProcess = None
        model = None
        stop_event = threading.Event()
        try:
            # Initialize YOLO model
            try:
                model = YOLOModel(device=ws.context.get("modelDevice", "cpu"))
            except Exception as e:
                print(f"[Camera {ws.cameraID}] YOLO init failed: {e}, retrying in 10s...")
                await asyncio.sleep(10)
                continue

            # Start FFmpeg transcode
            ffmpeg_started = False
            for attempt in range(5):
                try:
                    ffmpegProcess = multiprocessing.Process(
                        target=ffmpegStreamToRtmpServer,
                        args=(ws.rtspUrl, rtmpUrl),
                        daemon=True,
                    )
                    ffmpegProcess.start()
                    ffmpeg_started = True
                    break
                except Exception as e:
                    wait = min(5 * (2 ** attempt), 60)
                    print(f"[Camera {ws.cameraID}] FFmpeg launch failed (attempt {attempt+1}/5): {e}")
                    await asyncio.sleep(wait)

            if not ffmpeg_started:
                if model:
                    del model
                await asyncio.sleep(30)
                continue

            await asyncio.sleep(2)
            print(f"[Camera {ws.cameraID}] FFmpeg: {ws.rtspUrl} -> {rtmpUrl}")
            ws.rtmpUrl = rtmpUrl  # Store for detection worker
            print(f"[Camera {ws.cameraID}] Detection: low-freq mode ({detection_interval}s interval)")

            # Run low-frequency detection in separate thread
            executor = ThreadPoolExecutor(max_workers=1)
            try:
                future = loop.run_in_executor(
                    executor,
                    _detection_worker_lowfreq,
                    ws, model, ffmpegProcess, detection_interval, loop, stop_event,
                )
                while not stop_event.is_set():
                    await asyncio.sleep(0.5)
                await future
            finally:
                executor.shutdown(wait=False)

        except Exception as e:
            print(f"[Camera {ws.cameraID}] Fatal error: {e}, retrying in 5s...")
        finally:
            stop_event.set()
            if ffmpegProcess is not None:
                try:
                    if ffmpegProcess.is_alive():
                        ffmpegProcess.terminate()
                        try:
                            ffmpegProcess.join(timeout=5)
                        except:
                            pass
                        if ffmpegProcess.is_alive():
                            ffmpegProcess.kill()
                            ffmpegProcess.join(timeout=3)
                except:
                    pass
            if model is not None:
                try:
                    del model
                except:
                    pass

        print(f"[Camera {ws.cameraID}] Restarting in 8s...")
        await asyncio.sleep(8)


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
    CAMERA_SYNC_INTERVAL = 60

    cameraIDs = []
    while True:
        try:
            if os.getenv("CAMERA_IDS") is not None:
                cameraIDs = os.getenv("CAMERA_IDS").split(",")
                break
            cameraIDs = getAllCameraIDs(httpServerUrl, adminUsername, password)
            if not cameraIDs:
                print(f"No cameras found. Retrying...")
                time.sleep(RETRY_INTERVAL)
                continue
            break
        except Exception as e:
            print(f"Error getting camera list: {e}")
            time.sleep(RETRY_INTERVAL)

    print(f"Found {len(cameraIDs)} camera(s): {cameraIDs}")
    detectionInterval = float(os.getenv("DETECTION_INTERVAL", "0.5"))
    modelDevice = os.getenv("MODEL_DEVICE", "cpu")

    processes = {}

    def start_camera(cid):
        p = multiprocessing.Process(
            target=main,
            args=(wsServerUrl, rtmpServerUrl, adminUsername, password,
                  cid, detectionInterval, modelDevice),
        )
        p.start()
        return p

    for cameraID in cameraIDs:
        processes[cameraID] = start_camera(cameraID)

    restart_backoff = {}
    max_backoff = 300
    last_sync = time.time()

    while True:
        for cid, p in list(processes.items()):
            if not p.is_alive():
                try:
                    p.join(timeout=3)
                except:
                    pass
                wait = restart_backoff.get(cid, 5)
                print(f"[Camera {cid}] Died, restarting in {wait}s...")
                time.sleep(wait)
                restart_backoff[cid] = min(wait * 2, max_backoff)
                p_new = start_camera(cid)
                processes[cid] = p_new
                restart_backoff[cid] = 5

        if os.getenv("CAMERA_IDS") is None and time.time() - last_sync >= CAMERA_SYNC_INTERVAL:
            last_sync = time.time()
            try:
                latest = getAllCameraIDs(httpServerUrl, adminUsername, password)
                latest_set = set(latest)
                current_set = set(processes.keys())
                new_cameras = latest_set - current_set
                if new_cameras:
                    for cid in new_cameras:
                        processes[cid] = start_camera(cid)
                removed_cameras = current_set - latest_set
                if removed_cameras:
                    for cid in removed_cameras:
                        p = processes.get(cid)
                        if p and p.is_alive():
                            p.terminate()
                            try:
                                p.join(timeout=5)
                            except:
                                pass
                            if p.is_alive():
                                p.kill()
                        del processes[cid]
                        restart_backoff.pop(cid, None)
            except Exception as e:
                print(f"[Camera Sync] Error: {e}")

        time.sleep(5)
