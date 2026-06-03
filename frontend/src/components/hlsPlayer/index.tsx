import { useRef, type FC, useEffect } from 'react';
import Styles from './index.module.less';
import constants from '@/constants';
import HLS from 'hls.js';

const HlsPlayer: FC<{
  item: {
    cameraName: string;
    cameraID: number;
    cameraStatus: string;
    hlsUrl: string;
  };
  className?: string;
}> = ({ item, className }) => {
  const videosRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const videoRef = videosRef.current;
    if (videoRef && item.cameraStatus !== constants.cameraStatus.OFFLINE) {
      if (videoRef.canPlayType('application/vnd.apple.mpegurl').length > 0) {
        // Native HLS (e.g. Safari) — just set src
        videoRef.src = item.hlsUrl;
      } else if (HLS.isSupported()) {
        const hlsPlayer = new HLS(constants.HLS_LOWLATENCY_OPTION);
        hlsPlayer.loadSource(item.hlsUrl);
        hlsPlayer.attachMedia(videoRef);

        // ---- Error recovery ----
        let fatalRetryTimer: ReturnType<typeof setTimeout> | null = null;

        hlsPlayer.on(HLS.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            // Fatal error: attempt recovery based on error type
            switch (data.type) {
              case HLS.ErrorTypes.NETWORK_ERROR:
                // Network issue — try to recover by re-starting the load
                console.warn(
                  `[HLS] Camera ${item.cameraID}: fatal network error, recovering...`,
                );
                hlsPlayer.startLoad();
                break;

              case HLS.ErrorTypes.MEDIA_ERROR:
                // Media decode error — swap codecs / buffers
                console.warn(
                  `[HLS] Camera ${item.cameraID}: fatal media error, recovering...`,
                );
                hlsPlayer.recoverMediaError();
                break;

              default:
                // Unrecoverable — destroy and recreate after a short delay
                console.error(
                  `[HLS] Camera ${item.cameraID}: unrecoverable error (${data.type}), reloading in 5s...`,
                );
                hlsPlayer.destroy();
                if (fatalRetryTimer) clearTimeout(fatalRetryTimer);
                fatalRetryTimer = setTimeout(() => {
                  const newPlayer = new HLS(constants.HLS_LOWLATENCY_OPTION);
                  newPlayer.loadSource(item.hlsUrl);
                  newPlayer.attachMedia(videoRef);
                }, 5000);
                break;
            }
          } else {
            // Non-fatal — HLS.js handles these internally; just log
            console.warn(
              `[HLS] Camera ${item.cameraID}: non-fatal error`,
              data.type,
              data.details,
            );
          }
        });

        return () => {
          if (fatalRetryTimer) clearTimeout(fatalRetryTimer);
          hlsPlayer.detachMedia();
          hlsPlayer.destroy();
        };
      } else {
        videoRef.innerText = '您的浏览器不支持查看摄像头视频';
      }
    }
  }, [item.hlsUrl, item.cameraStatus]);

  return (
    <video
      key={item.cameraID}
      className={className ? className + ' ' + Styles.player : Styles.player}
      controls
      muted
      autoPlay={item.cameraStatus !== constants.cameraStatus.OFFLINE}
      ref={videosRef}
    />
  );
};

export default HlsPlayer;
