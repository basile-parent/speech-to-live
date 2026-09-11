export type RecognitionModelInfo = {
  id: string;
  title: string;
  description: string;
  sizeBytes: number;
  downloaded: boolean;
  bundled: boolean;
  selected: boolean;
};

export function formatModelSize(sizeBytes: number): string {
  const megaBytes = sizeBytes / (1024 * 1024);
  if (megaBytes >= 100) {
    return `${Math.round(megaBytes)} Mo`;
  }
  return `${megaBytes.toFixed(1).replace(/\.0$/, '')} Mo`;
}
