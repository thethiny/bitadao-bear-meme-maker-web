import { TimelineEntry } from '../types';

declare global {
  interface Window {
    FFmpeg: {
      createFFmpeg: (options: any) => any;
      fetchFile: (file: File | Blob | string) => Promise<Uint8Array>;
    };
  }
}

class FFmpegService {
  private ffmpeg: any = null;
  private loaded = false;
  private onLog: ((msg: string) => void) | null = null;

  async load() {
    if (this.loaded) return;

    if (!window.FFmpeg) {
      throw new Error("FFmpeg library failed to load. Please check your internet connection.");
    }

    const { createFFmpeg } = window.FFmpeg;
    // Add logger to capture ffmpeg output
    this.ffmpeg = createFFmpeg({
      log: true,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.8.5/dist/ffmpeg-core.js',
      logger: ({ type, message }) => {
        if (type === 'fferr' && this.onLog) {
          this.onLog(message);
        }
      },
    });

    await this.ffmpeg.load();
    this.loaded = true;
  }

  async createBitadaoVideo(
    images: { id: number; file: File }[],
    audioFile: File | null,
    timeline: TimelineEntry[],
    fps: number,
    onProgress: (progress: number, message: string) => void,
    onLog?: (msg: string) => void
  ): Promise<string> {
    if (!this.ffmpeg || !this.loaded) await this.load();
    const ffmpeg = this.ffmpeg;
    const { fetchFile } = window.FFmpeg;

  // Set log handler
  this.onLog = onLog || null;

    // 1. Write Images to Virtual FS
    onProgress(10, "Processing images...");
    for (const img of images) {
      const data = await fetchFile(img.file);
      ffmpeg.FS('writeFile', `image_${img.id}.png`, data);
    }

    // 2. Write Audio
    let audioInputArg: string[] = [];
    if (audioFile) {
      onProgress(20, "Processing audio...");
      const audioData = await fetchFile(audioFile);
      const ext = audioFile.name.split('.').pop() || 'mp3';
      ffmpeg.FS('writeFile', `audio.${ext}`, audioData);
      audioInputArg = ['-i', `audio.${ext}`];
    }

    // 3. Create Concat Demuxer List
    onProgress(30, "Building timeline...");
    let concatList = '';
    
    const secondsPerFrame = 1 / fps;

    for (const entry of timeline) {
      const hasImage = images.some(i => i.id === entry.imageId);
      if (hasImage) {
        concatList += `file image_${entry.imageId}.png\n`;
        concatList += `duration ${entry.frameCount * secondsPerFrame}\n`;
      }
    }

    // Fix for last frame quirk in concat demuxer
    if (timeline.length > 0) {
       const lastEntry = timeline[timeline.length - 1];
       if (images.some(i => i.id === lastEntry.imageId)) {
         concatList += `file image_${lastEntry.imageId}.png\n`;
       }
    }

    ffmpeg.FS('writeFile', 'list.txt', concatList);

    // 4. Run FFmpeg
    onProgress(50, "Rendering video... (may take a moment)");
    
    const args = [
  '-f', 'concat',
  '-safe', '0',
  '-i', 'list.txt',
  ...audioInputArg,
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-r', fps.toString(),
  ...(audioFile ? ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-shortest'] : []),
  '-preset', 'ultrafast',
  'output.mp4'
    ];

    await ffmpeg.run(...args);
  // Remove log handler after run
  this.onLog = null;

    onProgress(90, "Finalizing...");
    const data = ffmpeg.FS('readFile', 'output.mp4');
    
    // Cleanup
    try {
      ffmpeg.FS('unlink', 'list.txt');
      ffmpeg.FS('unlink', 'output.mp4');
      if (audioFile) {
        const ext = audioFile.name.split('.').pop() || 'mp3';
        ffmpeg.FS('unlink', `audio.${ext}`);
      }
      for (const img of images) {
        ffmpeg.FS('unlink', `image_${img.id}.png`);
      }
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }

    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    return URL.createObjectURL(blob);
  }
}

export const ffmpegService = new FFmpegService();
export const fps = 30;