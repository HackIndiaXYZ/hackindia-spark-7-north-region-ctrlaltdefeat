import { useState } from 'react';
import { useStore } from './store/index.js';
import { useTranscription } from './hooks/useTranscription.js';
import TranscriptPanel from './components/transcription/TranscriptPanel.jsx';
import NotesPanel from './components/notes/NotesPanel.jsx';
import QuizPanel from './components/quiz/QuizPanel.jsx';
import ChatPanel from './components/chat/ChatPanel.jsx';
import ReteachPanel from './components/reteach/ReteachPanel.jsx';
import TokenBudget from './components/dashboard/TokenBudget.jsx';
import DebugBar from './components/dashboard/DebugBar.jsx';

const PANELS = [
  { id: 'transcript', label: 'Transcript', icon: '🎙', short: 'Live'    },
  { id: 'notes',      label: 'Notes',      icon: '📝', short: 'Notes'   },
  { id: 'quiz',       label: 'Quiz',       icon: '❓', short: 'Quiz'    },
  { id: 'chat',       label: 'Chat',       icon: '💬', short: 'Chat'    },
  { id: 'reteach',    label: 'Re-Teach',   icon: '🔁', short: 'Learn'   },
];

export default function App() {
  const {
    activePanel, setActivePanel,
    isRecording, isConnected,
    words, quizQueue,
    resetSession, recordingError, setRecordingError, browserMode,
  } = useStore();

  const { startRecording, stopRecording } = useTranscription();
  const [starting, setStarting] = useState(false);

  async function handleToggleRecording() {
    if (isRecording) { stopRecording(); return; }
    setRecordingError('');
    setStarting(true);
    try {
      await startRecording();
    } catch (err) {
      setRecordingError(
        err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow access and try again.'
          : 'Could not access microphone: ' + err.message
      );
    } finally {
      setStarting(false);
    }
  }

  const badges = { quiz: quizQueue.length, chat: 0 };

  return (
    <div style={S.root}>
      <header style={S.topBar}>
        <div style={S.brand}>
          <div style={S.brandLogo}>
            <span style={S.brandLogoInner}>E</span>
          </div>
          <div style={S.brandText}>
            <span style={S.brandName}>EduScript</span>
            <span style={S.brandTag}>AI</span>
          </div>
          <span style={S.teamTag}>by CtrlAltDefeat</span>
        </div>

        <div style={S.centerRow}>
          <TokenBudget />
          {isRecording && (
            <div style={S.connPill}>
              <span style={{ ...S.connDot, background: isConnected ? 'var(--green)' : 'var(--amber)', boxShadow: `0 0 8px ${isConnected ? 'var(--green-glow)' : 'rgba(247,183,49,0.4)'}` }} />
              <span style={S.connText}>{isConnected ? 'Connected' : 'Reconnecting'}</span>
            </div>
          )}
          {browserMode && isRecording && (
            <span style={S.enginePill}>{browserMode}</span>
          )}
        </div>

        <div style={S.rightRow}>
          <div style={S.wordCount}>
            <span style={S.wordNum}>{words.length}</span>
            <span style={S.wordLabel}>words</span>
          </div>
          <button
            onClick={handleToggleRecording}
            style={{ ...S.recBtn, ...(isRecording ? S.recBtnActive : {}) }}
            disabled={starting}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            id="record-btn"
          >
            {starting ? (
              <span className="spinner" />
            ) : isRecording ? (
              <>
                <span style={S.recDot} />
                Stop
              </>
            ) : (
              <>
                <span style={S.recIcon}>⏺</span>
                Record
              </>
            )}
          </button>
        </div>
      </header>

      {recordingError && (
        <div style={S.errorBanner}>
          <span style={S.errorIcon}>⚠</span>
          <span style={S.errorText}>{recordingError}</span>
          <button style={S.errorClose} onClick={() => setRecordingError('')}>✕</button>
        </div>
      )}

      <nav style={S.nav} role="tablist" aria-label="App panels">
        {PANELS.map((p) => {
          const active = activePanel === p.id;
          return (
            <button
              key={p.id}
              role="tab"
              id={`tab-${p.id}`}
              aria-selected={active}
              style={{ ...S.navTab, ...(active ? S.navTabActive : {}) }}
              onClick={() => setActivePanel(p.id)}
            >
              <span style={S.navIcon}>{p.icon}</span>
              <span style={S.navLabel}>{p.label}</span>
              {badges[p.id] > 0 && (
                <span style={S.navBadge}>{badges[p.id]}</span>
              )}
              {active && <span style={S.navUnderline} />}
            </button>
          );
        })}
      </nav>

      <main style={S.main} role="tabpanel">
        {activePanel === 'transcript' && <TranscriptPanel />}
        {activePanel === 'notes'      && <NotesPanel />}
        {activePanel === 'quiz'       && <QuizPanel />}
        {activePanel === 'chat'       && <ChatPanel />}
        {activePanel === 'reteach'    && <ReteachPanel />}
      </main>

      <DebugBar />

      {words.length > 0 && !isRecording && (
        <div style={S.footer}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => { if (confirm('Clear all session data?')) resetSession(); }}
          >
            Clear Session
          </button>
        </div>
      )}
    </div>
  );
}

const S = {
  root: {
    display: 'flex', flexDirection: 'column',
    height: '100dvh', overflow: 'hidden',
  },

  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 20px',
    background: 'rgba(5,10,20,0.8)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0, gap: 12, zIndex: 20,
    boxShadow: '0 1px 0 rgba(255,255,255,0.04), 0 4px 32px rgba(0,0,0,0.4)',
  },

  brand: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  brandLogo: {
    width: 32, height: 32, borderRadius: 9,
    background: 'linear-gradient(135deg, #4f8ef7 0%, #6b68f5 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 16px rgba(79,142,247,0.4)',
    flexShrink: 0,
  },
  brandLogoInner: { fontWeight: 900, fontSize: 16, color: '#fff', fontStyle: 'italic' },
  brandText: { display: 'flex', alignItems: 'center', gap: 6 },
  brandName: { fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', letterSpacing: '-0.04em' },
  brandTag: {
    background: 'linear-gradient(135deg, rgba(79,142,247,0.2), rgba(107,104,245,0.2))',
    border: '1px solid rgba(79,142,247,0.3)',
    color: 'var(--accent-light)',
    fontSize: 9, fontWeight: 800,
    padding: '2px 6px', borderRadius: 5,
    fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
  },
  teamTag: {
    fontSize: 10, color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
    borderLeft: '1px solid var(--border)', paddingLeft: 10,
  },

  centerRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    flex: 1, justifyContent: 'center', flexWrap: 'wrap',
  },
  connPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    padding: '4px 10px', borderRadius: 20,
  },
  connDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0, transition: 'all 0.3s' },
  connText: { fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 500 },
  enginePill: {
    fontSize: 10, color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
    padding: '3px 9px', borderRadius: 20,
  },

  rightRow: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  wordCount: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  wordNum: { fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 },
  wordLabel: { fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' },

  recBtn: {
    display: 'flex', alignItems: 'center', gap: 7,
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 13, fontWeight: 700,
    padding: '8px 18px',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
    letterSpacing: '0.01em',
    fontFamily: 'var(--font-sans)',
  },
  recBtnActive: {
    background: 'rgba(247,93,93,0.15)',
    border: '1px solid rgba(247,93,93,0.4)',
    color: '#ffb3b3',
    boxShadow: '0 0 20px rgba(247,93,93,0.25)',
    animation: 'recordPulse 2s infinite',
  },
  recDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: 'var(--red)',
    boxShadow: '0 0 8px var(--red-glow)',
    animation: 'pulse 1.2s ease-in-out infinite',
    flexShrink: 0,
  },
  recIcon: { fontSize: 11 },

  errorBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 20px',
    background: 'rgba(247,93,93,0.1)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(247,93,93,0.2)',
    flexShrink: 0,
  },
  errorIcon: { fontSize: 14, color: 'var(--red)', flexShrink: 0 },
  errorText: { flex: 1, fontSize: 13, color: '#ffb3b3', fontWeight: 500 },
  errorClose: {
    background: 'none', border: 'none', color: '#ffb3b3',
    cursor: 'pointer', fontSize: 14, padding: '2px 6px',
    opacity: 0.7, transition: 'opacity 0.2s', flexShrink: 0,
  },

  nav: {
    display: 'flex',
    background: 'rgba(5,10,20,0.6)',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0, overflowX: 'auto', zIndex: 10,
    padding: '0 8px',
  },
  navTab: {
    flex: 1,
    background: 'none', border: 'none',
    color: 'var(--text-muted)',
    fontSize: 12, fontWeight: 600,
    padding: '12px 10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    minWidth: 72, whiteSpace: 'nowrap',
    fontFamily: 'var(--font-sans)',
    letterSpacing: '0.02em',
  },
  navTabActive: { color: 'var(--text-primary)' },
  navIcon: { fontSize: 14, lineHeight: 1 },
  navLabel: { fontSize: 12 },
  navBadge: {
    background: 'var(--red)',
    color: '#fff', fontSize: 9, fontWeight: 800,
    padding: '2px 5px', borderRadius: 10,
    fontFamily: 'var(--font-mono)',
    boxShadow: '0 0 8px var(--red-glow)',
    lineHeight: 1.4,
  },
  navUnderline: {
    position: 'absolute', bottom: 0, left: '20%', right: '20%',
    height: 2, borderRadius: '2px 2px 0 0',
    background: 'linear-gradient(90deg, #4f8ef7, #6b68f5)',
    boxShadow: '0 0 8px rgba(79,142,247,0.6)',
  },

  main: {
    flex: 1, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    position: 'relative',
  },

  footer: {
    padding: '10px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex', justifyContent: 'flex-end',
    background: 'rgba(5,10,20,0.6)',
    backdropFilter: 'blur(12px)',
    flexShrink: 0, zIndex: 10,
  },
};