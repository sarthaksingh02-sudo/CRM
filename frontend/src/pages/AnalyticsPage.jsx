import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { taskService } from '../services/taskService';
import api from '../services/api';
import { Spinner } from '../components/ui/Shared';
import { Download } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar
} from 'recharts';

const COLORS = {
    completed: '#10b981',
    in_progress: '#3b82f6',
    overdue: '#f97316',
    yet_to_start: '#64748b',
    in_review: '#f59e0b',
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
        return (
            <div style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', fontSize: '.8rem'
            }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{label}</p>
                {payload.map(p => (
                    <p key={p.name} style={{ color: p.fill ?? p.color }}>
                        {p.name}: <strong>{p.value}</strong>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function AnalyticsPage() {
    const { user } = useAuth();
    const [deptMetrics, setDeptMetrics] = useState([]);
    const [personal, setPersonal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [auditStart, setAuditStart] = useState('');
    const [auditEnd, setAuditEnd] = useState('');
    const [exportingAudit, setExportingAudit] = useState(false);

    const handleExportAudit = async () => {
        try {
            setExportingAudit(true);
            let url = '/tasks/audit/export/csv';
            const params = [];
            if (auditStart) params.push(`start_date=${auditStart}`);
            if (auditEnd) params.push(`end_date=${auditEnd}`);
            if (params.length > 0) {
                url += '?' + params.join('&');
            }
            const response = await api.get(url, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'text/csv' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Failed to export audit logs:', err);
        } finally {
            setExportingAudit(false);
        }
    };

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const [pm] = await Promise.all([taskService.personalMetrics()]);
                setPersonal(pm.data);
                if (user?.role_tier <= 2) {
                    const dm = await taskService.deptMetrics();
                    setDeptMetrics(dm.data);
                }
            } catch { /* handled */ }
            finally { setLoading(false); }
        };
        fetchAll();
    }, [user]);

    if (loading) return <Spinner />;

    // Prepare chart data
    const barData = deptMetrics.map(d => ({
        name: d.department_name.length > 12 ? d.department_name.slice(0, 12) + '…' : d.department_name,
        Completed: d.completed,
        'In Progress': d.in_progress,
        Overdue: d.overdue,
        Total: d.total_tasks,
    }));

    const avgProgressData = deptMetrics.map(d => ({
        name: d.department_name,
        value: d.avg_progress,
        fill: COLORS.in_progress,
    }));

    const pieData = personal ? [
        { name: 'Completed', value: personal.completed, color: COLORS.completed },
        { name: 'In Progress', value: personal.in_progress, color: COLORS.in_progress },
        { name: 'In Review', value: personal.in_review, color: COLORS.in_review },
        { name: 'Overdue', value: personal.overdue, color: COLORS.overdue },
    ].filter(d => d.value > 0) : [];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Analytics</h2>
                    <p>Performance metrics and task health</p>
                </div>
            </div>

            <div className="content-area">
                {/* Personal stat cards */}
                {personal && (
                    <div className="stats-grid" style={{ marginBottom: 28 }}>
                        {[
                            { label: 'Total Assigned', value: personal.total_assigned, color: '#6366f1' },
                            { label: 'Completed', value: personal.completed, color: '#10b981' },
                            { label: 'In Progress', value: personal.in_progress, color: '#3b82f6' },
                            { label: 'In Review', value: personal.in_review, color: '#f59e0b' },
                            { label: 'Overdue', value: personal.overdue, color: '#f97316' },
                            { label: 'Avg Progress', value: `${personal.avg_progress}%`, color: '#818cf8' },
                        ].map(s => (
                            <div key={s.label} className="stat-card" style={{ '--accent': s.color }}>
                                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                                <div className="stat-label">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Charts */}
                <div className="charts-grid">
                    {/* Personal task breakdown pie */}
                    {pieData.length > 0 && (
                        <div className="chart-card">
                            <p className="chart-title">My Task Breakdown</p>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={110}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--surface-2)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 8,
                                            fontSize: '.8rem',
                                        }}
                                    />
                                    <Legend
                                        formatter={(value) => <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Departmental bar chart */}
                    {barData.length > 0 && (
                        <div className="chart-card">
                            <p className="chart-title">Departmental Task Volume</p>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        formatter={(v) => <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{v}</span>}
                                    />
                                    <Bar dataKey="Completed" fill={COLORS.completed} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="In Progress" fill={COLORS.in_progress} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Overdue" fill={COLORS.overdue} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Average progress radial chart */}
                    {avgProgressData.length > 0 && (
                        <div className="chart-card">
                            <p className="chart-title">Avg Progress by Department</p>
                            <ResponsiveContainer width="100%" height={280}>
                                <RadialBarChart
                                    cx="50%" cy="50%"
                                    innerRadius={30} outerRadius={110}
                                    data={avgProgressData}
                                >
                                    <RadialBar
                                        dataKey="value"
                                        background={{ fill: 'var(--surface-3)' }}
                                        label={{ position: 'insideStart', fill: 'var(--text)', fontSize: 11 }}
                                    />
                                    <Tooltip
                                        formatter={(v, n, p) => [`${v}%`, p.payload.name]}
                                        contentStyle={{
                                            background: 'var(--surface-2)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 8,
                                            fontSize: '.8rem',
                                        }}
                                    />
                                </RadialBarChart>
                            </ResponsiveContainer>

                            {/* Progress table beneath chart */}
                            <div className="table-wrap" style={{ marginTop: 16 }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Department</th>
                                            <th>Total</th>
                                            <th>Overdue</th>
                                            <th>Avg Progress</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deptMetrics.map(d => (
                                            <tr key={d.department_id}>
                                                <td style={{ fontWeight: 600 }}>{d.department_name}</td>
                                                <td>{d.total_tasks}</td>
                                                <td style={{ color: d.overdue > 0 ? 'var(--c-overdue)' : 'var(--text-muted)' }}>
                                                    {d.overdue}
                                                </td>
                                                <td>
                                                    <div className="dept-row-bar">
                                                        <div className="dept-row-fill" style={{ width: `${d.avg_progress}%` }} />
                                                    </div>
                                                    <span style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>{d.avg_progress}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {user?.role_tier <= 2 && (
                    <div className="card" style={{ marginTop: 28 }}>
                        <p className="chart-title">Export Day-Wise Audit Logs</p>
                        <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                            Download a CSV export of all audit logs. Department heads only see logs for tasks within their department.
                        </p>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div>
                                <label className="form-label">Start Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={auditStart}
                                    onChange={e => setAuditStart(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form-label">End Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={auditEnd}
                                    onChange={e => setAuditEnd(e.target.value)}
                                />
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleExportAudit}
                                disabled={exportingAudit}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Download size={14} /> {exportingAudit ? 'Exporting...' : 'Export Audit Logs (CSV)'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
