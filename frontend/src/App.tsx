import React, { useState, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  ClipboardCheck,
  FolderOpen,
  User,
  Settings,
  Share2,
  Bookmark,
  Trash2,
  ArrowUpRight,
  Landmark,
  FileText,
  Check,
  LogOut,
} from 'lucide-react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import AuthScreen from './components/AuthScreen';
import {
  ChatMessage,
  ChatSession,
  CitizenProfile,
  EligibilityResponse,
  HealthStatus,
  LanguageCode,
  ModelMode,
  NavTab,
} from './types';
import { fetchHealth } from './api';
import ChatBox from './components/ChatBox';
import EligibilityForm from './components/EligibilityForm';
import DocumentManager from './components/DocumentManager';
import ProfileView from './components/ProfileView';
import SettingsView from './components/SettingsView';

const STORAGE_SESSIONS_KEY = 'yojanasetu_sessions_v2';
const STORAGE_PROFILE_KEY = 'yojanasetu_profile_v2';

const DEFAULT_PROFILE: CitizenProfile = {
  fullName: 'Citizen User',
  age: 21,
  income: 180000,
  state: 'Telangana',
  occupation: 'Student',
  category: 'OBC',
};

function createEmptySession(): ChatSession {
  return {
    id: Date.now().toString(),
    title: 'New Civic Conversation',
    preview: 'Ask about schemes, rights, or documents...',
    updatedAt: Date.now(),
    messages: [],
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('chat');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [modelMode, setModelMode] = useState<ModelMode>('fast');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityResponse | null>(null);

  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    try {
      return localStorage.getItem('yojanasetu_guest_v2') === 'true';
    } catch {
      return false;
    }
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [profile, setProfile] = useState<CitizenProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROFILE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SESSIONS_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return parsed.length > 0 ? parsed : [createEmptySession()];
    } catch {
      return [createEmptySession()];
    }
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || '');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        setProfile((prev) => ({
          ...prev,
          fullName: user.displayName || user.email?.split('@')[0] || prev.fullName,
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
    setIsGuest(false);
    try {
      localStorage.removeItem('yojanasetu_guest_v2');
    } catch {
      // ignore
    }
  };

  const handleContinueAsGuest = () => {
    setIsGuest(true);
    try {
      localStorage.setItem('yojanasetu_guest_v2', 'true');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
    } catch {
      // ignore storage quota errors
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile]);

  const checkBackend = async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }
  };

  useEffect(() => {
    checkBackend();
  }, []);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || createEmptySession();

  const handleUpdateMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        if (session.id !== activeSession.id) return session;
        const nextMessages = updater(session.messages);
        const firstUserMsg = nextMessages.find((m) => m.role === 'user')?.content;
        const lastMsg = nextMessages[nextMessages.length - 1]?.content;
        return {
          ...session,
          messages: nextMessages,
          title: firstUserMsg
            ? firstUserMsg.slice(0, 30) + (firstUserMsg.length > 30 ? '...' : '')
            : session.title,
          preview: lastMsg
            ? lastMsg.slice(0, 42) + (lastMsg.length > 42 ? '...' : '')
            : session.preview,
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleNewChat = () => {
    const fresh = createEmptySession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setActiveTab('chat');
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId);
      if (remaining.length === 0) {
        const fresh = createEmptySession();
        setActiveSessionId(fresh.id);
        setActiveTab('chat');
        return [fresh];
      }
      if (sessionId === activeSessionId) {
        const sorted = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt);
        setActiveSessionId(sorted[0].id);
        setActiveTab('chat');
      }
      return remaining;
    });
  };

  const handleDeleteHistory = () => {
    const fresh = createEmptySession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    setActiveTab('chat');
  };

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  const handleShareChat = () => {
    const transcript = activeSession.messages
      .map((m) => `${m.role === 'user' ? 'Citizen' : 'YojanaSetu'}: ${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(transcript || 'YojanaSetu — Multilingual Policy & Scheme Explainer');
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 1800);
  };

  const headerTitle: Record<NavTab, string> = {
    chat: activeSession.title,
    eligibility: 'Eligibility Checker',
    documents: 'Scheme Documents',
    profile: 'Citizen Profile',
    settings: 'Settings',
  };

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: 'Ask AI', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'eligibility', label: 'Eligibility Checker', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'documents', label: 'Scheme Documents', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#eef1f8] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authUser && !isGuest) {
    return <AuthScreen onContinueAsGuest={handleContinueAsGuest} />;
  }

  const effectiveUserName =
    authUser?.displayName ||
    authUser?.email?.split('@')[0] ||
    (isGuest ? `${profile.fullName} (Guest)` : profile.fullName);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#eef1f8] p-2.5 sm:p-3.5 flex">
      <div className="w-full h-full bg-white rounded-[28px] shadow-xl shadow-slate-900/5 border border-white/80 flex overflow-hidden">
        {/* LEFT SIDEBAR (Matches ChatEase reference) */}
        <aside className="w-[245px] shrink-0 bg-white border-r border-slate-100 flex flex-col justify-between p-3.5 h-full overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {/* Brand */}
            <div className="flex items-center gap-2.5 px-1.5 pt-1 shrink-0">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-sm">
                <Landmark className="w-4 h-4" />
              </div>
              <span className="font-bold text-[15px] tracking-tight text-slate-900">
                YojanaSetu
              </span>
            </div>

            {/* + New Chat */}
            <button
              onClick={handleNewChat}
              className="w-full shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl text-blue-600 hover:bg-blue-50 font-semibold text-sm transition border border-transparent hover:border-blue-100"
            >
              <Plus className="w-4 h-4" />
              New chat
            </button>

            {/* Recent Chats Section */}
            <div className="flex-1 min-h-0 flex flex-col pt-1">
              <div className="flex items-center justify-between px-2 pb-1.5 shrink-0">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Recent Chats
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {sortedSessions.length}
                </span>
              </div>
              <div className="flex-1 min-h-[60px] max-h-[175px] overflow-y-auto space-y-1 pr-1">
                {sortedSessions.map((s) => {
                  const isActive = s.id === activeSession.id && activeTab === 'chat';
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        setActiveTab('chat');
                      }}
                      className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                      title={s.title}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{s.title || 'New Chat'}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition shrink-0 ml-1"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Left Navigation Links */}
            <nav className="space-y-1 shrink-0 pt-2 border-t border-slate-100">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Blue Gradient Promo Card + Profile Footer */}
          <div className="space-y-3 shrink-0 pt-3">
            <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 space-y-3">
              <div>
                <h3 className="font-bold text-sm">Instant Eligibility</h3>
                <p className="text-[11.5px] text-blue-100 mt-1 leading-relaxed">
                  Match your profile against official central & state schemes in seconds.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('eligibility')}
                className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                Check now <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* User Profile & Sign Out Footer */}
            <div className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition group">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-2 truncate flex-1 text-left min-w-0"
                title="View Citizen Profile"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    health?.api_key_configured ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                <span className="truncate font-medium">{effectiveUserName}</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0 ml-1"
                title={authUser ? 'Sign out' : 'Exit Guest Mode'}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER MAIN PANEL (Soft pastel gradient canvas) */}
        <main className="flex-1 min-w-0 pastel-canvas flex flex-col">
          {/* Floating White Header Bar */}
          <div className="px-5 pt-4 pb-2 shrink-0">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-white shadow-sm px-4 py-2.5 flex items-center justify-between gap-3">
              <h1 className="text-base font-bold text-slate-800 truncate">
                {headerTitle[activeTab]}
              </h1>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleShareChat}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-slate-700 px-3 py-1.5 rounded-xl transition"
                >
                  {copiedShare ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-slate-600 transition"
                  title="Saved Scheme Documents"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Active Workspace Content (Chat state persists in App!) */}
          <div className="flex-1 min-h-0">
            {activeTab === 'chat' && (
              <ChatBox
                messages={activeSession.messages}
                onUpdateMessages={handleUpdateMessages}
                language={language}
                onChangeLanguage={setLanguage}
                modelMode={modelMode}
                autoSpeak={autoSpeak}
                onNavigate={setActiveTab}
                userName={effectiveUserName}
              />
            )}
            {activeTab === 'eligibility' && (
              <EligibilityForm
                language={language}
                profile={profile}
                savedResult={eligibilityResult}
                onSaveResult={setEligibilityResult}
              />
            )}
            {activeTab === 'documents' && <DocumentManager />}
            {activeTab === 'profile' && <ProfileView profile={profile} onSave={setProfile} />}
            {activeTab === 'settings' && (
              <SettingsView
                language={language}
                onChangeLanguage={setLanguage}
                modelMode={modelMode}
                onChangeModelMode={setModelMode}
                autoSpeak={autoSpeak}
                onToggleAutoSpeak={setAutoSpeak}
                health={health}
                onRefreshHealth={checkBackend}
              />
            )}
          </div>
        </main>

        {/* RIGHT SIDEBAR: HISTORY PANEL (Matches ChatEase reference) */}
        <aside className="hidden lg:flex w-[265px] shrink-0 bg-[#f8f9fc] border-l border-slate-100 flex-col justify-between p-4">
          <div className="flex flex-col min-h-0 flex-1">
            <h2 className="text-base font-bold text-slate-800 px-2 pb-3">History</h2>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {sortedSessions.map((s) => {
                const isSelected = s.id === activeSession.id && activeTab === 'chat';
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveSessionId(s.id);
                      setActiveTab('chat');
                    }}
                    className={`group w-full text-left p-2.5 rounded-2xl flex items-start justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? 'bg-white shadow-sm border border-slate-200/70'
                        : 'hover:bg-white/70'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{s.title}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{s.preview}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition shrink-0"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delete History Button */}
          <button
            onClick={handleDeleteHistory}
            className="mt-3 w-full bg-white hover:bg-rose-50 text-rose-500 border border-slate-200/70 hover:border-rose-200 py-2.5 px-4 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete all history
          </button>
        </aside>
      </div>
    </div>
  );
}
