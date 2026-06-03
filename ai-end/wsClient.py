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

    # Reconnect control
    _reconnect_interval = 5   # seconds between reconnect attempts
    _max_reconnect_wait = 60  # max back-off ceiling in seconds
    _stop_reconnect = False   # set to True to stop reconnect loop permanently

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

        # Re-create sio instance per WSClient so handlers are isolated
        self.sio = socketio.AsyncClient(reconnection=False, logger=False, engineio_logger=False)

        self.sio.on("cameraConfigChange", self.onCameraConfigChange)
        self.sio.on("connect", self.onConnect)
        self.sio.on("disconnect", self.onDisconnect)
        self.sio.on("connect_error", self.onConnectError)

        print(f"ws client for camera {cameraID} created")

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

    async def sendMessage(self, msg):
        await self.sio.emit("message", msg)
        print("message sent")

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
        rules = self.matchAlarmRule(data)
        for rule in rules:
            await self.sio.emit(
                "alarm",
                {
                    "alarmRuleID": rule["id"],
                    "picBase64": "data:image/jpg;base64,"
                    + base64.b64encode(
                        cv2.imencode(".jpg", data["predictResult"].plot())[1]
                    ).decode("utf-8"),
                },
            )
            self.alarmThrottle[rule["id"]] = datetime.now()
            print(f"camera {self.cameraID} alarm sent: {rule['name']}")

    async def disconnect(self):
        self._stop_reconnect = True
        await self.sio.disconnect()

    async def onCameraConfigChange(self, data):
        if self.rtspUrl is not None and self.rtspUrl != data["rtspUrl"]:
            print(f"Camera {self.cameraID} rtsp url changed, reconnecting...")
            # Update rtspUrl first so onReady() uses the new URL after reconnect
            self.rtspUrl = data["rtspUrl"]
            self.alarmRules = data["alarmRules"]
            # Trigger disconnect; stayConnected loop will reconnect automatically
            self.ready = False
            await self.sio.disconnect()
            return

        self.rtspUrl = data["rtspUrl"]
        self.alarmRules = data["alarmRules"]
        print(f"Camera {self.cameraID} config updated")

        if self.connected and not self.ready:
            self.ready = True
            asyncio.get_event_loop().create_task(self.onReady(self))

    async def stayConnected(self):
        """
        Keep trying to connect, and reconnect whenever disconnected.
        Uses exponential back-off up to _max_reconnect_wait seconds.
        """
        wait = self._reconnect_interval
        while not self._stop_reconnect:
            try:
                if not self.connected:
                    print(f"Camera {self.cameraID}: connecting to server...")
                    await self.connect()
                    wait = self._reconnect_interval  # reset back-off on success
                # While connected, just wait for events
                await self.sio.wait()
            except Exception as e:
                print(f"Camera {self.cameraID}: connection error: {e}")

            if self._stop_reconnect:
                break

            self.connected = False
            self.ready = False
            print(f"Camera {self.cameraID}: disconnected. Reconnecting in {wait}s...")
            await asyncio.sleep(wait)
            # Exponential back-off
            wait = min(wait * 2, self._max_reconnect_wait)

        print(f"Camera {self.cameraID}: stayConnected loop exited.")

    def onConnect(self):
        print(f"connection for camera {self.cameraID} established")

    def onDisconnect(self):
        print(f"camera {self.cameraID} disconnected from server")
        self.connected = False
        self.ready = False

    def onConnectError(self, err):
        print(f"camera {self.cameraID} connect error: {err}")
        self.connected = False
