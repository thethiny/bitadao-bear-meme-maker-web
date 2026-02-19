export interface TimelineEntry {
    imageId: number; // Parsed from string "1_empty" -> 1
    frameCount: number;
}

export type ImageSlot = {
    id: number;
    file: File | null;
    previewUrl: string | null;
    sourceVideo?: File | null;
    timestamp?: number;
};
