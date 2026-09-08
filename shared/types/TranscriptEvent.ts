export type FinalTranscriptSegment = {
  text: string;
  speakerLabel?: string | null;
};

export type TranscriptEvent =
  | {
      type: 'partial';
      text: string;
    }
  | {
      type: 'final';
      text: string;
      speakerLabel?: string | null;
    }
  | {
      type: 'audioLevel';
      level: number;
    }
  | {
      type: 'error';
      message: string;
    };
