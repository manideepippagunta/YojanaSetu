import React from 'react';
import { Globe, Volume2, Zap, Activity, RefreshCw } from 'lucide-react';
import { HealthStatus, LanguageCode, ModelMode } from '../types';

interface Props {
  language: LanguageCode;
  onChangeLanguage: (l: LanguageCode) => void;
  modelMode: ModelMode;
  onChangeModelMode: (m: ModelMode) => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: (v: boolean) => void;
  health: HealthStatus | null;
  onRefreshHealth: () => void;
}

export default function SettingsView({
  language,
  onChangeLanguage,
  modelMode,
  onChangeModelMode,
  autoSpeak,
  onToggleAutoSpeak,
  health,
  onRefreshHealth,
}: Props) {
  return (
    <div className="h-full overflow-y-auto px-5 py-4 space-y-4 max-w-2xl">
      <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-sm border border-white p-6 space-y-6">
        <h2 className="text-lg font-bold text-slate-800">App Settings</h2>

        {/* Language */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Response & Voice Language</p>
              <p className="text-xs text-slate-500">Applies to AI answers, eligibility cards, and speech.</p>
            </div>
          </div>
          <select
            value={language}
            onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700"
          >
            <option value="en">English</option>
            <option value="te">తెలుగు (Telugu)</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="kn">ಕನ್ನಡ (Kannada)</option>
          </select>
        </div>

        {/* Speed Mode / Model Selection */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">AI Model & Speed Mode</p>
              <p className="text-xs text-slate-500">
                Fast uses gemini-3.5-flash-lite (~1s). Deep uses gemini-3.6-flash.
              </p>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => onChangeModelMode('fast')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                modelMode === 'fast' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
              }`}
              title="gemini-3.5-flash-lite"
            >
              Fast (3.5-flash-lite)
            </button>
            <button
              onClick={() => onChangeModelMode('deep')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                modelMode === 'deep' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
              }`}
              title="gemini-3.6-flash"
            >
              Deep (3.6-flash)
            </button>
          </div>
        </div>

        {/* Auto-Speak */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Auto-Read AI Answers</p>
              <p className="text-xs text-slate-500">Automatically speak responses aloud when finished.</p>
            </div>
          </div>
          <button
            onClick={() => onToggleAutoSpeak(!autoSpeak)}
            className={`w-11 h-6 rounded-full transition relative ${
              autoSpeak ? 'bg-blue-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                autoSpeak ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Backend Health */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Backend Connection</p>
                <p className="text-xs text-slate-500">FastAPI + ChromaDB RAG Engine</p>
              </div>
            </div>
            <button
              onClick={onRefreshHealth}
              className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Check
            </button>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-1.5 border border-slate-100">
            {health ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Backend Online ({health.default_model})
                </p>
                <p className="text-slate-600">
                  API Key Configured:{' '}
                  <span className={health.api_key_configured ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                    {health.api_key_configured ? 'Yes' : 'No (Check backend/.env)'}
                  </span>
                </p>
                <p className="text-slate-600">
                  Loaded PDFs: <strong>{health.documents}</strong> · Indexed Chunks:{' '}
                  <strong>{health.indexed_chunks}</strong>
                </p>
              </>
            ) : (
              <p className="flex items-center gap-2 font-semibold text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Backend Offline — Run <code>uvicorn app.main:app --reload --port 8000</code> in backend/
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
