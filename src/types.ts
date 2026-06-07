
export interface Speaker {
  id: string;
  name: string;
}

export interface SpeakerGroup {
    country: string;
    speakers: Speaker[];
}

export interface ChunkJob {
  id: string;
  text: string;
  status: 'pending' | 'processing' | 'finished' | 'error';
  audioUrl?: string;
  error?: string | null;
  timestamp?: string;
  startTime?: number;
  endTime?: number;
}

export type ProcessingState = 'idle' | 'processing';

export interface Voice {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  SuggestedCodec: string;
  FriendlyName: string;
  Status: string;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
