import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { taskService } from '../services/taskService';
import api from '../services/api';
import TaskCard from '../components/tasks/TaskCard';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import { Spinner, EmptyState, parseLocalOrUTC } from '../components/ui/Shared';
import { Plus, Search, Filter, Download } from 'lucide-react';
import { useEffect } from 'react';

const STATUSES = ['', 'yet_to_start', 'in_progress', 'in_review', 'completed', 'rework'];
const PRIORITIES = ['', 'low', 'medium', 'high'];

const COLUMNS = [
    { key: 'yet_to_start', label: 'Yet to Start', color: '#64748b' },
    { key: 'in_progress', label: 'In Progress', color: '#3b82f6' },
    { key: 'in_review', label: 'In Review', color: '#f59e0b' },
    { key: 'completed', label: 'Completed', color: '#10b981' },
    { key: 'rework', label: 'Rework', color: '#ef4444' },
];

export default function TasksPage() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [overdueOnly, setOverdueOnly] = useState(false);
    const [view, setView] = useState('board'); // board | list
    const [showCreate, setShowCreate] = useState(false);
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        try {
            setExporting(true);
            const response = await api.get('/tasks/export/csv', { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `tasks_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Failed to export tasks:', err);
        } finally {
            setExporting(false);
        }
    };

    const canCreate = user?.role_tier <= 2;

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status_filter = statusFilter;
            if (priorityFilter) params.priority_filter = priorityFilter;
            if (overdueOnly) params.overdue_only = true;
            const res = await taskService.list(params);
            setTasks(res.data);
        } catch { /* handled by interceptor */ }
        finally { setLoading(false); }
    }, [statusFilter, priorityFilter, overdueOnly]);

    useEffect(() => {
        fetchTasks();

        const handleWsUpdate = (e) => {
            const data = e.detail;
            if (data.type === 'TASK_CREATED' || data.type === 'TASK_UPDATED') {
                fetchTasks();
            }
        };
        window.addEventListener('voxomate-ws-update', handleWsUpdate);

        return () => {
            window.removeEventListener('voxomate-ws-update', handleWsUpdate);
        };
    }, [fetchTasks]);

    const filtered = tasks.filter(t =>
        !search ||
        (t.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.brand_name || '').toLowerCase().includes(search.toLowerCase())
    );

    const byStatus = (key) => filtered.filter(t => t.status === key);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Task Management</h2>
                    <p>{filtered.length} task{filtered.length !== 1 ? 's' : ''} visible</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className={`btn ${view === 'board' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                        onClick={() => setView('board')}
                    >Board</button>
                    <button
                        className={`btn ${view === 'list' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                        onClick={() => setView('list')}
                    >List</button>
                    <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Download size={14} /> {exporting ? 'Exporting...' : 'Export (CSV)'}
                    </button>
                    {canCreate && (
                        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                            <Plus size={16} /> New Task
                        </button>
                    )}
                </div>
            </div>

            <div className="content-area">
                {/* Filters */}
                <div className="filters">
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="search-input"
                            style={{ paddingLeft: 32 }}
                            placeholder="Search tasks…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="">All Statuses</option>
                        {STATUSES.slice(1).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <select className="filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
                        <option value="">All Priorities</option>
                        {PRIORITIES.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} />
                        Overdue only
                    </label>
                </div>

                {loading ? (
                    <Spinner />
                ) : view === 'board' ? (
                    /* ── Kanban Board ── */
                    <div className="board-columns">
                        {COLUMNS.map(col => (
                            <div key={col.key} className="board-column">
                                <div className="board-column-header">
                                    <div className="board-column-title">
                                        <div className="col-dot" style={{ background: col.color }} />
                                        {col.label}
                                    </div>
                                    <span style={{
                                        background: 'var(--surface-3)',
                                        padding: '2px 8px',
                                        borderRadius: 99,
                                        fontSize: '.7rem',
                                        fontWeight: 700
                                    }}>
                                        {byStatus(col.key).length}
                                    </span>
                                </div>
                                <div className="task-cards">
                                    {byStatus(col.key).length === 0
                                        ? <p style={{ color: 'var(--text-muted)', fontSize: '.75rem', textAlign: 'center', padding: '20px 0' }}>Empty</p>
                                        : byStatus(col.key).map(t => (
                                            <TaskCard key={t.id} task={t} onRefresh={fetchTasks} />
                                        ))
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* ── List View ── */
                    <div className="card" style={{ padding: 0 }}>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Brand / Title</th>
                                        <th>Status</th>
                                        <th>Priority</th>
                                        <th>Progress</th>
                                        <th>Assignee</th>
                                        <th>Due</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={6}><EmptyState message="No tasks match your filters" /></td></tr>
                                    ) : filtered.map(t => (
                                        <tr key={t.id}>
                                            <td>
                                                <p style={{ fontSize: '.65rem', color: 'var(--accent-light)', fontWeight: 600 }}>{t.brand_name}</p>
                                                <p style={{ fontWeight: 600 }}>{t.title}</p>
                                            </td>
                                            <td><span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span></td>
                                            <td><span className={`badge badge-${t.priority}`}>{t.priority}</span></td>
                                            <td style={{ minWidth: 140 }}>
                                                <div className="dept-row-bar">
                                                    <div className="dept-row-fill" style={{ width: `${t.progress_percentage}%` }} />
                                                </div>
                                                <span style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>{t.progress_percentage}%</span>
                                            </td>
                                            <td style={{ fontSize: '.8rem' }}>
                                                {t.assignee ? `${t.assignee.first_name} ${t.assignee.last_name}` : '—'}
                                            </td>
                                            <td style={{ fontSize: '.78rem', color: t.is_overdue ? 'var(--c-overdue)' : 'var(--text-muted)' }}>
                                                {t.is_overdue && '⚠ '}
                                                {t.expected_delivery ? parseLocalOrUTC(t.expected_delivery).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {showCreate && (
                <CreateTaskModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); fetchTasks(); }}
                />
            )}
        </div>
    );
}
