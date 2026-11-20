import {
  Citation,
  EligibilityResponse,
  HealthStatus,
  LanguageCode,
  ModelMode,
  SchemeDocument,
} from './types';

const API_BASE = ((import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '') as string).replace(/\/$/, '');

export async function fetchHealth(timeoutMs: number = 6000): Promise<HealthStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Backend offline (HTTP ${res.status})`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Backend health check timed out. Is FastAPI running on port 8001?');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function streamChat(
  query: string,
  language: LanguageCode,
  mode: ModelMode,
  callbacks: {
    onStatus: (msg: string) => void;
    onToken: (token: string) => void;
    onCitations: (citations: Citation[]) => void;
    onError: (msg: string) => void;
  }
) {
  const controller = new AbortController();
  // 15 second initial connection timeout
  const connectTimer = setTimeout(() => {
    controller.abort();
  }, 15000);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, language, mode }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(connectTimer);
    if (err.name === 'AbortError') {
      callbacks.onError(
        'Connection timed out after 15s. The backend server on port 8001 did not respond in time.'
      );
    } else {
      callbacks.onError(
        'Cannot reach the backend server. Make sure FastAPI is running on port 8001 (uvicorn app.main:app --reload --port 8001).'
      );
    }
    return;
  } finally {
    clearTimeout(connectTimer);
  }

  if (!response.ok || !response.body) {
    callbacks.onError(`Backend returned HTTP ${response.status}. Check your FastAPI terminal for details.`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Normalize CRLF to LF so splitting on \n\n always matches
      const normalized = buffer.replace(/\r\n/g, '\n');
      const lines = normalized.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        for (const subline of trimmed.split('\n')) {
          const l = subline.trim();
          if (!l.startsWith('data: ')) continue;
          const jsonStr = l.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'status') {
              callbacks.onStatus(event.message || 'Thinking...');
            } else if (event.type === 'citations') {
              callbacks.onCitations(event.citations || []);
            } else if (event.type === 'token') {
              callbacks.onToken(event.text || '');
            } else if (event.type === 'error') {
              callbacks.onError(event.message || 'Unknown backend error');
            }
          } catch {
            // Ignore incomplete chunks
          }
        }
      }
    }
  } catch (err: any) {
    callbacks.onError(`Stream interrupted: ${err.message || 'connection dropped'}`);
  }
}

export async function checkEligibility(payload: {
  age: number;
  income: number;
  state: string;
  occupation: string;
  category: string;
  language: LanguageCode;
}): Promise<EligibilityResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`${API_BASE}/api/eligibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Eligibility check failed (HTTP ${res.status}). Is FastAPI running?`);
    }
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Eligibility request timed out after 25s.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSchemes(): Promise<{ documents: SchemeDocument[]; total_chunks: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE}/api/schemes`, { signal: controller.signal });
    if (!res.ok) throw new Error('Failed to load schemes');
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadSchemePdf(file: File): Promise<{ filename: string; chunks_added: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Upload timed out after 45s.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
