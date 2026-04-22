import { useEffect, useRef } from 'react';
import { isVideo } from '../utils/example-data';

export const PreviewImg = ({
  previewImage,
  active,
}: {
  previewImage: string;
  active: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pause video when inactive to save CPU/battery, play when active
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (active) {
      video.play().catch(() => {
        /* ignore play interruptions */
      });
    } else {
      video.pause();
    }
  }, [active]);

  return (
    <div
      style={{
        minHeight: '0px',
        display: 'flex',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isVideo(previewImage) ? (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay={active}
          preload="auto"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        >
          <source src={previewImage} />
        </video>
      ) : (
        <img
          src={previewImage}
          alt=""
          loading="eager"
          decoding="async"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      )}
    </div>
  );
};
