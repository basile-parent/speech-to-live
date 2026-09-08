export type FinalTranscriptSegment = {
  text: string;
  speakerLabel?: string | null;
};

export type TranscriptBlock =
  | {
      type: 'segment';
      id: string;
      text: string;
      speakerLabel?: string | null;
    }
  | {
      /** Marks the start of a fresh view; history stays above with no gap. */
      type: 'break';
      id: string;
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
