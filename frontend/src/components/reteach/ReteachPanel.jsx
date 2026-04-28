import { useState } from 'react';
import { useStore } from '../../store/index.js';
import { api } from '../../services/api.js';

export default function ReteachPanel() {
  const { getWeakTopics, getRecentTranscript, recordQuizAnswer } = useStore();
  const weakTopics = getWeakTopics();

  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkAnswer, setCheckAnswer] = useState(null);
  const [checkRevealed, setCheckRevealed] = useState(false);

  async function handleGenerate(topicArg) {
    const t = (topicArg || customTopic || '').trim();
    if (!t) { setError('Please enter a topic name before generating a lesson.'); return; }
    setError('');
    setLesson(null);
    setCheckAnswer(null);
    setCheckRevealed(false);
    setLoading(true);
    try {
      const ctx = getRecentTranscript(8000);
      const res = await api.reteach(t, ctx);
      if (!res?.lesson) throw new Error('No lesson data returned. Please try again.');
      setLesson(res.lesson);
      setSelectedTopic(t);
    } catch (e) {
      setError(e.message || 'Failed to generate lesson. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleCheck(idx) {
    if (checkRevealed) return;
    setCheckAnswer(idx);
    setCheckRevealed(true);
    recordQuizAnswer(`reteach_${Date.now()}`, selectedTopic, idx === lesson.checkQuestion.correctIndex);
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Re-Teaching</div>
          <div style={S.subtitle}>Personalized micro-lessons on your weak spots</div>
        </div>
      </div>

      <div style={S.body}>
        {weakTopics.length > 0 && (
          <div style={S.weakSection}>
            <div style={S.sectionLabel}>Your Weak Topics — tap to re-learn</div>
            <div style={S.chipRow}>
              {weakTopics.slice(0, 6).map(t => {
                const pct = Math.round(t.score * 100);
                return (
                  <button key={t.topic} style={S.chip} onClick={() => handleGenerate(t.topic)} disabled={loading}>
                    <span style={S.chipTopic}>{t.topic}</span>
                    <span style={{ ...S.chipPct, color: pct < 50 ? 'var(--red)' : 'var(--amber)' }}>{pct}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={S.inputRow}>
          <input
            className="input"
            placeholder="Or type any topic to re-learn…"
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            maxLength={200}
            aria-label="Custom topic to reteach"
            id="reteach-input"
          />
          <button
            className="btn"
            style={S.goBtn}
            onClick={() => handleGenerate()}
            disabled={!customTopic.trim() || loading}
          >
            {loading ? <span className="spinner" style={{ borderTopColor:'#000' }} /> : 'Learn →'}
          </button>
        </div>

        {error && <div style={S.errorBar}><span>⚠ {error}</span><button style={S.errClose} onClick={() => setError('')}>✕</button></div>}

        {lesson && (
          <div className="card fade-up" style={S.lessonCard}>
            <div style={S.lessonHeader}>
              <span style={S.lessonTopic}>{lesson.topic}</span>
              <span className="badge badge-blue">Re-Teach</span>
            </div>

            <div style={S.lessonBody}>
              <div style={S.coreIdea}>
                <span style={S.coreLabel}>Core Idea</span>
                <p style={S.coreText}>{lesson.coreIdea}</p>
              </div>

              <LessonBlock label="📖 Explanation">
                <p style={S.lessonText}>{lesson.explanation}</p>
              </LessonBlock>

              <LessonBlock label="💡 Analogy">
                <p style={{ ...S.lessonText, fontStyle:'italic', borderLeft:'2px solid var(--purple)', paddingLeft:12, background:'var(--purple-dim)', borderRadius:'0 var(--radius-sm) var(--radius-sm) 0' }}>{lesson.analogy}</p>
              </LessonBlock>

              <LessonBlock label="🔢 Example">
                <p style={S.lessonText}>{lesson.example}</p>
              </LessonBlock>

              {lesson.commonMistakes?.length > 0 && (
                <LessonBlock label="⚠️ Common Mistakes">
                  <ul style={S.mistakeList}>
                    {lesson.commonMistakes.map((m, i) => <li key={i} style={S.mistakeItem}><span style={S.mistakeDot}>!</span>{m}</li>)}
                  </ul>
                </LessonBlock>
              )}

              {lesson.keyTerms?.length > 0 && (
                <LessonBlock label="📚 Key Terms">
                  <div style={S.termGrid}>
                    {lesson.keyTerms.map((kt, i) => (
                      <div key={i} style={S.termCard}>
                        <div style={S.termName}>{kt.term}</div>
                        <div style={S.termMeaning}>{kt.meaning}</div>
                      </div>
                    ))}
                  </div>
                </LessonBlock>
              )}

              {lesson.checkQuestion && (
                <div style={S.checkSection}>
                  <div style={S.checkLabel}>✅ Check Your Understanding</div>
                  <p style={S.checkQ}>{lesson.checkQuestion.question}</p>
                  <div style={S.checkOpts}>
                    {lesson.checkQuestion.options.map((opt, i) => {
                      let extra = {};
                      if (checkRevealed) {
                        if (i === lesson.checkQuestion.correctIndex)                        extra = S.optCorrect;
                        else if (i === checkAnswer && i !== lesson.checkQuestion.correctIndex) extra = S.optWrong;
                        else                                                                 extra = { opacity:0.35 };
                      } else if (checkAnswer === i) {
                        extra = S.optSelected;
                      }
                      return (
                        <button key={i} style={{ ...S.checkOpt, ...extra }} onClick={() => handleCheck(i)} disabled={checkRevealed}>
                          <span style={S.optLetter}>{String.fromCharCode(65 + i)}</span>
                          <span>{opt.replace(/^[A-D]\.\s*/, '')}</span>
                        </button>
                      );
                    })}
                  </div>
                  {checkRevealed && (
                    <div style={S.checkExplain} className="fade-in">
                      <strong>{checkAnswer === lesson.checkQuestion.correctIndex ? '🎉 Correct!' : '📌 Remember:'}</strong>
                      {' '}{lesson.checkQuestion.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {weakTopics.length === 0 && !lesson && !loading && (
          <div style={S.empty} className="fade-in">
            <span style={S.emptyIcon}>🔁</span>
            <p style={S.emptyTitle}>No weak topics yet</p>
            <p style={S.emptyHint}>Complete some quizzes to identify weak areas, or type any topic above for a micro-lesson.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LessonBlock({ label, children }) {
  return (
    <div style={LB.wrap}>
      <div style={LB.label}>{label}</div>
      {children}
    </div>
  );
}
const LB = {
  wrap: { 
    display:'flex', 
    flexDirection:'column', 
    gap:12, 
    paddingTop:18, 
    marginTop:8, 
    borderTop:'1px solid var(--border)' 
  },
  label: { fontSize:13, fontWeight:700, color:'var(--text-primary)' },
};

const S = {
  root: { 
    display:'flex', 
    flexDirection:'column', 
    height:'100vh',
    overflow:'hidden'
  },

  header: { 
    display:'flex', 
    alignItems:'center', 
    justifyContent:'space-between', 
    padding:'16px 24px',
    background:'rgba(5,10,20,0.7)', 
    backdropFilter:'blur(16px)', 
    WebkitBackdropFilter:'blur(16px)', 
    borderBottom:'1px solid var(--border)', 
    flexShrink:0 
  },

  title: { fontWeight:800, fontSize:14, color:'var(--text-primary)' },

  subtitle: { fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:2 },

  body: { 
    flex:1, 
    overflowY:'auto',
    minHeight:0,
    padding:'clamp(16px, 3vw, 32px)',
    display:'flex',
    flexDirection:'column',
    gap:24,
    width:'100%',
    maxWidth:'1200px',
    margin:'0 auto'
  },

  weakSection: { display:'flex', flexDirection:'column', gap:12 },

  sectionLabel: { fontSize:10, fontWeight:800, fontFamily:'var(--font-mono)', color:'var(--text-muted)', letterSpacing:'0.1em', textTransform:'uppercase' },

  chipRow: { display:'flex', flexWrap:'wrap', gap:10 },

  chip: { 
    background:'var(--bg-card)', 
    border:'1px solid rgba(247,93,93,0.25)', 
    borderRadius:'var(--radius-sm)', 
    padding:'10px 16px',
    cursor:'pointer', 
    display:'flex', 
    alignItems:'center', 
    gap:10
  },

  chipTopic: { fontSize:13, color:'var(--text-primary)', fontWeight:600 },

  chipPct: { fontSize:12, fontFamily:'var(--font-mono)', fontWeight:800 },

  inputRow: { display:'flex', gap:12 },

  goBtn: { 
    background:'linear-gradient(135deg,#22d3a0,#059669)', 
    color:'#000', 
    fontSize:13, 
    fontWeight:800, 
    padding:'12px 22px', 
    borderRadius:'var(--radius-sm)', 
    border:'none', 
    cursor:'pointer', 
    display:'flex', 
    alignItems:'center', 
    gap:6,
    flexShrink:0
  },

  errorBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'rgba(247,93,93,0.1)', border:'1px solid rgba(247,93,93,0.2)', borderRadius:'var(--radius-sm)', fontSize:13, color:'#ffb3b3' },

  errClose: { background:'none', border:'none', cursor:'pointer', fontSize:14 },

  lessonCard: { marginTop:10 },

  lessonHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid var(--border)' },

  lessonTopic: { fontSize:15, fontWeight:800, color:'var(--accent-light)' },

  lessonBody: { padding:'24px', display:'flex', flexDirection:'column', gap:20 },

  coreIdea: { padding:'18px', borderRadius:'var(--radius-sm)' },

  coreLabel: { fontSize:10, fontWeight:800 },

  coreText: { fontSize:14, lineHeight:1.65 },

  lessonText: { fontSize:14, lineHeight:1.75 },

  mistakeList: { display:'flex', flexDirection:'column', gap:8 },

  mistakeItem: { fontSize:13, display:'flex', gap:8 },

  mistakeDot: { fontWeight:900 },

  termGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 },

  termCard: { padding:'14px' },

  termName: { fontSize:11, fontWeight:800 },

  termMeaning: { fontSize:12 },

  checkSection: { padding:'18px', display:'flex', flexDirection:'column', gap:14 },

  checkLabel: { fontSize:13, fontWeight:800 },

  checkQ: { fontSize:14 },

  checkOpts: { display:'flex', flexDirection:'column', gap:8 },

  checkOpt: { padding:'12px 16px', display:'flex', gap:10, width:'100%' },

  optCorrect: {},

  optWrong: {},

  optSelected: {},

  optLetter: { minWidth:16 },

  checkExplain: { padding:'14px 16px' },

  empty: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:48 },

  emptyIcon: { fontSize:44 },

  emptyTitle: { fontSize:17 },

  emptyHint: { fontSize:14, maxWidth:320 },
};