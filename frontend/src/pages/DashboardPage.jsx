import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { taskService } from '../services/taskService';
import { Spinner, EmptyState } from '../components/ui/Shared';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    CheckCircle, Clock, AlertTriangle, TrendingUp,
    ClipboardList, Users
} from 'lucide-react';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#64748b'];

export default function DashboardPage() {
    const { user } = useAuth();
    const [personal, setPersonal] = useState(null);
    const [deptMetrics, setDeptMetrics] = useState([]);
    const [recentTasks, setRecentTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAlert, setShowAlert] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const [pm, tasks] = await Promise.all([
                taskService.personalMetrics(),
                taskService.list({ status_filter: 'in_progress' }),
            ]);
            setPersonal(pm.data);
            setRecentTasks(tasks.data.slice(0, 6));
            if (pm.data.overdue > 0) {
                setShowAlert(true);
            }
            if (user?.role_tier <= 2) {
                const dm = await taskService.deptMetrics();
                setDeptMetrics(dm.data);
            }
        } catch { /* handled */ }
        finally { setLoading(false); }
    }, [user]);

    useEffect(() => { fetch(); }, [fetch]);

    if (loading) return <Spinner />;

    const statCards = personal
        ? [
            { label: 'Total Tasks', value: personal.total_assigned, icon: <ClipboardList size={20} />, color: '#6366f1' },
            { label: 'Completed', value: personal.completed, icon: <CheckCircle size={20} />, color: '#10b981' },
            { label: 'In Progress', value: personal.in_progress, icon: <TrendingUp size={20} />, color: '#3b82f6' },
            { label: 'In Review', value: personal.in_review, icon: <Clock size={20} />, color: '#f59e0b' },
            { label: 'Overdue', value: personal.overdue, icon: <AlertTriangle size={20} />, color: '#f97316' },
            { label: 'Avg Progress', value: `${personal.avg_progress}%`, icon: <Users size={20} />, color: '#818cf8' },
        ]
        : [];

    const pieData = personal
        ? [
            { name: 'Completed', value: personal.completed },
            { name: 'In Progress', value: personal.in_progress },
            { name: 'In Review', value: personal.in_review },
            { name: 'Overdue', value: personal.overdue },
            { name: 'Yet to Start', value: personal.total_assigned - personal.completed - personal.in_progress - personal.in_review },
        ].filter(d => d.value > 0)
        : [];

    const barData = deptMetrics.map(d => ({
        dept: d.department_name.slice(0, 10),
        completed: d.completed,
        in_progress: d.in_progress,
        overdue: d.overdue,
    }));

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Welcome back, {user?.first_name} 👋</h2>
                    <p>Here's your task overview for today</p>
                </div>
            </div>

            <div className="content-area">
                {/* Stat cards */}
                <div className="stats-grid">
                    {statCards.map(s => (
                        <div key={s.label} className="stat-card">
                            <div className="stat-icon" style={{ background: `${s.color}22`, color: s.color }}>
                                {s.icon}
                            </div>
                            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Charts */}
                <div className="charts-grid">
                    {pieData.length > 0 && (
                        <div className="chart-card">
                            <p className="chart-title">My Task Distribution</p>
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" paddingAngle={3}>
                                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '.8rem' }}
                                    />
                                    <Legend formatter={v => <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{v}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {barData.length > 0 && (
                        <div className="chart-card">
                            <p className="chart-title">Department Overview</p>
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="dept" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '.8rem' }}
                                    />
                                    <Legend formatter={v => <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{v}</span>} />
                                    <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="in_progress" name="In Progress" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="overdue" name="Overdue" fill="#f97316" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Active Tasks */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '.85rem' }}>
                        🔄 Active Tasks
                    </div>
                    {recentTasks.length === 0 ? (
                        <EmptyState message="No tasks in progress" />
                    ) : (
                        <div style={{ padding: '4px 0' }}>
                            {recentTasks.map(t => (
                                <div key={t.id} style={{
                                    padding: '12px 20px',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto auto',
                                    gap: 16,
                                    alignItems: 'center',
                                }}>
                                    <div>
                                        <p style={{ fontSize: '.68rem', color: 'var(--accent-light)', fontWeight: 600, marginBottom: 2 }}>{t.brand_name}</p>
                                        <p style={{ fontWeight: 600, fontSize: '.875rem' }}>{t.title}</p>
                                        <p style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>
                                            {t.assignee?.first_name} {t.assignee?.last_name} · {t.department?.name}
                                        </p>
                                    </div>
                                    <div style={{ minWidth: 120 }}>
                                        <div className="progress-wrap">
                                            <div className="progress-bar" style={{ width: `${t.progress_percentage}%` }} />
                                        </div>
                                        <span style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>{t.progress_percentage}%</span>
                                    </div>
                                    <div>
                                        <span className={`badge badge-${t.priority}`}>{t.priority}</span>
                                        {t.is_overdue && <span className="badge badge-overdue" style={{ marginLeft: 4 }}>overdue</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showAlert && (
                <div className="notification-alert" style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    zIndex: 1000,
                    maxWidth: '400px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    borderColor: '#ef4444',
                    borderStyle: 'solid',
                    borderWidth: '1px',
                    padding: '16px',
                    borderRadius: 'var(--r-md)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={{ fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={18} /> Urgent Overdue Alert
                        </span>
                        <button onClick={() => setShowAlert(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1rem', cursor: 'pointer' }}>×</button>
                    </div>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>
                        Hi {user?.first_name}, you have <strong>{personal?.overdue}</strong> task(s) currently marked as overdue. Please review them and update their progress.
                    </p>
                </div>
            )}
        </div>
    );
}
