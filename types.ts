
export const AudienceType = {
  FACILITATOR: '促进型',
  EXPLORER: '探索者',
  PROFESSIONAL: '专业研究者',
  INSPIRATION: '灵感寻求者',
  EXPERIENCE: '体验追寻者'
} as const;

export type AudienceTypeValue = typeof AudienceType[keyof typeof AudienceType];

export interface QuizQuestion {
  id: number;
  question: string;
  options: {
    label: string;
    type: AudienceTypeValue;
  }[];
}

export interface QuizResult {
  id: string;
  sessionId: string;
  selectedType: AudienceTypeValue;
  optionLabel: string;
  timestamp: number;
}

export interface Relic {
  id: string;
  title: string;
  dynasty: string;
  author: string;
  imageUrl: string;
  description: string;
  dimensions?: string;
  medium?: string;
  collection?: string;
}

export interface NarrativeVersion {
  type: AudienceTypeValue;
  audioUrl: string;
  content: string;
}

export interface Evaluation {
  id: string;
  sessionId: string;
  relicId: string;
  audienceType: AudienceTypeValue;
  matchingScore: number; // 5: 完全符合, 4: 比较符合, 3: 一般符合, 2: 比较不符合, 1: 完全不符合
  satisfactionScore: number; // 1-5
  recommendationScore: number; // 1: 是, 0: 否
  feedback: string;
  timestamp: number;
}

export interface PlaybackEvent {
  id: string;
  sessionId: string;
  relicId: string;
  narrativeType: AudienceTypeValue;
  isCompleted: boolean;
  timestamp: number;
}

export interface VisitorSession {
  sessionId: string;
  type: AudienceTypeValue | null;
  startedAt: number;
}
