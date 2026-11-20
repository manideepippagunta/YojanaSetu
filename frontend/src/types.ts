export type LanguageCode = 'en' | 'te' | 'hi' | 'ta' | 'kn';
export type NavTab = 'chat' | 'eligibility' | 'documents' | 'profile' | 'settings';
export type ModelMode = 'fast' | 'deep';

export interface Citation {
  source: string;
  scheme: string;
  page: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  statusText?: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface CitizenProfile {
  fullName: string;
  age: number;
  income: number;
  state: string;
  occupation: string;
  category: string;
}

export interface EligibilityMatch {
  scheme_name: string;
  status: 'Eligible' | 'Likely Eligible' | 'Not Eligible';
  benefit: string;
  reason: string;
  required_documents: string[];
  citation: string;
}

export interface EligibilityResponse {
  summary: string;
  matches: EligibilityMatch[];
}

export interface SchemeDocument {
  filename: string;
  scheme: string;
  size_kb: number;
}

export interface HealthStatus {
  status: string;
  api_key_configured: boolean;
  indexed_chunks: number;
  documents: number;
  default_model: string;
}
