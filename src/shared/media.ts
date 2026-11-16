export type MediaKind = "image" | "video";
export type MediaItem = {
  id: string;
  filename: string;
  length: number;
  uploadedAt: string;
  kind: MediaKind;
  contentType: string;
  width: number;
  height: number;
};
export type MediaPage = {
  items: MediaItem[];
  page: number;
  limit: number;
  total: number;
};
