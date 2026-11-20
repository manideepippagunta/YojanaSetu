import React, { useState } from 'react';
import { User, Save, CheckCircle2 } from 'lucide-react';
import { CitizenProfile } from '../types';

interface Props {
  profile: CitizenProfile;
  onSave: (p: CitizenProfile) => void;
}

export default function ProfileView({ profile, onSave }: Props) {
  const [form, setForm] = useState<CitizenProfile>(profile);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white/90 backdrop-blur-md rounded-3xl shadow-sm border border-white p-6 max-w-2xl space-y-5"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Citizen Profile</h2>
            <p className="text-xs text-slate-500">
              Saved locally in your browser. Auto-fills the Eligibility Checker for instant results.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Age</label>
            <input
              type="number"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Annual Household Income (₹)
            </label>
            <input
              type="number"
              value={form.income}
              onChange={(e) => setForm({ ...form, income: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">State</label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Occupation</label>
            <select
              value={form.occupation}
              onChange={(e) => setForm({ ...form, occupation: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm"
            >
              <option>Student</option>
              <option>Farmer</option>
              <option>Daily Wage Worker</option>
              <option>Small Business Owner</option>
              <option>Senior Citizen</option>
              <option>Unemployed</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Category / Ration Card
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm"
            >
              <option>General</option>
              <option>OBC</option>
              <option>SC / ST</option>
              <option>BPL / Antyodaya Ration Card</option>
              <option>EWS</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 shadow-md shadow-blue-500/20 transition"
          >
            <Save className="w-4 h-4" /> Save Profile
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Profile saved!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
