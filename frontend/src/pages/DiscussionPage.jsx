import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Send, Edit3, Trash2, Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import { Toast } from '../components/ui/Shared';

export default function DiscussionPage() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [editingMsg, setEditingMsg] = useState(null);
    const [editText, setEditText] = useState('');
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    const fetchMessages = async (silent = false) => {
        try {
            const res = await api.get('/discussion/');
            setMessages(res.data);
            if (!silent) setLoading(false);
        } catch (err) {
            console.error('Failed to fetch discussion messages:', err);
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();

        const handleWsUpdate = (e) => {
            const data = e.detail;
            if (data.type === 'DISCUSSION_UPDATED' && data.sender_id !== user?.id) {
                fetchMessages(true);
            }
        };
        window.addEventListener('voxomate-ws-update', handleWsUpdate);

        // Relaxed fallback polling every 15s (WebSocket handleWsUpdate handles real-time updates)
        const interval = setInterval(() => {
            fetchMessages(true);
        }, 15000);

        return () => {
            window.removeEventListener('voxomate-ws-update', handleWsUpdate);
            clearInterval(interval);
        };
    }, [user?.id]);

    // Scroll to bottom when messages load or a new message is added
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        try {
            const res = await api.post('/discussion/', { content: inputText.trim() });
            setMessages(prev => [...prev, res.data]);
            setInputText('');
            showToast('Message posted successfully!');
        } catch (err) {
            showToast(err.response?.data?.detail || 'Failed to send message', 'error');
        }
    };

    const handleStartEdit = (msg) => {
        setEditingMsg(msg.id);
        setEditText(msg.content);
    };

    const handleSaveEdit = async (msgId) => {
        if (!editText.trim()) return;
        try {
            const res = await api.patch(`/discussion/${msgId}`, { content: editText.trim() });
            setMessages(prev => prev.map(m => m.id === msgId ? res.data : m));
            setEditingMsg(null);
            setEditText('');
            showToast('Message updated!');
        } catch (err) {
            showToast(err.response?.data?.detail || 'Failed to edit message', 'error');
        }
    };

    const handleDelete = async (msgId) => {
        if (!window.confirm('Are you sure you want to delete this message?')) return;
        try {
            await api.delete(`/discussion/${msgId}`);
            setMessages(prev => prev.filter(m => m.id !== msgId));
            showToast('Message deleted!');
        } catch (err) {
            showToast(err.response?.data?.detail || 'Failed to delete message', 'error');
        }
    };

    const getRoleLabel = (tier) => {
        if (tier === 1) return 'Admin';
        if (tier === 2) return 'Dept Head';
        return 'Staff';
    };

    return (
        <div className="content-area discussion-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', padding: '24px' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Page Header */}
            <div className="page-header clay-card" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={20} className="text-secondary" style={{ color: 'var(--accent)' }} />
                        Agency Discussion Room
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Collaborate and share updates with the entire team in real-time</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }} className="mac-window-controls">
                    <span className="mac-dot mac-close" />
                    <span className="mac-dot mac-minimize" />
                    <span className="mac-dot mac-maximize" />
                </div>
            </div>

            {/* Chat Body */}
            <div className="clay-card glass-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
                <div style={{ flexGrow: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <p style={{ color: 'var(--text-muted)' }}>Loading discussion history...</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)' }}>
                            <div style={{ padding: '16px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }}>
                                <ShieldAlert size={36} />
                            </div>
                            <p>No messages. Start the conversation!</p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isMine = msg.user?.id === user?.id;
                            const userInitials = `${msg.user?.first_name?.[0] ?? ''}${msg.user?.last_name?.[0] ?? ''}`.toUpperCase();
                            const isEditing = editingMsg === msg.id;

                            return (
                                <div key={msg.id} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', gap: '12px', alignItems: 'flex-start', maxWidth: '80%', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>

                                    {/* Avatar */}
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: isMine ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)' : 'var(--surface-3)',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '700',
                                        fontSize: '0.9rem',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                        flexShrink: 0
                                    }}>
                                        {userInitials}
                                    </div>

                                    {/* Bubble Core */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                                        {/* Meta Header */}
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--text)' }}>
                                                {msg.user?.first_name} {msg.user?.last_name}
                                            </span>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '2px 8px',
                                                borderRadius: '99px',
                                                background: msg.user?.role_tier === 1 ? 'rgba(239, 68, 68, 0.15)' : msg.user?.role_tier === 2 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                color: msg.user?.role_tier === 1 ? '#ef4444' : msg.user?.role_tier === 2 ? '#f59e0b' : '#3b82f6',
                                                fontWeight: 600
                                            }}>
                                                {getRoleLabel(msg.user?.role_tier)}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        {/* Text Bubble */}
                                        <div className={isMine ? 'message-mine' : 'message-other'} style={{ padding: '12px 16px', wordBreak: 'break-word', border: '1px solid rgba(255,255,255,0.03)' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
                                                    <textarea
                                                        value={editText}
                                                        onChange={(e) => setEditText(e.target.value)}
                                                        rows={2}
                                                        style={{
                                                            width: '100%',
                                                            background: 'rgba(0,0,0,0.2)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: 'var(--r-sm)',
                                                            color: '#fff',
                                                            padding: '8px',
                                                            fontFamily: 'inherit',
                                                            resize: 'none'
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                                        <button onClick={() => setEditingMsg(null)} className="btn btn-ghost btn-xs" style={{ color: '#fff', opacity: 0.8 }} title="Cancel">
                                                            <X size={14} />
                                                        </button>
                                                        <button onClick={() => handleSaveEdit(msg.id)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', display: 'flex', alignItems: 'center' }} title="Save">
                                                            <Check size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.95rem' }}>{msg.content}</p>
                                            )}
                                        </div>

                                        {/* Row Actions (Edit/Delete) */}
                                        {!isEditing && (isMine || (user?.role_tier && user.role_tier <= 2)) && (
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px', opacity: 0.7 }} className="msg-action-bar">
                                                {isMine && (
                                                    <button onClick={() => handleStartEdit(msg)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px' }} title="Edit message">
                                                        <Edit3 size={11} /> <span style={{ fontSize: '0.65rem' }}>Edit</span>
                                                    </button>
                                                )}
                                                {(isMine || user?.role_tier <= 2) && (
                                                    <button onClick={() => handleDelete(msg.id)} style={{ background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px' }} title="Delete message">
                                                        <Trash2 size={11} /> <span style={{ fontSize: '0.65rem' }}>Delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Controls */}
                <form onSubmit={handleSend} className="discussion-input-area" style={{ display: 'flex', gap: '12px', padding: '16px 12px 4px', borderTop: '1px solid var(--border)' }}>
                    <input
                        type="text"
                        placeholder="Type your message here... press Enter to send"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        style={{
                            flexGrow: 1,
                            background: 'var(--surface-3)',
                            border: '1px solid var(--border)',
                            borderRadius: '99px',
                            color: 'var(--text)',
                            padding: '12px 24px',
                            fontSize: '0.95rem',
                            outline: 'none',
                        }}
                    />
                    <button type="submit" className="clay-btn" style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Send size={18} style={{ marginRight: '6px' }} /> Send
                    </button>
                </form>
            </div>
        </div>
    );
}
