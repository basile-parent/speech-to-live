export type TranscriptEvent =
  | {
      type: 'partial';
      text: string;
    }
  | {
      type: 'final';
      text: string;
    }
  | {
      type: 'audioLevel';
      level: number;
    }
  | {
      type: 'error';
      message: string;
    };
