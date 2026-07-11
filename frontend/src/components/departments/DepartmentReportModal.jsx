import { useState, useEffect } from 'react';
import { deptService } from '../../services/taskService';
import { Spinner, EmptyState } from '../ui/Shared';
import { X, BarChart2, TrendingUp, AlertTriangle } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend
} from 'recharts';

export default function DepartmentReportModal({ id, name, onClose }) {
    const [report, setReport] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            try {
                const res = await deptService.monthlyReport(id);
                setReport(res.data);
            } catch (err) {
                setError(err.response?.data?.detail ?? 'Failed to load report data');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [id]);

    return (
        <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }}>
            <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, width: '90%' }}>
                <div className="modal-header">
                    <h3>📊 Report: {name}</h3>
                    <button className="modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div style={{ padding: '60px 0' }}><Spinner /></div>
                    ) : error ? (
                        <div className="login-error" style={{ margin: '20px 0' }}>{error}</div>
                    ) : report.length === 0 ? (
                        <EmptyState message="No monthly report data available." />
                    ) : (
                        <div>
                            {/* Summary cards row */}
                            <div className="stats-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                                <div className="stat-card" style={{ '--accent': '#6366f1' }}>
                                    <div className="stat-value" style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <BarChart2 size={20} />
                                        {report.reduce((sum, r) => sum + r.volume, 0)}
                                    </div>
                                    <div className="stat-label">Total Task Volume (Past 6 Months)</div>
                                </div>
                                <div className="stat-card" style={{ '--accent': '#10b981' }}>
                                    <div className="stat-value" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <TrendingUp size={20} />
                                        {(report.reduce((sum, r) => sum + r.avg_progress, 0) / (report.length || 1)).toFixed(1)}%
                                    </div>
                                    <div className="stat-label">Avg. Progress (Past 6 Months)</div>
                                </div>
                                <div className="stat-card" style={{ '--accent': '#f97316' }}>
                                    <div className="stat-value" style={{ color: '#f97316', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <AlertTriangle size={20} />
                                        {report.reduce((sum, r) => sum + r.overdue, 0)}
                                    </div>
                                    <div className="stat-label">Total Overdue Flags</div>
                                </div>
                            </div>

                            {/* Charts Visualization */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
                                <div className="chart-card">
                                    <p className="chart-title">Monthly Task Scopes & Overdues</p>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart data={report} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                            <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--surface-2)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 8,
                                                }}
                                            />
                                            <Legend formatter={(v) => <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{v}</span>} />
                                            <Bar dataKey="volume" name="Task Volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="overdue" name="Overdue Tasks" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="chart-card">
                                    <p className="chart-title">Avg. Progress Trend (%)</p>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <LineChart data={report} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                            <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={[0, 100]} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--surface-2)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 8,
                                                }}
                                            />
                                            <Legend formatter={(v) => <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{v}</span>} />
                                            <Line type="monotone" dataKey="avg_progress" name="Avg Progress" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Aggregated Data Table */}
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th>Task Volume</th>
                                            <th>Completed</th>
                                            <th>Avg Progress</th>
                                            <th>Overdue Count</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.map(r => (
                                            <tr key={r.month}>
                                                <td style={{ fontWeight: 600 }}>{r.month}</td>
                                                <td>{r.volume}</td>
                                                <td>{r.completed}</td>
                                                <td>
                                                    <div className="dept-row-bar">
                                                        <div className="dept-row-fill" style={{ width: `${r.avg_progress}%` }} />
                                                    </div>
                                                    <span style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>{r.avg_progress}%</span>
                                                </td>
                                                <td style={{ color: r.overdue > 0 ? '#ef4444' : 'inherit', fontWeight: r.overdue > 0 ? 600 : 'normal' }}>
                                                    {r.overdue}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onClose}>Close Report</button>
                </div>
            </div>
        </div>
    );
}
