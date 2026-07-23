import { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, ClipboardList, X } from 'lucide-react';
import { notificationService } from '../../services/taskService';

export default function NotificationBell({ align = 'right' }) {
    const [notifications, setNotifications] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef(null);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await notificationService.list();
            setNotifications(res.data);
        } catch {
            // silently fail — user may not have permission yet on first load
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 2 * 60 * 1000); // fallback polling every 2 min

        const handleWsUpdate = (e) => {
            const data = e.detail;
            if (data.type === 'TASK_CREATED' || data.type === 'TASK_UPDATED') {
                fetchNotifications();
            }
        };
        window.addEventListener('voxomate-ws-update', handleWsUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('voxomate-ws-update', handleWsUpdate);
        };
    }, []);

    // Click outside to close
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const unread = notifications.length;

    return (
        <div style={{ position: 'relative' }} ref={panelRef}>
            <button
                id="notification-bell-btn"
                className="btn btn-ghost btn-icon"
                onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
                aria-label={`Notifications — ${unread} unread`}
                style={{ position: 'relative' }}
            >
                <Bell size={20} />
                {unread > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: 2, right: 2,
                        width: 16, height: 16,
                        borderRadius: '50%',
                        background: 'var(--error, #ff4757)',
                        color: '#fff',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        display: 'grid',
                        placeItems: 'center',
                        lineHeight: 1,
                    }}>
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="notification-bell-panel"
                    style={{
                        position: align === 'left' ? 'fixed' : 'absolute',
                        top: align === 'left' ? 16 : 'calc(100% + 10px)',
                        left: align === 'left' ? 256 : 'auto',
                        right: align === 'right' ? 0 : 'auto',
                        width: 340,
                        maxHeight: 480,
                        overflowY: 'auto',
                        background: 'rgba(28, 28, 33, 0.96)',
                        border: '2px solid var(--accent, #8b5cf6)',
                        borderRadius: 16,
                        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), 0 0 20px rgba(139, 92, 246, 0.2)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        zIndex: 9999,
                    }}
                >
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--border, rgba(255,255,255,0.05))',
                    }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
                        <button
                            className="btn btn-ghost btn-icon"
                            style={{ padding: 4 }}
                            onClick={() => setOpen(false)}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Body */}
                    {loading ? (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                            Loading…
                        </div>
                    ) : notifications.length === 0 ? (
                        <div style={{
                            padding: 32, textAlign: 'center',
                            color: 'var(--text-muted)', fontSize: '0.85rem'
                        }}>
                            <Bell size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                            <p style={{ margin: 0 }}>All clear! No pending alerts.</p>
                        </div>
                    ) : (
                        <div>
                            {notifications.map((n) => (
                                <div key={n.id} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 12,
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border, rgba(255,255,255,0.05))',
                                    transition: 'background 0.2s',
                                    cursor: 'default',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                        background: n.type === 'overdue' ? 'rgba(255,71,87,0.15)' : 'rgba(124,109,250,0.15)',
                                        display: 'grid', placeItems: 'center',
                                        marginTop: 2,
                                    }}>
                                        {n.type === 'overdue'
                                            ? <AlertTriangle size={16} color="#ff4757" />
                                            : <ClipboardList size={16} color="#7c6dfa" />
                                        }
                                    </div>

                                    {/* Text */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            margin: 0, fontSize: '0.82rem', fontWeight: 600,
                                            color: 'var(--text)',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {n.task_title}
                                        </p>
                                        <p style={{
                                            margin: '2px 0 0 0', fontSize: '0.75rem',
                                            color: 'var(--text-muted)',
                                        }}>
                                            {n.message}
                                        </p>
                                        {n.brand_label && n.brand_label !== 'N/A' && (
                                            <span style={{
                                                fontSize: '0.7rem', marginTop: 4, display: 'inline-block',
                                                background: 'var(--accent-glow, rgba(139,92,206,0.15))',
                                                color: 'var(--accent-light)',
                                                padding: '1px 6px', borderRadius: 99,
                                            }}>
                                                {n.brand_label}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
