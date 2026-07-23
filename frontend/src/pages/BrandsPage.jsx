import { useState, useEffect } from 'react';
import { brandService, userService, deptService } from '../services/taskService';
import { useAuth } from '../context/AuthContext';
import { Spinner, EmptyState } from '../components/ui/Shared';
import {
    Plus, Tag, Globe, Trash2, X,
    Link, ChevronRight, ChevronDown, Users, Building2,
    CheckCircle, AlertCircle
} from 'lucide-react';

const InstagramIcon = ({ size = 14 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
);

const FacebookIcon = ({ size = 14 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
);

const PLATFORM_ICONS = {
    instagram: <InstagramIcon size={14} />,
    facebook: <FacebookIcon size={14} />,
    whatsapp: <Globe size={14} />,
};

const STATUS_STYLE = {
    active: { bg: 'rgba(46,213,115,.15)', color: '#2ed573' },
    inactive: { bg: 'rgba(255,71,87,.15)', color: '#ff4757' },
};

// ──────────────── AddBrandModal ────────────────
function AddBrandModal({ onClose, onCreated }) {
    const [form, setForm] = useState({ name: '', industry: '', status: 'active' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await brandService.create(form);
            onCreated?.();
        } catch (err) {
            setError(err.response?.data?.detail ?? 'Failed to create brand');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Add New Brand</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                {error && <div className="login-error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Brand Name *</label>
                        <input className="form-input" required value={form.name}
                            onChange={e => set('name', e.target.value)} placeholder="e.g. VoxoMate Official" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Industry</label>
                        <input className="form-input" value={form.industry}
                            onChange={e => set('industry', e.target.value)} placeholder="e.g. Technology, Retail…" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            <Plus size={15} /> {loading ? 'Creating…' : 'Create Brand'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ──────────────── AddSocialModal ────────────────
function AddSocialModal({ brandId, onClose, onAdded }) {
    const [form, setForm] = useState({ platform: 'instagram', platform_account_id: '', access_token: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await brandService.addSocialAccount(brandId, form);
            onAdded?.();
        } catch (err) {
            setError(err.response?.data?.detail ?? 'Failed to add account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Link Social Account</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                {error && <div className="login-error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Platform *</label>
                        <select className="form-select" value={form.platform} onChange={e => set('platform', e.target.value)}>
                            <option value="instagram">Instagram</option>
                            <option value="facebook">Facebook</option>
                            <option value="whatsapp">WhatsApp</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Platform Account ID (Meta Page/Profile ID) *</label>
                        <input className="form-input" required value={form.platform_account_id}
                            onChange={e => set('platform_account_id', e.target.value)}
                            placeholder="e.g. 123456789012345" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Access Token (optional)</label>
                        <input className="form-input" value={form.access_token}
                            onChange={e => set('access_token', e.target.value)}
                            placeholder="Meta Page Access Token…" />
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            <Link size={15} /> {loading ? 'Linking…' : 'Link Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ──────────────── AssignBrandModal ────────────────
function AssignBrandModal({ brandId, onClose, onAssigned }) {
    const [depts, setDepts] = useState([]);
    const [users, setUsers] = useState([]);
    const [form, setForm] = useState({ department_id: '', user_id: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        deptService.list().then(r => setDepts(r.data)).catch(() => { });
        userService.list({ active_only: true }).then(r => setUsers(r.data)).catch(() => { });
    }, []);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await brandService.addAssignment(brandId, {
                department_id: Number(form.department_id),
                user_id: Number(form.user_id),
            });
            onAssigned?.();
        } catch (err) {
            setError(err.response?.data?.detail ?? 'Failed to assign');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Assign Brand to Team</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                {error && <div className="login-error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Department *</label>
                        <select className="form-select" required value={form.department_id} onChange={e => set('department_id', e.target.value)}>
                            <option value="">— Select department —</option>
                            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Assigned Staff Member *</label>
                        <select className="form-select" required value={form.user_id} onChange={e => set('user_id', e.target.value)}>
                            <option value="">— Select staff —</option>
                            {users.map(u => {
                                const roleLabel = u.role_tier === 1 ? 'Admin' : u.role_tier === 2 ? 'Head' : 'Staff';
                                return (
                                    <option key={u.id} value={u.id}>
                                        {u.first_name} {u.last_name} ({roleLabel} - {u.department?.name ?? 'No Dept'})
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            <Users size={15} /> {loading ? 'Assigning…' : 'Assign'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ──────────────── BrandCard ────────────────
function BrandCard({ brand, onRefresh }) {
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [showSocial, setShowSocial] = useState(false);
    const [showAssign, setShowAssign] = useState(false);

    const loadDetail = async () => {
        if (detail) { setExpanded(e => !e); return; }
        setLoadingDetail(true);
        try {
            const r = await brandService.get(brand.id);
            setDetail(r.data);
            setExpanded(true);
        } catch { } finally {
            setLoadingDetail(false);
        }
    };

    const handleDeleteSocial = async (accountId) => {
        if (!confirm('Remove this social account?')) return;
        await brandService.removeSocialAccount(brand.id, accountId);
        const r = await brandService.get(brand.id);
        setDetail(r.data);
    };

    const handleDeleteAssignment = async (assignmentId) => {
        if (!confirm('Remove this assignment?')) return;
        await brandService.removeAssignment(brand.id, assignmentId);
        const r = await brandService.get(brand.id);
        setDetail(r.data);
    };

    const handleDeleteBrand = async () => {
        if (!confirm(`Delete brand "${brand.name}"? This cannot be undone.`)) return;
        await brandService.delete(brand.id);
        onRefresh?.();
    };

    const styles = STATUS_STYLE[brand.status] || STATUS_STYLE.active;

    return (
        <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
            {/* Brand Header Row */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 20px', cursor: 'pointer',
                borderBottom: expanded ? '1px solid var(--card-border)' : 'none',
            }} onClick={loadDetail}>
                {/* Icon */}
                <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: 'var(--accent-muted, rgba(124,109,250,.15))',
                    display: 'grid', placeItems: 'center',
                }}>
                    <Tag size={20} color="var(--accent)" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{brand.name}</span>
                        <span style={{
                            fontSize: '0.7rem', padding: '2px 8px', borderRadius: 99,
                            background: styles.bg, color: styles.color, fontWeight: 600,
                        }}>{brand.status}</span>
                    </div>
                    {brand.industry && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{brand.industry}</span>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {loadingDetail && <Spinner style={{ width: 20, height: 20 }} />}
                    <button
                        className="btn btn-danger btn-sm"
                        onClick={e => { e.stopPropagation(); handleDeleteBrand(); }}
                    >
                        <Trash2 size={13} />
                    </button>
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </div>

            {/* Expanded Detail */}
            {expanded && detail && (
                <div style={{ padding: '16px 20px' }}>
                    {/* Social Accounts */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Social Accounts
                            </h4>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowSocial(true)}>
                                <Link size={13} /> Link Account
                            </button>
                        </div>
                        {detail.social_accounts.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>No social accounts linked.</p>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {detail.social_accounts.map(acc => (
                                    <div key={acc.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        background: 'var(--sidebar-hover)', borderRadius: 8,
                                        padding: '4px 10px 4px 8px', fontSize: '0.78rem',
                                    }}>
                                        {PLATFORM_ICONS[acc.platform]}
                                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{acc.platform}</span>
                                        <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                            {acc.platform_account_id}
                                        </span>
                                        <button
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 0 }}
                                            onClick={() => handleDeleteSocial(acc.id)}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Assignments */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Team Assignments
                            </h4>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowAssign(true)}>
                                <Users size={13} /> Assign
                            </button>
                        </div>
                        {detail.assignments.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>No assignments. Webhooks won't route without an assignment.</p>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {detail.assignments.map(a => (
                                    <div key={a.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        background: 'var(--sidebar-hover)', borderRadius: 8,
                                        padding: '4px 10px 4px 8px', fontSize: '0.78rem',
                                    }}>
                                        <Building2 size={13} color="var(--accent)" />
                                        <span>Dept #{a.department_id}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                                        <Users size={13} color="var(--accent)" />
                                        <span>User #{a.user_id}</span>
                                        <button
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 0 }}
                                            onClick={() => handleDeleteAssignment(a.id)}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showSocial && (
                <AddSocialModal
                    brandId={brand.id}
                    onClose={() => setShowSocial(false)}
                    onAdded={async () => {
                        setShowSocial(false);
                        const r = await brandService.get(brand.id);
                        setDetail(r.data);
                    }}
                />
            )}
            {showAssign && (
                <AssignBrandModal
                    brandId={brand.id}
                    onClose={() => setShowAssign(false)}
                    onAssigned={async () => {
                        setShowAssign(false);
                        const r = await brandService.get(brand.id);
                        setDetail(r.data);
                    }}
                />
            )}
        </div>
    );
}

// ──────────────── QueryMonitor ────────────────
function QueryMonitor({ reports, loading }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [platformFilter, setPlatformFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    if (loading) return <Spinner />;
    if (reports.length === 0) return <EmptyState message="No query logs available yet." />;

    // Compute totals
    let totalQueries = 0;
    let completedQueries = 0;
    let yetToStartQueries = 0;
    let inProgressQueries = 0;

    reports.forEach(r => {
        totalQueries += r.total_queries || 0;
        const dist = r.status_distribution || {};
        completedQueries += dist.completed || 0;
        yetToStartQueries += dist.yet_to_start || 0;
        inProgressQueries += (dist.in_progress || 0) + (dist.in_review || 0) + (dist.rework || 0);
    });

    const completionRate = totalQueries > 0 ? Math.round((completedQueries / totalQueries) * 100) : 0;

    // Filtered list of queries
    const allQueries = [];
    reports.forEach(r => {
        if (r.queries) {
            r.queries.forEach(q => {
                allQueries.push({
                    ...q,
                    brand_name: r.brand_name
                });
            });
        }
    });

    const filteredQueries = allQueries.filter(q => {
        const matchesSearch =
            (q.sender || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (q.message || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (q.brand_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (q.title || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesPlatform = platformFilter === 'all' || (q.platform || '').toLowerCase() === platformFilter.toLowerCase();

        const matchesStatus = statusFilter === 'all' || (q.status || '').toLowerCase() === statusFilter.toLowerCase();

        return matchesSearch && matchesPlatform && matchesStatus;
    });

    const formatDate = (dateStr) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return dateStr;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary Cards */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent)' }}>
                        <Tag size={20} />
                    </div>
                    <div className="stat-value">{totalQueries}</div>
                    <div className="stat-label">Total Inquiries Received</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                        <CheckCircle size={20} />
                    </div>
                    <div className="stat-value">{completedQueries}</div>
                    <div className="stat-label" style={{ fontWeight: 600 }}>Resolved Queries</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' }}>
                        <Users size={20} />
                    </div>
                    <div className="stat-value">{inProgressQueries}</div>
                    <div className="stat-label">In Progress Queries</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.17)', color: '#fbbf24' }}>
                        <AlertCircle size={20} />
                    </div>
                    <div className="stat-value">{completionRate}%</div>
                    <div className="stat-label">Resolution Rate</div>
                </div>
            </div>

            {/* Filter controls */}
            <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flex: 1, minWidth: 260, position: 'relative' }}>
                        <input
                            type="text"
                            className="form-input"
                            style={{ width: '100%' }}
                            placeholder="Search queries by sender, message, brand..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <select className="form-select" style={{ width: 140, padding: '6px 12px' }}
                            value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
                            <option value="all">All Platforms</option>
                            <option value="instagram">Instagram</option>
                            <option value="facebook">Facebook</option>
                            <option value="whatsapp">WhatsApp</option>
                        </select>
                        <select className="form-select" style={{ width: 140, padding: '6px 12px' }}
                            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all">All Statuses</option>
                            <option value="yet_to_start">Yet to Start</option>
                            <option value="in_progress">In Progress</option>
                            <option value="in_review">In Review</option>
                            <option value="completed">Completed</option>
                            <option value="rework">Rework</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Query Logs List */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Inquiry History Log ({filteredQueries.length})</h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Updated live</span>
                </div>
                <div className="table-wrap">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Brand</th>
                                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Platform</th>
                                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Sender</th>
                                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Message Query</th>
                                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Arrival Time</th>
                                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Assignee</th>
                                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredQueries.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        No matching queries found.
                                    </td>
                                </tr>
                            ) : (
                                filteredQueries.map(q => {
                                    let statusColor = '#64748b';
                                    if (q.status === 'completed') statusColor = '#2ed573';
                                    else if (q.status === 'in_progress') statusColor = '#3b82f6';
                                    else if (q.status === 'in_review') statusColor = '#f59e0b';
                                    else if (q.status === 'rework') statusColor = '#ef4444';

                                    return (
                                        <tr key={q.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <td style={{ padding: '14px 16px', fontSize: '0.82rem', fontWeight: 600 }}>{q.brand_name}</td>
                                            <td style={{ padding: '14px 16px', fontSize: '0.82rem' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                    {PLATFORM_ICONS[q.platform.toLowerCase()] || <Globe size={13} />}
                                                    <span style={{ textTransform: 'capitalize' }}>{q.platform}</span>
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px', fontSize: '0.82rem', fontWeight: 600 }}>{q.sender}</td>
                                            <td style={{ padding: '14px 16px', fontSize: '0.82rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.message}>
                                                {q.message}
                                            </td>
                                            <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatDate(q.created_at)}</td>
                                            <td style={{ padding: '14px 16px', fontSize: '0.82rem' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                    <Users size={12} color="var(--text-muted)" />
                                                    {q.assignee_name}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px', fontSize: '0.82rem' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    borderRadius: 99,
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    background: `${statusColor}22`,
                                                    color: statusColor,
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {q.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ──────────────── BrandsPage ────────────────
export default function BrandsPage() {
    const { user } = useAuth();
    const isExecutive = user && user.role_tier === 1;

    // Tabs state: 'manage' or 'queries'
    const [activeTab, setActiveTab] = useState(isExecutive ? 'manage' : 'queries');

    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);

    const [reports, setReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await brandService.list();
            setBrands(r.data);
        } catch { } finally {
            setLoading(false);
        }
    };

    const loadReports = async () => {
        setLoadingReports(true);
        try {
            const r = await brandService.queryReport();
            setReports(r.data);
        } catch (err) {
            console.error("Failed to load reports:", err);
        } finally {
            setLoadingReports(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        if (activeTab === 'queries') {
            loadReports();
        }
    }, [activeTab]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Brands</h2>
                    <p>
                        Track multi-brand social media channels, configuration profiles, and communication routing logs.
                    </p>
                </div>
                {activeTab === 'manage' && isExecutive && (
                    <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                        <Plus size={15} /> Add Brand
                    </button>
                )}
            </div>

            {/* Tab Swapper */}
            {isExecutive && (
                <div style={{ padding: '0 32px 10px 32px' }}>
                    <div style={{
                        display: 'inline-flex',
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 99,
                        padding: 4,
                        marginBottom: 10,
                    }}>
                        <button
                            onClick={() => setActiveTab('manage')}
                            style={{
                                background: activeTab === 'manage' ? 'var(--accent)' : 'transparent',
                                border: 'none',
                                color: activeTab === 'manage' ? '#fff' : 'var(--text-muted)',
                                padding: '8px 20px',
                                borderRadius: 99,
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                                cursor: 'pointer',
                            }}
                        >
                            Manage Brands
                        </button>
                        <button
                            onClick={() => setActiveTab('queries')}
                            style={{
                                background: activeTab === 'queries' ? 'var(--accent)' : 'transparent',
                                border: 'none',
                                color: activeTab === 'queries' ? '#fff' : 'var(--text-muted)',
                                padding: '8px 20px',
                                borderRadius: 99,
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                                cursor: 'pointer',
                            }}
                        >
                            Queries Monitor &amp; Reports
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'manage' && isExecutive ? (
                <div className="content-area" style={{ paddingTop: 0 }}>
                    {/* Webhook info banner */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(124,109,250,.12), rgba(56,214,150,.08))',
                        border: '1px solid rgba(124,109,250,.25)',
                        borderRadius: 14, padding: '14px 18px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        marginBottom: 20, fontSize: '0.82rem',
                    }}>
                        <Globe size={18} color="#7c6dfa" style={{ flexShrink: 0 }} />
                        <div>
                            <strong style={{ color: 'var(--accent)' }}>Meta Webhook URL:</strong>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                POST /api/v1/webhooks/meta
                            </span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 16 }}>
                                Incoming queries auto-route to assigned staff as High priority tasks.
                            </span>
                        </div>
                    </div>

                    {loading ? (
                        <Spinner />
                    ) : brands.length === 0 ? (
                        <EmptyState message="No brands yet. Create your first brand and link your Meta accounts." />
                    ) : (
                        <div>
                            {brands.map(brand => (
                                <BrandCard key={brand.id} brand={brand} onRefresh={load} />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="content-area" style={{ paddingTop: isExecutive ? 0 : 20 }}>
                    <QueryMonitor reports={reports} loading={loadingReports} />
                </div>
            )}

            {showAdd && (
                <AddBrandModal
                    onClose={() => setShowAdd(false)}
                    onCreated={() => { setShowAdd(false); load(); }}
                />
            )}
        </div>
    );
}
