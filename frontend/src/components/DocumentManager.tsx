import React, { useEffect, useState } from 'react';
import { FileText, Upload, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { SchemeDocument } from '../types';
import { fetchSchemes, uploadSchemePdf } from '../api';

export default function DocumentManager() {
  const [docs, setDocs] = useState<SchemeDocument[]>([]);
  const [chunks, setChunks] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const data = await fetchSchemes();
      setDocs(data.documents);
      setChunks(data.total_chunks);
    } catch {
      setError('Cannot connect to backend on port 8000.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    setError('');
    try {
      const res = await uploadSchemePdf(file);
      setMessage(`Indexed ${res.filename} (${res.chunks_added} knowledge chunks added).`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-5 py-4 space-y-5">
      <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-sm border border-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Official Scheme Documents</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {docs.length} PDFs loaded · {chunks} indexed vector chunks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              title="Refresh list"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <label className="cursor-pointer bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 shadow-md shadow-blue-500/20 transition">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Indexing PDF...' : 'Upload Scheme PDF'}
              <input type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
            </label>
          </div>
        </div>

        {message && (
          <div className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-3 rounded-2xl">
            <CheckCircle2 className="w-4 h-4" /> {message}
          </div>
        )}

        {error && (
          <div className="text-sm bg-rose-50 text-rose-700 border border-rose-200 px-4 py-3 rounded-2xl">
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {docs.map((doc) => (
            <div
              key={doc.filename}
              className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-100 bg-slate-50/80 hover:bg-white hover:shadow-sm transition"
            >
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{doc.scheme}</p>
                <p className="text-xs text-slate-500 truncate">
                  {doc.filename} · {doc.size_kb} KB
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
