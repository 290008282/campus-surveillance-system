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
    // Reduced from 3→2 to lower live latency
    liveSyncDurationCount: 2,
    // Tighter max-latency window so the player catches up quickly
    liveMaxLatencyDurationCount: 6,
    liveDurationInfinity: true,
    // Shorter watchdog for faster stall detection
    highBufferWatchdogPeriod: 1,
    // Enable low-latency mode for better live responsiveness
    lowLatencyMode: true,
    // Back buffer: keep 4s worth; drop older segments to free memory
    backBufferLength: 4,
    // Max total buffer: 8s, prevents excessive buffering / stalls
    maxBufferLength: 8,
    maxMaxBufferLength: 16,
  },
};
