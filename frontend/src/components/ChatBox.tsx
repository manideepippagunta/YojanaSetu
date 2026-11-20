import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  FileText,
  Sparkles,
  Paperclip,
  ClipboardCheck,
  FolderOpen,
  Globe,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { ChatMessage, Citation, LanguageCode, ModelMode, NavTab } from '../types';
import { streamChat, uploadSchemePdf } from '../api';
import ReactMarkdown from 'react-markdown';

const SPEECH_LANG_MAP: Record<LanguageCode, string> = {
  en: 'en-IN',
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
};

const LANG_LABELS: Record<LanguageCode, string> = {
  en: 'English',
  te: 'తెలుగు',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  kn: 'ಕನ್ನಡ',
};

const SAMPLE_QUESTIONS = [
  'I am a farmer, but my brother pays income tax. Can our family still get PM-KISAN?',
  'My grandfather is 72 years old with 6 lakh family income. Can he get Ayushman Bharat?',
  'What is the income limit and documents needed for National Scholarship Portal?',
];

interface ChatBoxProps {
  messages: ChatMessage[];
  onUpdateMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  modelMode: ModelMode;
  autoSpeak: boolean;
  onNavigate: (tab: NavTab) => void;
  userName: string;
}

export default function ChatBox({
  messages,
  onUpdateMessages,
  language,
  onChangeLanguage,
  modelMode,
  autoSpeak,
  onNavigate,
  userName,
}: ChatBoxProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/\[Source:.*?\]/g, ''));
    utterance.lang = SPEECH_LANG_MAP[language];
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (textOverride?: string) => {
    const query = (textOverride ?? input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };
    const botId = (Date.now() + 1).toString();
    const botMsg: ChatMessage = {
      id: botId,
      role: 'assistant',
      content: '',
      citations: [],
      statusText: 'Connecting to YojanaSetu...',
      isStreaming: true,
    };

    onUpdateMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
    setShowSamples(false);
    setLoading(true);

    let fullAnswer = '';

    try {
      await streamChat(query, language, modelMode, {
        onStatus: (statusMsg) => {
          onUpdateMessages((prev) =>
            prev.map((m) => (m.id === botId ? { ...m, statusText: statusMsg } : m))
          );
        },
        onCitations: (citations: Citation[]) => {
          onUpdateMessages((prev) =>
            prev.map((m) => (m.id === botId ? { ...m, citations } : m))
          );
        },
        onToken: (token) => {
          fullAnswer += token;
          onUpdateMessages((prev) =>
            prev.map((m) =>
              m.id === botId
                ? { ...m, content: m.content + token, statusText: undefined }
                : m
            )
          );
        },
        onError: (errMsg) => {
          onUpdateMessages((prev) =>
            prev.map((m) =>
              m.id === botId
                ? {
                    ...m,
                    content: `⚠️ ${errMsg}`,
                    statusText: undefined,
                    isStreaming: false,
                  }
                : m
            )
          );
        },
      });
    } catch (err: any) {
      onUpdateMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? {
                ...m,
                content: `⚠️ ${err?.message || 'Connection failed'}`,
                statusText: undefined,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      onUpdateMessages((prev) =>
        prev.map((m) => (m.id === botId ? { ...m, isStreaming: false, statusText: undefined } : m))
      );
      setLoading(false);
    }

    if (autoSpeak && fullAnswer) {
      speakText(fullAnswer);
    }
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input requires Chrome or Edge browser.');
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = SPEECH_LANG_MAP[language];
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const handleQuickPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadSchemePdf(file);
      onUpdateMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Uploaded and indexed **${res.filename}** (${res.chunks_added} knowledge chunks). You can ask me questions about it right now!`,
        },
      ]);
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const initials = (userName || 'C')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Scrollable Chat Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              How can YojanaSetu help today?
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Ask about government welfare schemes, eligibility rules, or required documents in{' '}
              <span className="font-semibold text-blue-600">{LANG_LABELS[language]}</span> — by typing or voice.
            </p>

            <div className="grid grid-cols-1 gap-2.5 w-full mt-6">
              {SAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-left text-sm bg-white/80 hover:bg-white border border-white/90 hover:border-blue-200 shadow-sm hover:shadow text-slate-700 px-4 py-3 rounded-2xl transition flex items-center justify-between gap-3 group"
                >
                  <span>{q}</span>
                  <Send className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 shrink-0 transition" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'assistant' ? (
              <div className="w-full max-w-[90%] space-y-2">
                {/* Modern Thinking Animation when waiting for first token */}
                {msg.isStreaming && !msg.content ? (
                  <div className="bg-white/75 backdrop-blur-md border border-white/90 rounded-2xl p-4 shadow-sm max-w-md space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 animate-pulse">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">
                          {msg.statusText || 'Thinking...'}
                        </span>
                        <span className="inline-flex items-center gap-1 pt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 thinking-dot-1" />
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 thinking-dot-2" />
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 thinking-dot-3" />
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2 pl-11">
                      <div className="h-2.5 w-3/4 rounded-full shimmer-bar" />
                      <div className="h-2.5 w-1/2 rounded-full shimmer-bar" />
                    </div>
                  </div>
                ) : (
                  <div className="text-[14.5px] leading-relaxed text-slate-800 px-1">
                    <ReactMarkdown
                      components={{
                        strong: ({ node, ...props }) => (
                          <strong className="font-semibold text-slate-900" {...props} />
                        ),
                        b: ({ node, ...props }) => (
                          <b className="font-semibold text-slate-900" {...props} />
                        ),
                        h1: ({ node, ...props }) => (
                          <h1 className="text-lg font-bold text-slate-900 mt-3 mb-1.5" {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                          <h2 className="text-base font-bold text-slate-900 mt-2.5 mb-1" {...props} />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3 className="text-sm font-bold text-slate-900 mt-2 mb-1" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul className="list-disc list-outside ml-4 my-2 space-y-1" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol className="list-decimal list-outside ml-4 my-2 space-y-1" {...props} />
                        ),
                        li: ({ node, ...props }) => (
                          <li className="pl-0.5 leading-relaxed" {...props} />
                        ),
                        p: ({ node, ...props }) => (
                          <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
                        ),
                        a: ({ node, ...props }) => (
                          <a
                            className="text-blue-600 hover:text-blue-700 underline font-medium"
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                          />
                        ),
                        code: ({ node, className, children, ...props }) => (
                          <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    {msg.isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-blue-500 rounded-sm animate-pulse align-middle" />
                    )}

                    {/* Citations + Actions Bar */}
                    {!msg.isStreaming && msg.content && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200/60">
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations?.map((c, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-white/85 border border-slate-200/80 text-slate-600 px-2.5 py-1 rounded-lg shadow-xs"
                            >
                              <FileText className="w-3 h-3 text-blue-500" />
                              {c.scheme} · p.{c.page}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => speakText(msg.content)}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 hover:bg-white/80 px-2.5 py-1 rounded-lg transition"
                            title="Listen in selected language"
                          >
                            <Volume2 className="w-3.5 h-3.5" /> Listen
                          </button>
                          <button
                            onClick={() => copyMessage(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 hover:bg-white/80 px-2.5 py-1 rounded-lg transition"
                            title="Copy answer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" /> Copy
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* User Bubble matching ChatEase white card + circular avatar on right */
              <div className="flex items-end gap-2.5 max-w-[82%]">
                <div className="bg-white/90 backdrop-blur-sm border border-white shadow-sm rounded-2xl rounded-br-md px-4 py-3 text-[14.5px] text-slate-800 leading-relaxed">
                  {msg.content}
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-sm">
                  {initials}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={scrollEndRef} />
      </div>

      {/* Optional Quick Prompts Popover */}
      {showSamples && (
        <div className="mx-5 mb-2 p-2.5 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-lg space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
            Try a sample civic question
          </p>
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="w-full text-left text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 px-2.5 py-2 rounded-xl transition"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Floating White Composer Dock matching ChatEase reference */}
      <div className="px-5 pb-5 pt-2">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-md shadow-slate-900/5 border border-white p-3 space-y-2.5">
          {/* Quick Action Pills Row (in place of Brainstorm / Web search / Code / More) */}
          <div className="flex flex-wrap items-center gap-2 px-1">
            <button
              onClick={() => onNavigate('eligibility')}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/70 px-3 py-1.5 rounded-full transition"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-amber-500" />
              Eligibility Checker
            </button>
            <button
              onClick={() => onNavigate('documents')}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/70 px-3 py-1.5 rounded-full transition"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
              Scheme Documents
            </button>
            <button
              onClick={() => setShowSamples((s) => !s)}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/70 px-3 py-1.5 rounded-full transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              Sample Prompts
            </button>

            <div className="inline-flex items-center gap-1 text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200/70 px-2.5 py-1 rounded-full ml-auto">
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <select
                value={language}
                onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="en">English</option>
                <option value="te">తెలుగు</option>
                <option value="hi">हिन्दी</option>
                <option value="ta">தமிழ்</option>
                <option value="kn">ಕನ್ನಡ</option>
              </select>
            </div>
          </div>

          {/* Input & Controls Row */}
          <div className="flex items-center gap-2 pl-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleQuickPdfUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition"
              title="Attach & index a government scheme PDF"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={toggleVoiceInput}
              className={`p-2 rounded-xl transition ${
                listening
                  ? 'bg-rose-50 text-rose-600 animate-pulse ring-2 ring-rose-200'
                  : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
              }`}
              title="Voice input"
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me something about schemes, rights, or documents..."
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none px-1 py-1.5"
            />

            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-blue-600 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-40 text-white flex items-center justify-center shadow-md shadow-blue-500/25 transition shrink-0"
              title="Send message"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
