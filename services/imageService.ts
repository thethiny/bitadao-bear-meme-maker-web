export const sliceVideoIntoImages = async (
  videoFile: File,
  count: number
): Promise<{ file: File; timestamp: number }[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error("Could not create canvas context"));
      return;
    }

    const url = URL.createObjectURL(videoFile);
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const results: { file: File; timestamp: number }[] = [];

    video.onloadedmetadata = async () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const duration = video.duration;
      // Safety margin: don't go exactly to the end to avoid black frames or seek errors
      const safeDuration = Math.max(0, duration - 0.1); 
      const step = safeDuration / count;

      const captureFrame = async (index: number) => {
        if (index >= count) {
          URL.revokeObjectURL(url);
          resolve(results);
          return;
        }

        const time = index * step;
        video.currentTime = time;
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const timestamp = video.currentTime;
            const file = new File([blob], `frame_${results.length + 1}.jpg`, { type: 'image/jpeg' });
            results.push({ file, timestamp });
            captureFrame(results.length);
          } else {
            reject(new Error("Canvas to Blob failed"));
          }
        }, 'image/jpeg', 0.9);
      };

      video.onerror = (e) => reject(e);

      // Start capturing
      captureFrame(0);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video"));
    };
  });
};

export const captureFrame = async (
  videoFile: File,
  timestamp: number,
  fps: number
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error("Could not create canvas context"));
      return;
    }

    const url = URL.createObjectURL(videoFile);
    video.src = url;
    video.currentTime = timestamp;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    if (timestamp === 0) {
      video.currentTime = (1 / fps)/2; // must be smaller than 1/FPS
    }

    video.onloadeddata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };

    video.onseeked = () => {
      console.log(`Captured frame at ${timestamp}s`);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          const file = new File([blob], `frame_${Math.round(timestamp * 1000)}.jpg`, { type: 'image/jpeg' });
          resolve(file);
        } else {
          reject(new Error("Canvas to Blob failed"));
        }
      }, 'image/jpeg', 0.9);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video or seek"));
    };
  });
};
