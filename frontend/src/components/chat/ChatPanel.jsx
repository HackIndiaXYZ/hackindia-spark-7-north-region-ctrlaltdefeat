import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../../store/index.js';
import { api } from '../../services/api.js';

const SUGGESTED = [
  'Summarize what was just explained',
  'What is the main concept of this lecture?',
  'Explain this in simpler terms',
  'Give me an example of this',
];

export default function ChatPanel() {
  const { chatHistory, addChatMessage, getRecentTranscript } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory.length, loading]);

  async function handleSend() {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setError('');
    addChatMessage('user', q);
    setLoading(true);
    try {
      const transcript = getRecentTranscript(15000);
      const history = chatHistory.slice(-8).map(m => ({ role: m.role, text: m.text }));
      const res = await api.chat(q, transcript, history);
      const answer = res.answer?.trim();
      if (!answer) throw new Error('Received empty response. Please try again.');
      addChatMessage('model', answer);
    } catch (e) {
      setError(e.message || 'Failed to get answer. Please try again.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.title}>Doubt Resolver</span>
          <span style={S.subtitle}>Answers grounded in your lecture transcript</span>
        </div>
        {chatHistory.length > 0 && (
          <span style={S.msgCount}>{chatHistory.length} messages</span>
        )}
      </div>

      <div style={S.body}>
        {chatHistory.length === 0 && (
          <div style={S.welcome} className="fade-in">
            <span style={S.welcomeIcon}>💡</span>
            <p style={S.welcomeText}>Ask anything about your lecture. I'll answer using the transcript first.</p>
            <div style={S.suggestions}>
              {SUGGESTED.map(s => (
                <button key={s} style={S.suggBtn} onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i}
            style={{ ...S.bubble, ...(msg.role === 'user' ? S.userBubble : S.aiBubble) }}
            className="fade-up"
          >
            {msg.role === 'model' ? (
              <div className="markdown-body"><ReactMarkdown>{msg.text}</ReactMarkdown></div>
            ) : (
              <p style={S.userText}>{msg.text}</p>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ ...S.bubble, ...S.aiBubble }} className="fade-in">
            <div style={S.thinking}>
              {[0,1,2].map(i => <span key={i} style={{ ...S.dot, animationDelay:`${i*0.18}s` }} />)}
            </div>
          </div>
        )}

        {error && <div style={S.errBubble} className="fade-in">⚠ {error}</div>}
        <div ref={bottomRef} />
      </div>

      <div style={S.inputRow}>
        <div style={S.inputWrap}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a doubt about the lecture…"
            style={S.textarea}
            rows={2}
            maxLength={1000}
            disabled={loading}
            aria-label="Type your question"
            id="chat-input"
          />
          <span style={S.charCount}>{input.length}/1000</span>
        </div>
        <button
          onClick={handleSend}
          style={{ ...S.sendBtn, opacity: (!input.trim() || loading) ? 0.35 : 1 }}
          disabled={!input.trim() || loading}
          aria-label="Send question"
          id="chat-send-btn"
        >
          {loading ? <span className="spinner" /> : '↑'}
        </button>
      </div>
    </div>
  );
}

const S = {
  root: { display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', background:'rgba(5,10,20,0.7)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderBottom:'1px solid var(--border)', flexShrink:0, gap:12 },
  headerLeft: { display:'flex', flexDirection:'column', gap:2 },
  title: { fontWeight:800, fontSize:14, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  subtitle: { fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' },
  msgCount: { fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)', background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', padding:'3px 8px', borderRadius:20 },
  body: { flex:1, overflowY:'auto', padding:'20px', display:'flex', flexDirection:'column', gap:14 },
  welcome: { display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'28px 0', gap:12 },
  welcomeIcon: { fontSize:44, animation:'float 3s ease-in-out infinite' },
  welcomeText: { color:'var(--text-secondary)', fontSize:14, maxWidth:300, lineHeight:1.7 },
  suggestions: { display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:380, marginTop:8 },
  suggBtn: { background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', fontSize:13, padding:'11px 16px', cursor:'pointer', textAlign:'left', transition:'all 0.2s', fontFamily:'var(--font-sans)' },
  bubble: { padding:'14px 18px', borderRadius:'var(--radius-lg)', maxWidth:'92%', lineHeight:1.6, boxShadow:'0 4px 12px rgba(0,0,0,0.25)' },
  userBubble: { background:'linear-gradient(135deg, #4f8ef7 0%, #6b68f5 100%)', alignSelf:'flex-end', borderBottomRightRadius:4, color:'#fff', boxShadow:'0 4px 20px rgba(79,142,247,0.3)' },
  aiBubble: { background:'var(--bg-card)', backdropFilter:'blur(12px)', border:'1px solid var(--border)', alignSelf:'flex-start', borderBottomLeftRadius:4 },
  userText: { fontSize:14, color:'#fff', lineHeight:1.65 },
  thinking: { display:'flex', gap:5, alignItems:'center', padding:'4px 2px' },
  dot: { width:7, height:7, borderRadius:'50%', background:'var(--text-muted)', animation:'pulse 1.2s ease-in-out infinite' },
  errBubble: { background:'rgba(247,93,93,0.1)', border:'1px solid rgba(247,93,93,0.2)', borderRadius:'var(--radius-sm)', padding:'12px 16px', fontSize:13, color:'#ffb3b3', alignSelf:'stretch' },
  inputRow: { padding:'14px 16px', background:'rgba(5,10,20,0.7)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderTop:'1px solid var(--border)', display:'flex', gap:10, alignItems:'flex-end', flexShrink:0 },
  inputWrap: { flex:1, position:'relative' },
  textarea: { flex:1, background:'rgba(4,9,20,0.6)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:14, padding:'11px 14px', resize:'none', fontFamily:'var(--font-sans)', lineHeight:1.55, outline:'none', transition:'border-color 0.2s, box-shadow 0.2s', width:'100%', boxSizing:'border-box' },
  charCount: { position:'absolute', bottom:8, right:10, fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', pointerEvents:'none' },
  sendBtn: { background:'linear-gradient(135deg,#4f8ef7,#6b68f5)', border:'none', borderRadius:'var(--radius-sm)', color:'#fff', width:46, height:46, fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.2s', boxShadow:'0 4px 16px rgba(79,142,247,0.35)' },
};