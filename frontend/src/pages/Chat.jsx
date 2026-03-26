import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../lib/api';
import {
  Send, Bot, User, Sparkles, Plus, Trash2,
  MessageSquare, ArrowLeft, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import './Chat.css';

const SUGGESTIONS = [
  'What metrics should I evaluate for a SaaS startup?',
  'Give me 10 funded startups in cybersecurity',
  'Top VCs investing in AI healthcare in 2024',
  'What makes a startup investment-ready?',
];

export default function Chat() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialAnalysisId = searchParams.get('analysisId');

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convLoading, setConvLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load conversations list
  useEffect(() => {
    fetchConversations();
  }, []);

  // If coming from analysis page, auto-create a conversation scoped to that analysis
  useEffect(() => {
    if (initialAnalysisId && conversations.length === 0 && !convLoading) {
      handleNewChat(initialAnalysisId);
    }
  }, [convLoading]);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data.conversations);
      // If there's conversations, auto-select the most recent
      if (res.data.conversations.length > 0 && !activeConvId) {
        selectConversation(res.data.conversations[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setConvLoading(false);
    }
  };

  const selectConversation = async (convId) => {
    setActiveConvId(convId);
    setMsgLoading(true);
    try {
      const res = await api.get('/chat/history', { params: { conversationId: convId } });
      setMessages(res.data.messages);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setMsgLoading(false);
    }
  };

  const handleNewChat = async (analysisId = null) => {
    try {
      const res = await api.post('/chat/conversations', {
        title: 'New Chat',
        analysisId: analysisId || undefined,
      });
      const newConv = res.data.conversation;
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      setMessages([]);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleDeleteConv = async (e, convId) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    try {
      await api.delete(`/chat/conversations/${convId}`);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
        const remaining = conversations.filter((c) => c.id !== convId);
        if (remaining.length > 0) selectConversation(remaining[0].id);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    const tempUser = { id: 'tmp-u-' + Date.now(), role: 'user', content: userMessage };
    setMessages((prev) => [...prev, tempUser]);

    try {
      const res = await api.post('/chat', {
        message: userMessage,
        conversationId: activeConvId || undefined,
      });

      const { reply, conversationId: returnedConvId } = res.data;

      // If this was the first message in a new chat, update state
      if (!activeConvId && returnedConvId) {
        setActiveConvId(returnedConvId);
        // Update conversations list with the new title
        await fetchConversations();
      } else {
        // Refresh conversation list to update lastMessage / updatedAt
        fetchConversations();
      }

      setMessages((prev) => [
        ...prev,
        { id: 'tmp-a-' + Date.now(), role: 'assistant', content: reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: 'tmp-e-' + Date.now(), role: 'assistant', content: '⚠️ Something went wrong. Please try again.', isError: true },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <div className="chat-page">
      {/* ── Sidebar ── */}
      <aside className={`chat-sidebar ${sidebarOpen ? 'chat-sidebar-open' : 'chat-sidebar-closed'}`}>
        <div className="chat-sidebar-header">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/')} title="Dashboard">
            <ArrowLeft size={16} />
          </button>
          <span className="chat-sidebar-logo">
            <Sparkles size={14} /> FinAnalyser
          </span>
          <button className="btn btn-ghost btn-icon" onClick={() => setSidebarOpen(false)} title="Close sidebar">
            <PanelLeftClose size={16} />
          </button>
        </div>

        <button className="chat-new-btn" onClick={() => handleNewChat()}>
          <Plus size={16} /> New Chat
        </button>

        <div className="chat-conv-list">
          {convLoading ? (
            <div className="chat-conv-loading"><div className="spinner" /></div>
          ) : conversations.length === 0 ? (
            <p className="chat-conv-empty">No conversations yet</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                className={`chat-conv-item ${activeConvId === conv.id ? 'chat-conv-active' : ''}`}
                onClick={() => selectConversation(conv.id)}
              >
                <MessageSquare size={14} className="chat-conv-icon" />
                <div className="chat-conv-info">
                  <span className="chat-conv-title">{conv.title || 'New Chat'}</span>
                  {conv.lastMessage && (
                    <span className="chat-conv-preview">
                      {conv.lastMessage.slice(0, 40)}...
                    </span>
                  )}
                </div>
                <button
                  className="chat-conv-delete"
                  onClick={(e) => handleDeleteConv(e, conv.id)}
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <div className="chat-main">
        {/* Header */}
        <div className="chat-header">
          {!sidebarOpen && (
            <button className="btn btn-ghost btn-icon" onClick={() => setSidebarOpen(true)}>
              <PanelLeftOpen size={16} />
            </button>
          )}
          <div className="chat-header-left">
            <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            <span className="chat-header-title">
              {activeConvId
                ? conversations.find((c) => c.id === activeConvId)?.title || 'Chat'
                : 'FinAnalyser AI'}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {msgLoading ? (
            <div className="chat-loading"><div className="spinner" /></div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon"><Bot size={48} /></div>
              <h2>How can I help you?</h2>
              <p>Ask about startups, investments, funding rounds, or market trends.</p>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="chat-suggestion" onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-messages-list">
              {messages.map((msg) => (
                <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
                  <div className="chat-message-avatar">
                    {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
                  </div>
                  <div className={`chat-message-content ${msg.isError ? 'chat-message-error' : ''}`}>
                    {msg.role === 'assistant' ? (
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="chat-message chat-message-assistant">
                  <div className="chat-message-avatar"><Bot size={15} /></div>
                  <div className="chat-message-content">
                    <div className="chat-typing"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="chat-input-container">
          <form className="chat-input-form" onSubmit={handleSend}>
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Message FinAnalyser..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button type="submit" className="chat-send-btn" disabled={!input.trim() || loading}>
              <Send size={18} />
            </button>
          </form>
          <p className="chat-disclaimer">AI can make mistakes. Verify important financial data.</p>
        </div>
      </div>
    </div>
  );
}
