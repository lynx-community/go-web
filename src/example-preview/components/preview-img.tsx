import { isVideo } from '../utils/example-data';

export const PreviewImg = ({ previewImage }: { previewImage: string }) => {
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
          muted
          loop
          playsInline
          autoPlay
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
