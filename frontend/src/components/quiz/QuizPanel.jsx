import { useState } from 'react';
import { useStore } from '../../store/index.js';
import { api } from '../../services/api.js';

export default function QuizPanel() {
  const { quizQueue, removeQuizQuestion, recordQuizAnswer, topicScores, getRecentTranscript } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [answered, setAnswered] = useState({});
  const [revealed, setRevealed] = useState({});

  const currentQ = quizQueue[0] || null;

  async function handleGenerateNow() {
    const transcript = getRecentTranscript(8000);
    if (transcript.trim().length < 30) { setError('Need more transcript content. Keep recording.'); return; }
    setError('');
    setLoading(true);
    try {
      const asked = Object.keys(answered);
      const { questions } = await api.generateQuiz(transcript, '', asked);
      useStore.getState().addQuizQuestions(questions);
    } catch (e) {
      setError(e.message || 'Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  }

  function handleAnswer(q, idx) {
    if (answered[q.id] !== undefined) return;
    setAnswered(p => ({ ...p, [q.id]: idx }));
    setRevealed(p => ({ ...p, [q.id]: true }));
    recordQuizAnswer(q.id, q.topicTag, idx === q.correctIndex);
  }

  const topics = Object.entries(topicScores)
    .map(([topic, { correct, total }]) => ({ topic, score: total > 0 ? correct / total : 0, total }))
    .sort((a, b) => a.score - b.score);

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Real-Time Quiz</div>
          <div style={S.subtitle}>{quizQueue.length} question{quizQueue.length !== 1 ? 's' : ''} in queue</div>
        </div>
        <button className="btn" style={{ ...S.genBtn }} onClick={handleGenerateNow} disabled={loading} id="generate-quiz-btn">
          {loading ? <span className="spinner" style={{ borderTopColor:'#000' }} /> : '+ Generate'}
        </button>
      </div>

      {error && (
        <div style={S.errorBar}>
          <span>⚠ {error}</span>
          <button style={S.errClose} onClick={() => setError('')}>✕</button>
        </div>
      )}

      <div style={S.body}>
        {currentQ ? (
          <QuizCard
            q={currentQ}
            selected={answered[currentQ.id]}
            revealed={!!revealed[currentQ.id]}
            onAnswer={idx => handleAnswer(currentQ, idx)}
            onNext={() => removeQuizQuestion(currentQ.id)}
            remaining={quizQueue.length}
          />
        ) : (
          <div style={S.empty} className="fade-in">
            <span style={S.emptyIcon}>✅</span>
            <p style={S.emptyTitle}>{Object.keys(topicScores).length > 0 ? 'All caught up!' : 'No questions yet'}</p>
            <p style={S.emptyHint}>
              {Object.keys(topicScores).length > 0
                ? 'More questions appear as the lecture continues.'
                : 'Quiz questions auto-generate during the lecture.'}
            </p>
          </div>
        )}

        {topics.length > 0 && (
          <div style={S.perfSection}>
            <div style={S.perfLabel}>Topic Performance</div>
            <div style={S.perfGrid}>
              {topics.map(t => <TopicBar key={t.topic} {...t} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuizCard({ q, selected, revealed, onAnswer, onNext, remaining }) {
  const diffColor = { easy: 'var(--green)', medium: 'var(--amber)', hard: 'var(--red)' };
  const correct = revealed && selected === q.correctIndex;

  return (
    <div className="card fade-up" style={S.card}>
      <div style={S.cardTop}>
        <span className="badge badge-blue">{q.topicTag}</span>
        <span style={{ ...S.diff, color: diffColor[q.difficulty] || 'var(--text-muted)' }}>{q.difficulty}</span>
        {remaining > 1 && <span style={S.more}>+{remaining - 1} more</span>}
      </div>

      <p style={S.question}>{q.question}</p>

      <div style={S.options}>
        {q.options.map((opt, i) => {
          let extra = {};
          if (revealed) {
            if (i === q.correctIndex)                        extra = S.optCorrect;
            else if (i === selected && i !== q.correctIndex) extra = S.optWrong;
            else                                             extra = { opacity: 0.35 };
          } else if (selected === i) {
            extra = S.optSelected;
          }
          return (
            <button key={i} style={{ ...S.opt, ...extra }} onClick={() => onAnswer(i)} disabled={revealed}>
              <span style={S.optLetter}>{String.fromCharCode(65 + i)}</span>
              <span style={S.optText}>{opt.replace(/^[A-D]\.\s*/, '')}</span>
              {revealed && i === q.correctIndex && <span style={S.optCheck}>✓</span>}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div style={{ ...S.explain, ...(correct ? S.explainCorrect : S.explainWrong) }} className="fade-in">
          <div style={S.explainHead}>{correct ? '🎉 Correct!' : '❌ Incorrect'}</div>
          <p style={S.explainText}>{q.explanation}</p>
          <button className="btn btn-primary" style={{ fontSize:12, alignSelf:'flex-start' }} onClick={onNext}>
            Next Question →
          </button>
        </div>
      )}
    </div>
  );
}

function TopicBar({ topic, score, total }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={S.topicBar}>
      <div style={S.topicHead}>
        <span style={S.topicName}>{topic}</span>
        <span style={{ ...S.topicPct, color }}>{pct}%</span>
      </div>
      <div style={S.track}><div style={{ ...S.fill, width:`${pct}%`, background:color }} /></div>
      <span style={S.topicSub}>{total} question{total !== 1 ? 's' : ''}</span>
    </div>
  );
}

const S = {
  root: { display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', background:'rgba(5,10,20,0.7)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderBottom:'1px solid var(--border)', flexShrink:0, gap:12 },
  title: { fontWeight:800, fontSize:14, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  subtitle: { fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:2 },
  genBtn: { background:'linear-gradient(135deg,#f7b731,#f7934c)', color:'#000', fontSize:12, fontWeight:800, padding:'8px 16px', borderRadius:'var(--radius-sm)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 16px rgba(247,183,49,0.35)', transition:'all 0.2s' },
  errorBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 20px', flexShrink:0, background:'rgba(247,93,93,0.1)', borderBottom:'1px solid rgba(247,93,93,0.2)', fontSize:13, color:'#ffb3b3' },
  errClose: { background:'none', border:'none', color:'#ffb3b3', cursor:'pointer', fontSize:14 },
  body: { flex:1, overflowY:'auto', padding:'20px', display:'flex', flexDirection:'column', gap:20 },
  empty: { display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:40, textAlign:'center' },
  emptyIcon: { fontSize:44, animation:'float 3s ease-in-out infinite' },
  emptyTitle: { fontWeight:700, fontSize:17, color:'var(--text-primary)' },
  emptyHint: { color:'var(--text-muted)', fontSize:14, maxWidth:280, lineHeight:1.7 },
  card: { padding:'20px', display:'flex', flexDirection:'column', gap:16 },
  cardTop: { display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' },
  diff: { fontSize:10, fontFamily:'var(--font-mono)', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase' },
  more: { fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)' },
  question: { fontSize:15, fontWeight:700, color:'var(--text-primary)', lineHeight:1.65, letterSpacing:'-0.01em' },
  options: { display:'flex', flexDirection:'column', gap:8 },
  opt: { background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'11px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:12, textAlign:'left', transition:'all 0.18s', width:'100%', fontFamily:'var(--font-sans)' },
  optSelected: { background:'rgba(79,142,247,0.12)', borderColor:'rgba(79,142,247,0.4)', boxShadow:'0 0 12px rgba(79,142,247,0.15)' },
  optCorrect: { background:'rgba(34,211,160,0.12)', borderColor:'rgba(34,211,160,0.4)', boxShadow:'0 0 12px var(--green-glow)' },
  optWrong: { background:'rgba(247,93,93,0.12)', borderColor:'rgba(247,93,93,0.35)' },
  optLetter: { fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, color:'var(--accent)', minWidth:18 },
  optText: { fontSize:14, color:'var(--text-secondary)', lineHeight:1.45, flex:1 },
  optCheck: { color:'var(--green)', fontWeight:800, fontSize:14, flexShrink:0 },
  explain: { borderRadius:'var(--radius-sm)', padding:'16px', display:'flex', flexDirection:'column', gap:10 },
  explainCorrect: { background:'rgba(34,211,160,0.08)', border:'1px solid rgba(34,211,160,0.2)' },
  explainWrong: { background:'rgba(247,93,93,0.08)', border:'1px solid rgba(247,93,93,0.2)' },
  explainHead: { fontSize:14, fontWeight:800, color:'var(--text-primary)' },
  explainText: { fontSize:13, color:'var(--text-secondary)', lineHeight:1.65 },
  perfSection: { display:'flex', flexDirection:'column', gap:10 },
  perfLabel: { fontSize:10, fontWeight:800, fontFamily:'var(--font-mono)', color:'var(--text-muted)', letterSpacing:'0.1em', textTransform:'uppercase' },
  perfGrid: { display:'flex', flexDirection:'column', gap:8 },
  topicBar: { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'12px 14px', display:'flex', flexDirection:'column', gap:6 },
  topicHead: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  topicName: { fontSize:13, fontWeight:600, color:'var(--text-secondary)' },
  topicPct: { fontSize:13, fontWeight:800, fontFamily:'var(--font-mono)' },
  track: { height:5, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' },
  fill: { height:'100%', borderRadius:3, transition:'width 0.5s ease', boxShadow:'0 0 8px currentColor' },
  topicSub: { fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)' },
};
