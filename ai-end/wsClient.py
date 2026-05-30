from typing import Any
import socketio
import hashlib
import hmac
import base64
import json
import cv2
import asyncio
from datetime import datetime


class WSClient:
    __SHA256KEY = "campus-surveillance-system".encode("utf-8")
    sio = socketio.AsyncClient(reconnection=False)
    wsServerUrl = None
    rtmpServerUrl = None

    connected = False
    ready = False

    async def onReady(self):
        pass

    username = None
    password = None
    cameraID = None

    rtspUrl = None
    alarmRules = None
    """
    @type alarmRule: [{
        'id': 1,
        'name': 'Test Rule',
        'enabled': True,
        'algorithmType':'body',
        'triggerDayOfWeek': [1, 2, 3, 4, 5],
        'triggerTimeStart': '09:00:00',
        'triggerTimeEnd': '18:00:00',
        'triggerCountMin': 0,
        'triggerCountMax': -1
        }]
    """

    alarmThrottle = {}
    """
    @type alarmThrottle: {
        [ alarmRuleID:str ]: datetime
    }
    """

    throttleTime = 60  # seconds

    context = {}

    def __init__(
        self,
        wsServerUrl: str,
        rtmpServerUrl: str,
        username: str,
        password: str,
        cameraID: str,
        onReady: Any,
        context: dict = {},
    ) -> None:
        self.wsServerUrl = wsServerUrl
        self.rtmpServerUrl = rtmpServerUrl
        self.username = username
        self.password = base64.b64encode(
            hmac.new(
                self.__SHA256KEY, password.encode("utf-8"), hashlib.sha256
            ).digest()
        ).decode("utf-8")
        self.cameraID = cameraID
        self.onReady = onReady
        self.context = context

        self.sio.on("cameraConfigChange", self.onCameraConfigChange)

        self.sio.on("connect", self.onConnect)
        self.sio.on("disconnect", self.onDisconnect)
        self.sio.on("connect_error", self.onConnectError)

        print(f"ws client for camera {cameraID} created")
        pass

    async def connect(self):
        if self.connected:
            return
        data = json.dumps(
            {
                "username": self.username,
                "password": self.password,
                "cameraID": self.cameraID,
            }
        )
        await self.sio.connect(
            self.wsServerUrl, socketio_path="/ws/ai/socket.io", headers={"data": data}
        )
        self.connected = True
        pass

    async def sendMessage(self, msg):
        await self.sio.emit("message", msg)
        print("message sent")
        pass

    def matchAlarmRule(self, data):
        """
        @type data: {
            'algorithmType': 'body',
            'count': 1,
            'predictResult': Any
        }
        """
        matchedRules = []
        if not self.ready:
            return matchedRules  # silently skip when disconnected
        if self.alarmRules is None:
            return matchedRules

        def _parse_time(t):
            """Parse time string, handling invalid values gracefully."""
            if not t or t in ("Invalid Date", "null", "None", "undefined"):
                return datetime.min.time()
            parts = str(t).split(":")
            if len(parts) == 2:
                t += ":00"
            try:
                return datetime.strptime(t, "%H:%M:%S").time()
            except (ValueError, TypeError):
                return datetime.min.time()

        for rule in self.alarmRules:
            if (
                rule["enabled"]
                and rule["algorithmType"] == data["algorithmType"]
                and (datetime.now().weekday() + 1) in rule["triggerDayOfWeek"]
                and datetime.now().time()
                >= _parse_time(rule["triggerTimeStart"])
                and datetime.now().time()
                <= _parse_time(rule["triggerTimeEnd"])
                and data["count"] >= rule["triggerCountMin"]
                and (
                    data["count"] <= rule["triggerCountMax"]
                    or rule["triggerCountMax"] == -1
                )
                and (
                    self.alarmThrottle.get(rule["id"]) is None
                    or (datetime.now() - self.alarmThrottle[rule["id"]]).seconds
                    > self.throttleTime
                )
            ):
                matchedRules.append(rule)
        return matchedRules

    async def trySendAlarm(self, data):
        """
        @type data: {
            'algorithmType': 'body',
            'count': 1,
            'predictResult': Any
        }
        """
        try:
            rules = self.matchAlarmRule(data)
            if not rules:
                return  # No matched rules, skip silently
                
            for rule in rules:
                try:
                    # Extract frame from predict result
                    frame_result = data.get("predictResult")
                    if not frame_result:
                        print(f"[Camera {self.cameraID}] No frame result available")
                        continue
                        
                    # Generate image with detections
                    import numpy as np
                    if hasattr(frame_result, 'plot') and callable(frame_result.plot):
                        plotted_img = frame_result.plot()
                    else:
                        # Fallback: create image from result
                        plotted_img = np.zeros((480, 640, 3), dtype=np.uint8)
                    
                    # Encode to base64
                    success, encoded_img = cv2.imencode(".jpg", plotted_img)
                    if not success:
                        print(f"[Camera {self.cameraID}] Failed to encode image")
                        continue
                        
                    base64_img = base64.b64encode(encoded_img).decode("utf-8")
                    
                    await self.sio.emit(
                        "alarm",
                        {
                            "alarmRuleID": rule["id"],
                            "picBase64": "data:image/jpg;base64," + base64_img,
                        },
                    )
                    self.alarmThrottle[rule["id"]] = datetime.now()
                    print(f"camera {self.cameraID} alarm sent: {rule['name']}")
                    
                except Exception as e:
                    print(f"[Camera {self.cameraID}] Error sending alarm for rule {rule.get('name', 'unknown')}: {e}")
                    continue
                    
        except Exception as e:
            print(f"[Camera {self.cameraID}] Critical error in trySendAlarm: {e}")
            # Don't re-raise to avoid breaking the detection loop

    async def disconnect(self):
        await self.sio.disconnect()
        pass

    async def onCameraConfigChange(self, data):
        if self.rtspUrl is not None and self.rtspUrl != data["rtspUrl"]:
            print(f"Camera {self.cameraID} rtsp url changed, disconnecting...")
            await self.disconnect()
            return

        self.rtspUrl = data["rtspUrl"]
        self.alarmRules = data["alarmRules"]
        print(f"Camera {self.cameraID} config updated")

        if self.connected and not self.ready:
            self.ready = True
            asyncio.get_event_loop().create_task(self.onReady(self))

        pass

    async def stayConnected(self):
        """Keep WebSocket connected with automatic reconnection."""
        while True:
            try:
                # Clean up previous connection
                if self.connected:
                    try:
                        await self.sio.disconnect()
                    except:
                        pass
                    self.connected = False
                    self.ready = False
                
                await self.connect()
                await self.sio.wait()  # Blocks until disconnect
            except Exception as e:
                print(f"[Camera {self.cameraID}] Connection error: {e}")
            
            self.connected = False
            self.ready = False
            print(f"[Camera {self.cameraID}] Disconnected, reconnecting in 5s...")
            await asyncio.sleep(5)

    def onConnect(self):
        print(f"connection for camera {self.cameraID} established")
        pass

    def onDisconnect(self):
        print(f"camera {self.cameraID} disconnected from server")
        self.connected = False
        self.ready = False
        pass

    def onConnectError(self, err):
        print(err)
        pass