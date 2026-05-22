from model import YOLOModel
from wsClient import WSClient
import asyncio
import multiprocessing
import os
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
    )
    res = r.json()
    if not res["success"]:
        raise Exception(res["message"])

    return list(map(lambda x: x["cameraID"], res["data"]))


def ffmpegStreamToRtmpServer(streamUrl: str, rtmpUrl: str, max_retries=5, retry_interval=3):
    import subprocess, time as _time
    print("exec ffmpeg...")
    cmd = [
        "/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error",
        "-fflags", "nobuffer", "-flags", "low_delay",
        "-rtsp_transport", "tcp", "-stimeout", "5000000",
        "-i", streamUrl,
        "-c:v", "libx264", "-preset:v", "ultrafast", "-tune:v", "zerolatency",
        "-g", "15", "-keyint_min", "15", "-sc_threshold", "0",
        "-b:v", "1000k", "-maxrate", "1500k", "-bufsize", "2000k",
        "-f", "flv", "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
        "-c:a", "copy", rtmpUrl
    ] if streamUrl.startswith("rtsp") else [
        "/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error",
        "-fflags", "nobuffer", "-flags", "low_delay",
        "-i", streamUrl,
        "-c:v", "libx264", "-preset:v", "ultrafast", "-tune:v", "zerolatency",
        "-g", "15", "-keyint_min", "15", "-sc_threshold", "0",
        "-b:v", "1000k", "-maxrate", "1500k", "-bufsize", "2000k",
        "-f", "flv", "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
        "-c:a", "copy", rtmpUrl
    ]
    for attempt in range(max_retries):
        try:
            os.execvp(cmd[0], cmd)
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"ffmpeg attempt {attempt + 1}/{max_retries} failed ({e}), retrying in {retry_interval}s...")
                _time.sleep(retry_interval)
            else:
                raise


async def beginWork(ws: WSClient):
    rtmpUrl = ws.rtmpServerUrl + "/" + ws.cameraID
    ffmpegProcess = multiprocessing.Process(
        target=ffmpegStreamToRtmpServer, args=(ws.rtspUrl, rtmpUrl), daemon=True
    )
    try:
        model = YOLOModel(device=ws.context.get("modelDevice", "cpu"))
        ffmpegProcess.start()
        print(
            f"Begin to detect video for camera {ws.cameraID}, streamUrl: {ws.rtspUrl} \nIf wait too long, please check if the stream url is correct."
        )
        results = model.detectVideo(ws.rtspUrl, classList=[0, 2])
        for frameResult in results:
            clsCount = model.getResultClsCount(frameResult)
            await ws.trySendAlarm(
                {"algorithmType": "body", "count": clsCount.get("person", 0), "predictResult": frameResult}
            )
            await ws.trySendAlarm(
                {"algorithmType": "vehicle", "count": clsCount.get("car", 0), "predictResult": frameResult}
            )
            if not ffmpegProcess.is_alive():
                print(f"ffmpeg process for camera {ws.cameraID} is dead")
                break
            await asyncio.sleep(float(ws.context.get("interval", 1)))
    finally:
        ffmpegProcess.kill()
        await ws.disconnect()
        print("error, kill ffmpeg process")


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
    # FIX: pass base URL only; socketio_path in wsClient.py handles the rest
    wsServerUrl = httpServerUrl
    rtmpServerUrl = os.getenv("RTMP_SERVER_URL", "rtmp://localhost:1515/live")
    adminUsername = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD", "admin")
    cameraIDs = []
    if os.getenv("CAMERA_IDS") is not None:
        cameraIDs = os.getenv("CAMERA_IDS").split(",")
    else:
        cameraIDs = getOfflineCameraIDs(httpServerUrl, adminUsername, password)
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
    for p in processes:
        p.join()