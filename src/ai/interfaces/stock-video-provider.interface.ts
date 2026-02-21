export interface StockVideoClip {
  /** S3 blob ID after download+upload */
  blobId: string;
  /** Scene index this clip belongs to */
  sceneIndex: number;
  /** Whether this is a fallback AI image (not a stock video) */
  isFallback?: boolean;
}

export interface StockVideoSceneInput {
  sceneIndex: number;
  query: string;
}

export interface IStockVideoProvider {
  fetchClipsForScenes(scenes: StockVideoSceneInput[]): Promise<StockVideoClip[]>;
}
