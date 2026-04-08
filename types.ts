
export enum AppTab {
  HOME = 'home',
  CHAT = 'chat',
  VISION = 'vision',
  CREATE = 'create',
  LIVE = 'live'
}

export interface Message {
  id: string;
  role: 'user' | 'myra';
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'audio';
  imageUrl?: string;
  sources?: Array<{ title: string; web: { uri: string } }>;
}

export interface ImageGeneration {
  id: string;
  prompt: string;
  url: string;
  timestamp: number;
}
