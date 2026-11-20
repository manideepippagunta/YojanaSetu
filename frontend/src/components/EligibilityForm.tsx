import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, XCircle, Loader2, FileCheck, Sparkles } from 'lucide-react';
import { CitizenProfile, EligibilityResponse, LanguageCode } from '../types';
import { checkEligibility } from '../api';

interface Props {
  language: LanguageCode;
  profile: CitizenProfile;
  savedResult: EligibilityResponse | null;
  onSaveResult: (res: EligibilityResponse) => void;
}

export default function EligibilityForm({ language, profile, savedResult, onSaveResult }: Props) {
  const [age, setAge] = useState(profile.age);
  const [income, setIncome] = useState(profile.income);
  const [state, setState] = useState(profile.state);
  const [occupation, setOccupation] = useState(profile.occupation);
  const [category, setCategory] = useState(profile.category);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setAge(profile.age);
    setIncome(profile.income);
    setState(profile.state);
    setOccupation(profile.occupation);
    setCategory(profile.category);
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await checkEligibility({
        age,
        income,
        state,
        occupation,
        category,
        language,
      });
      onSaveResult(data);
    } catch (err: any) {
      setError(err.message || 'Could not check eligibility');
    } finally {
      setLoading(false);
    }
  };

  const badgeStyle = (status: string) => {
    if (status === 'Eligible') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Likely Eligible') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="h-full overflow-y-auto px-5 py-4 space-y-5">
      <form
        onSubmit={handleSubmit}
        className="bg-white/90 backdrop-blur-md rounded-3xl shadow-sm border border-white p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Scheme Eligibility Checker</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pre-filled from your Citizen Profile. Adjust any field to match against official PDFs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Annual Household Income (₹)
            </label>
            <input
              type="number"
              value={income}
              onChange={(e) => setIncome(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Occupation</label>
            <select
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Student</option>
              <option>Farmer</option>
              <option>Daily Wage Worker</option>
              <option>Small Business Owner</option>
              <option>Senior Citizen</option>
              <option>Unemployed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Category / Ration Card
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>General</option>
              <option>OBC</option>
              <option>SC / ST</option>
              <option>BPL / Antyodaya Ration Card</option>
              <option>EWS</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
              {loading ? 'Analyzing Schemes...' : 'Check Eligibility'}
            </button>
          </div>
        </div>
      </form>

      {loading && (
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center animate-pulse">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              Comparing your profile against indexed government PDFs...
            </p>
            <div className="h-2.5 w-2/3 rounded-full shimmer-bar" />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-sm">
          ⚠️ {error}
        </div>
      )}

      {savedResult && !loading && (
        <div className="space-y-4 pb-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 text-slate-800 px-5 py-4 rounded-2xl text-sm font-medium">
            {savedResult.summary}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedResult.matches.map((m, idx) => (
              <div
                key={idx}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-sm border border-white p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-800">{m.scheme_name}</h3>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${badgeStyle(
                      m.status
                    )}`}
                  >
                    {m.status === 'Eligible' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {m.status === 'Likely Eligible' && <AlertCircle className="w-3.5 h-3.5" />}
                    {m.status === 'Not Eligible' && <XCircle className="w-3.5 h-3.5" />}
                    {m.status}
                  </span>
                </div>
                <p className="text-sm text-blue-700 font-semibold">{m.benefit}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{m.reason}</p>
                {m.required_documents?.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Required Documents
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.required_documents.map((doc, i) => (
                        <span
                          key={i}
                          className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg"
                        >
                          {doc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">Source: {m.citation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
