export const MAX_VIDEO_BYTES = 10 * 1024 ** 3;
export const PART_SIZE = 16 * 1024 ** 2;
export const VIDEO_QUEUE = 'video-processing';
export type VideoStatus = 'draft' | 'processing' | 'ready' | 'error';
export interface VideoJob {
  version: 1;
  videoId: string;
}
