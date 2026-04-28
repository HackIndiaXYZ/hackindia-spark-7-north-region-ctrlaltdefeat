import { useState } from 'react';
import { useStore } from '../../store/index.js';
import { api } from '../../services/api.js';

export default function NotesPanel() {
  const { notes, addNotes, getRecentTranscript } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedIdx, setExpandedIdx] = useState(0);

  async function handleGenerateNow() {
    const transcript = getRecentTranscript(10000);
    if (transcript.trim().length < 20) { setError('Not enough transcript yet. Keep recording.'); return; }
    setError('');
    setLoading(true);
    try {
      const { notes: newNote } = await api.generateNotes(transcript);
      addNotes(newNote);
      setExpandedIdx(0);
    } catch (e) {
      setError(e.message || 'Failed to generate notes');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Auto Notes</div>
          <div style={S.subtitle}>AI-generated every ~200 words</div>
        </div>
        <button className="btn btn-primary" style={{ fontSize:12 }} onClick={handleGenerateNow} disabled={loading} id="generate-notes-btn">
          {loading ? <span className="spinner" /> : '+ Generate Now'}
        </button>
      </div>

      {error && (
        <div style={S.errorBar}>
          <span>⚠ {error}</span>
          <button style={S.errClose} onClick={() => setError('')}>✕</button>
        </div>
      )}

      <div style={S.body}>
        {notes.length === 0 ? (
          <div style={S.empty} className="fade-in">
            <span style={S.emptyIcon}>📝</span>
            <p style={S.emptyTitle}>No notes yet</p>
            <p style={S.emptyHint}>Notes auto-generate every ~2 minutes of lecture, or click Generate Now.</p>
          </div>
        ) : (
          notes.map((note, i) => (
            <NoteCard key={i} note={note} index={i} total={notes.length}
              expanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? -1 : i)} />
          ))
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, index, total, expanded, onToggle }) {
  return (
    <div className="card fade-up" style={S.card}>
      <button style={S.trigger} onClick={onToggle}>
        <div style={S.triggerLeft}>
          <span style={S.noteNum}>#{total - index}</span>
          <div>
            <div style={S.noteTitle}>{note.title}</div>
            <div style={S.tagRow}>
              {note.topicTags?.map(t => <span key={t} className="badge badge-blue">{t}</span>)}
            </div>
          </div>
        </div>
        <span style={{ color:'var(--text-muted)', fontSize:11, transition:'transform 0.25s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {expanded && (
        <div style={S.body2} className="fade-in">
          {note.summary && <InfoBlock label="Summary" icon="📋"><p style={S.prose}>{note.summary}</p></InfoBlock>}
          {note.keyPoints?.length > 0 && (
            <InfoBlock label="Key Points" icon="✦">
              <ul style={S.list}>{note.keyPoints.map((p,i)=><li key={i} style={S.li}><span style={S.arrow}>→</span>{p}</li>)}</ul>
            </InfoBlock>
          )}
          {note.definitions?.length > 0 && (
            <InfoBlock label="Definitions" icon="📖">
              {note.definitions.map((d,i)=>(
                <div key={i} style={S.defRow}><span style={S.defTerm}>{d.term}</span><span style={S.defDef}>{d.definition}</span></div>
              ))}
            </InfoBlock>
          )}
          {note.formulas?.length > 0 && (
            <InfoBlock label="Formulas" icon="∑">
              {note.formulas.map((f,i)=><code key={i} style={S.formula}>{f}</code>)}
            </InfoBlock>
          )}
          {note.examples?.length > 0 && (
            <InfoBlock label="Examples" icon="💡">
              <ul style={S.list}>{note.examples.map((e,i)=><li key={i} style={S.li}><span style={S.arrow}>→</span>{e}</li>)}</ul>
            </InfoBlock>
          )}
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, icon, children }) {
  return (
    <div style={B.wrap}>
      <div style={B.label}><span>{icon}</span>{label}</div>
      {children}
    </div>
  );
}

const B = {
  wrap: { display:'flex', flexDirection:'column', gap:10, padding:'14px 16px', background:'rgba(4,9,20,0.4)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' },
  label: { display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:800, fontFamily:'var(--font-mono)', color:'var(--accent)', letterSpacing:'0.1em', textTransform:'uppercase' },
};

const S = {
  root: { display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', background:'rgba(5,10,20,0.7)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderBottom:'1px solid var(--border)', flexShrink:0, gap:12 },
  title: { fontWeight:800, fontSize:14, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  subtitle: { fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:2 },
  errorBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 20px', flexShrink:0, background:'rgba(247,93,93,0.1)', borderBottom:'1px solid rgba(247,93,93,0.2)', fontSize:13, color:'#ffb3b3' },
  errClose: { background:'none', border:'none', color:'#ffb3b3', cursor:'pointer', fontSize:14 },
  body: { flex:1, overflowY:'auto', padding:'20px', display:'flex', flexDirection:'column', gap:12 },
  empty: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:48, textAlign:'center' },
  emptyIcon: { fontSize:48, animation:'float 3s ease-in-out infinite' },
  emptyTitle: { fontWeight:700, fontSize:17, color:'var(--text-primary)' },
  emptyHint: { color:'var(--text-muted)', fontSize:14, maxWidth:280, lineHeight:1.7 },
  card: { overflow:'hidden' },
  trigger: { width:'100%', background:'none', border:'none', cursor:'pointer', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, textAlign:'left' },
  triggerLeft: { display:'flex', alignItems:'flex-start', gap:12, flex:1 },
  noteNum: { fontSize:11, fontWeight:800, fontFamily:'var(--font-mono)', color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid rgba(79,142,247,0.2)', borderRadius:6, padding:'2px 8px', flexShrink:0, marginTop:2 },
  noteTitle: { fontWeight:700, fontSize:14, color:'var(--text-primary)', letterSpacing:'-0.01em', lineHeight:1.4, marginBottom:6 },
  tagRow: { display:'flex', gap:5, flexWrap:'wrap' },
  body2: { padding:'0 20px 20px', display:'flex', flexDirection:'column', gap:10 },
  prose: { fontSize:14, color:'var(--text-secondary)', lineHeight:1.75 },
  list: { listStyle:'none', display:'flex', flexDirection:'column', gap:6 },
  li: { fontSize:14, color:'var(--text-secondary)', lineHeight:1.6, display:'flex', gap:8, alignItems:'flex-start' },
  arrow: { color:'var(--accent)', fontFamily:'var(--font-mono)', fontSize:12, flexShrink:0, marginTop:2 },
  defRow: { display:'flex', gap:12, alignItems:'flex-start', paddingBottom:8, borderBottom:'1px solid var(--border)' },
  defTerm: { fontSize:12, fontWeight:700, color:'var(--accent-light)', fontFamily:'var(--font-mono)', minWidth:110, flexShrink:0 },
  defDef: { fontSize:13, color:'var(--text-secondary)', lineHeight:1.6 },
  formula: { display:'block', fontFamily:'var(--font-mono)', fontSize:13, background:'rgba(79,142,247,0.08)', padding:'10px 14px', borderRadius:'var(--radius-sm)', color:'#fca5a5', border:'1px solid rgba(79,142,247,0.15)', marginBottom:6 },
};
