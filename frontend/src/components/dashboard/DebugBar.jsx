import { useState, useEffect } from 'react';
import { useStore } from '../../store/index.js';
import { rateLimiter } from '../../hooks/useTranscription.js';

export default function DebugBar() {
  const [visible, setVisible] = useState(false);
  const [budget, setBudget] = useState({ perMin: 3, perDay: 18 });
  const { words, isConnected, isRecording, browserMode, quizQueue, notes } = useStore();

  useEffect(() => {
    const handler = (e) => { if (e.ctrlKey && e.key === 'd') { e.preventDefault(); setVisible(v => !v); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setBudget(rateLimiter.remaining()), 2000);
    return () => clearInterval(t);
  }, [visible]);

  if (!visible) return (
    <div style={S.hint} title="Press Ctrl+D to show debug panel">⌨</div>
  );

  const status = [
    { label: 'WS',         value: isConnected ? '🟢 connected' : '🔴 off' },
    { label: 'Engine',     value: browserMode || 'none' },
    { label: 'Words',      value: words.length },
    { label: 'Quiz queue', value: quizQueue.length },
    { label: 'Notes',      value: notes.length },
    { label: 'API/min',    value: budget.perMin },
    { label: 'API/day',    value: budget.perDay },
  ];

  return (
    <div style={S.bar}>
      {status.map(({ label, value }) => (
        <span key={label} style={S.item}>
          <span style={S.label}>{label}</span>
          <span style={S.value}>{String(value)}</span>
        </span>
      ))}
      <button style={S.close} onClick={() => setVisible(false)}>✕</button>
    </div>
  );
}

const S = {
  hint: { position:'fixed', bottom:8, right:8, fontSize:12, color:'rgba(255,255,255,0.12)', cursor:'default', userSelect:'none', zIndex:999 },
  bar: { position:'fixed', bottom:0, left:0, right:0, background:'rgba(4,9,20,0.95)', backdropFilter:'blur(20px)', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:16, padding:'6px 16px', zIndex:1000, flexWrap:'wrap' },
  item: { display:'flex', gap:5, alignItems:'center' },
  label: { fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text-muted)', letterSpacing:'0.06em' },
  value: { fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text-secondary)', fontWeight:600 },
  close: { marginLeft:'auto', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:12 },
};
