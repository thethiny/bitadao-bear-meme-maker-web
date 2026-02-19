// timelineService.ts
import { TimelineEntry } from '../types';

/**
 * Parses timeline text and returns total frame count.
 */
export function countTimelineFrames(timelineText: string): number {
  return parseTimeline(timelineText).reduce((sum, entry) => sum + entry.frameCount, 0);
}

/**
 * Parses timeline text into TimelineEntry[]
 */
export function parseTimeline(text: string): TimelineEntry[] {
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const idStr = parts[0];
        const countStr = parts[1];
        const idMatch = idStr.match(/^(\d+)/);
        const id = idMatch ? parseInt(idMatch[1], 10) : 1;
        const count = parseInt(countStr, 10);
        return { imageId: id, frameCount: isNaN(count) ? 1 : count };
      }
      return null;
    })
    .filter((entry): entry is TimelineEntry => entry !== null);
}

/**
 * Calculates duration in seconds given frame count and fps
 */
export function framesToSeconds(frameCount: number, fps: number): number {
  return frameCount / fps;
}

/**
 * Estimates VRAM/RAM usage for a video resolution and frame count
 * Formula: width * height * 4 bytes * frameCount / (1024*1024) = MB
 */
export function estimateMemoryUsage(width: number, height: number, frameCount: number): number {
  return Math.round((width * height * 4 * frameCount) / (1024 * 1024));
}
