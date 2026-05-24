export default {
  userRole: { ADMIN: 'admin', USER: 'user' },
  cameraStatus: { NORMAL: 'normal', OFFLINE: 'offline', ALARM: 'alarm' },
  alarmRuleAlgorithmType: {
    BODY: 'body',
    VEHICLE: 'vehicle',
  },
  SHA256KEY: 'campus-surveillance-system',
  // FETCH_ROOT: 'http://surveillance.crazyher.cn',
  FETCH_ROOT: '',
  HLS_LOWLATENCY_OPTION: {
    enableWorker: true,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 10,
    liveDurationInfinity: true,
    highBufferWatchdogPeriod: 2,
    lowLatencyMode: false,
  },
};
