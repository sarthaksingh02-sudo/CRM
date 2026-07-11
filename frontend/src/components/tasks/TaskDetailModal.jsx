import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { X, MessageSquare, Paperclip, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { taskService } from '../../services/taskService';
import { StatusBadge, PriorityBadge, ProgressBar, Spinner, Toast } from '../ui/Shared';

const STATUS_FLOW = {
    yet_to_start: { label: 'Start Task', action: 'start', tier: 3, next: 'in_progress' },
    in_progress: { label: 'Submit for Review', action: 'review', tier: 3, next: 'in_review' },
    in_review: { label: 'Review Decision', action: 'decision', tier: 2, next: null },
};

export default function TaskDetailModal({ task: initialTask, onClose, onRefresh }) {
    const { user } = useAuth();
    const [task, setTask] = useState(initialTask);
    const [comments, setComments] = useState([]);
    const [auditLog, setAuditLog] = useState([]);
    const [tab, setTab] = useState('details'); // details | comments | audit
    const [newComment, setNewComment] = useState('');
    const [progress, setProgress] = useState(task.progress_percentage);
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);

    // Review decision state
    const [decision, setDecision] = useState('');
    const [reworkProgress, setReworkProgress] = useState(75);
    const [reworkComment, setReworkComment] = useState('');

    const isAssignee = user?.id === task.assigned_to;
    const isCoAssignee = task.co_assignees?.some(u => u.id === user?.id) || false;
    const isAssigned = isAssignee || isCoAssignee;
    const canProgress = user?.role_tier <= 3 && task.status === 'in_progress' && isAssigned;
    const canDelete = user?.role_tier === 1 || (user?.role_tier === 2 && user.department_id === task.department_id);

    useEffect(() => {
        taskService.getComments(task.id).then(r => setComments(r.data)).catch(() => { });
        if (user?.role_tier <= 2) {
            taskService.getAuditLog(task.id).then(r => setAuditLog(r.data)).catch(() => { });
        }
    }, [task.id, user]);

    const handleDeleteTask = async () => {
        if (!window.confirm('Are you sure you want to permanently delete this task?')) return;
        try {
            setLoading(true);
            await taskService.delete(task.id);
            showToast('Task deleted successfully');
            setTimeout(() => {
                onRefresh?.();
                onClose();
            }, 1000);
        } catch (e) {
            showToast(e.response?.data?.detail ?? 'Failed to delete task', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const refreshTask = async () => {
        const res = await taskService.get(task.id);
        setTask(res.data);
        setProgress(res.data.progress_percentage);
    };

    const handleStart = async () => {
        try {
            await taskService.start(task.id);
            await refreshTask();
            showToast('Task started!');
        } catch (e) {
            showToast(e.response?.data?.detail ?? 'Error', 'error');
        }
    };

    const handleSubmitReview = async () => {
        try {
            await taskService.submitReview(task.id);
            await refreshTask();
            showToast('Submitted for review!');
        } catch (e) {
            showToast(e.response?.data?.detail ?? 'Error', 'error');
        }
    };

    const handleProgressSave = async () => {
        try {
            setLoading(true);
            await taskService.updateProgress(task.id, progress);
            await refreshTask();
            showToast('Progress updated!');
        } catch (e) {
            showToast(e.response?.data?.detail ?? 'Error', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDecision = async () => {
        if (!decision) return;
        try {
            setLoading(true);
            await taskService.reviewDecision(task.id, {
                status: decision,
                ...(decision === 'rework' ? { rework_progress: reworkProgress, rework_comment: reworkComment } : {}),
            });
            await refreshTask();
            showToast(decision === 'completed' ? 'Task completed! 🎉' : 'Rework initiated');
            onRefresh?.();
        } catch (e) {
            showToast(e.response?.data?.detail ?? 'Error', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        try {
            await taskService.addComment(task.id, newComment);
            const res = await taskService.getComments(task.id);
            setComments(res.data);
            setNewComment('');
        } catch (e) {
            showToast('Failed to post comment', 'error');
        }
    };

    const fmt = (d) => {
        if (!d) return '—';
        let clean = d;
        if (typeof clean === 'string') {
            if (!clean.endsWith('Z') && !clean.includes('+') && !clean.match(/[-+]\d{2}:?\d{2}$/)) {
                clean = clean.includes('T') ? clean + 'Z' : clean.replace(' ', 'T') + 'Z';
            }
            return format(parseISO(clean), 'dd MMM yyyy, HH:mm');
        }
        return format(clean, 'dd MMM yyyy, HH:mm');
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: 720 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{task.brand_name} · {task.title}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Badges row */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    {task.is_overdue && <span className="badge badge-overdue">OVERDUE</span>}
                </div>

                {/* Progress bar */}
                <ProgressBar value={task.progress_percentage} status={task.status} isOverdue={task.is_overdue} />

                {/* Progress Slide — only for assignee in progress */}
                {canProgress && (
                    <div style={{ margin: '16px 0', padding: '14px', background: 'var(--surface-3)', borderRadius: 'var(--r-sm)' }}>
                        <label className="form-label">Slide Progress: {progress}%</label>
                        <input
                            type="range"
                            className="progress-slider"
                            min={1} max={99}
                            value={progress}
                            onChange={e => setProgress(Number(e.target.value))}
                            style={{ marginBottom: 8 }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleProgressSave} disabled={loading}>
                            Save Progress
                        </button>
                    </div>
                )}

                {/* State machine actions */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {(task.status === 'yet_to_start' || task.status === 'rework') && isAssigned && (
                            <button className="btn btn-primary" onClick={handleStart}>▶ Start Task</button>
                        )}
                        {task.status === 'in_progress' && isAssigned && (
                            <button className="btn btn-success" onClick={handleSubmitReview}>
                                <ChevronRight size={14} /> Submit for Review
                            </button>
                        )}
                        {task.status === 'in_review' && user?.role_tier <= 2 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div>
                                    <label className="form-label">Decision</label>
                                    <select
                                        className="form-select"
                                        value={decision}
                                        onChange={e => setDecision(e.target.value)}
                                        style={{ width: 'auto' }}
                                    >
                                        <option value="">Choose…</option>
                                        <option value="completed">✅ Complete</option>
                                        <option value="rework">🔄 Rework</option>
                                    </select>
                                </div>
                                {decision === 'rework' && (
                                    <>
                                        <div>
                                            <label className="form-label">Reset to %</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                min={0} max={99}
                                                value={reworkProgress}
                                                onChange={e => setReworkProgress(Number(e.target.value))}
                                                style={{ width: 80 }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="form-label">Rework Notes *</label>
                                            <input
                                                className="form-input"
                                                value={reworkComment}
                                                onChange={e => setReworkComment(e.target.value)}
                                                placeholder="Mandatory feedback…"
                                            />
                                        </div>
                                    </>
                                )}
                                <button
                                    className={`btn ${decision === 'completed' ? 'btn-success' : 'btn-danger'}`}
                                    onClick={handleDecision}
                                    disabled={!decision || loading}
                                >
                                    Submit Decision
                                </button>
                            </div>
                        )}
                    </div>

                    {canDelete && (
                        <button className="btn btn-danger" onClick={handleDeleteTask} disabled={loading} style={{ background: '#ef4444' }}>
                            🗑️ Delete Task
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                    {['details', 'comments', ...(user?.role_tier <= 2 ? ['audit'] : [])].map(t => (
                        <button
                            key={t}
                            className="btn btn-ghost btn-sm"
                            style={{
                                borderRadius: '6px 6px 0 0',
                                borderBottom: tab === t ? '2px solid var(--accent)' : 'none',
                                color: tab === t ? 'var(--accent-light)' : undefined
                            }}
                            onClick={() => setTab(t)}
                        >
                            {t === 'comments' && <MessageSquare size={13} style={{ marginRight: 4 }} />}
                            {t === 'audit' && <Clock size={13} style={{ marginRight: 4 }} />}
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Tab: Details */}
                {tab === 'details' && (
                    <div className="detail-grid">
                        <div className="detail-item"><label>Assigned To</label><p>{task.assignee?.first_name} {task.assignee?.last_name}</p></div>
                        <div className="detail-item">
                            <label>Co-Assignees</label>
                            <p>
                                {task.co_assignees && task.co_assignees.length > 0
                                    ? task.co_assignees.map(u => `${u.first_name} ${u.last_name}`).join(', ')
                                    : 'None'}
                            </p>
                        </div>
                        <div className="detail-item"><label>Assigned By</label><p>{task.assigner?.first_name} {task.assigner?.last_name}</p></div>
                        <div className="detail-item"><label>Department</label><p>{task.department?.name ?? '—'}</p></div>
                        <div className="detail-item"><label>Priority</label><PriorityBadge priority={task.priority} /></div>
                        <div className="detail-item"><label>Due Date (immutable)</label><p style={{ color: task.is_overdue ? 'var(--c-overdue)' : undefined }}>{fmt(task.due_date)}</p></div>
                        <div className="detail-item"><label>Expected Delivery</label><p>{fmt(task.expected_delivery)}</p></div>
                        {task.description && (
                            <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                                <label>Description</label>
                                <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{task.description}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Comments */}
                {tab === 'comments' && (
                    <div>
                        <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 14 }}>
                            {comments.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>No comments yet.</p>}
                            {comments.map(c => (
                                <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                    <p style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                        <strong style={{ color: 'var(--text)' }}>{c.user?.first_name} {c.user?.last_name}</strong>
                                        {' · '}{fmt(c.created_at)}
                                    </p>
                                    <p style={{ fontSize: '.85rem' }}>{c.content}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                className="form-input"
                                placeholder="Add a comment…"
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                            />
                            <button className="btn btn-primary btn-sm" onClick={handleAddComment}>Post</button>
                        </div>
                    </div>
                )}

                {/* Tab: Audit Log */}
                {tab === 'audit' && (
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        {auditLog.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>No audit entries.</p>}
                        {auditLog.map(a => (
                            <div key={a.id} className="audit-item">
                                <div className="audit-dot" />
                                <div>
                                    <p className="audit-action">{a.action_type}</p>
                                    <p className="audit-meta">
                                        {a.old_value && `${a.old_value} → ${a.new_value} · `}
                                        {fmt(a.created_at)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
