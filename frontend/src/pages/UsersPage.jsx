import { useState, useEffect } from 'react';
import { userService, deptService } from '../services/taskService';
import { Spinner, EmptyState } from '../components/ui/Shared';
import { UserPlus, PowerOff, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TIER_LABEL = { 1: 'Executive Admin', 2: 'Dept Head', 3: 'Staff' };
const TIER_OPTIONS = [
    { value: 1, label: 'Executive Admin (Tier 1)' },
    { value: 2, label: 'Dept Head (Tier 2)' },
    { value: 3, label: 'Staff (Tier 3)' },
];

function AddUserModal({ onClose, onCreated }) {
    const [depts, setDepts] = useState([]);
    const [form, setForm] = useState({
        first_name: '', last_name: '', email: '', password: '',
        role_tier: 3, department_id: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        deptService.list().then(r => setDepts(r.data)).catch(() => { });
    }, []);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await userService.create({
                ...form,
                role_tier: Number(form.role_tier),
                department_id: form.department_id ? Number(form.department_id) : null,
            });
            onCreated?.();
        } catch (err) {
            setError(err.response?.data?.detail ?? 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Add Team Member</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">First Name *</label>
                            <input className="form-input" required value={form.first_name}
                                onChange={e => set('first_name', e.target.value)} placeholder="Jane" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Last Name *</label>
                            <input className="form-input" required value={form.last_name}
                                onChange={e => set('last_name', e.target.value)} placeholder="Doe" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email Address *</label>
                        <input className="form-input" type="email" required value={form.email}
                            onChange={e => set('email', e.target.value)} placeholder="jane@voxomate.com" />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password *</label>
                        <input className="form-input" type="password" required minLength={8}
                            value={form.password}
                            onChange={e => set('password', e.target.value)}
                            placeholder="Min. 8 characters" />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Role *</label>
                            <select className="form-select" value={form.role_tier}
                                onChange={e => set('role_tier', e.target.value)}>
                                {TIER_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Department</label>
                            <select className="form-select" value={form.department_id}
                                onChange={e => set('department_id', e.target.value)}>
                                <option value="">— None —</option>
                                {depts.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            <UserPlus size={15} /> {loading ? 'Creating…' : 'Add Member'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function UsersPage() {
    const { user: me } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInactive, setShowInactive] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await userService.list({ active_only: !showInactive });
            setUsers(res.data);
        } catch { /* handled */ }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [showInactive]);

    const handleDeactivate = async (id) => {
        if (!confirm('Deactivate this user? They will lose login access.')) return;
        try {
            await userService.deactivate(id);
            load();
        } catch (e) {
            alert(e.response?.data?.detail ?? 'Error');
        }
    };

    const handleReactivate = async (id) => {
        if (!confirm('Reactivate this user? They will regain login access.')) return;
        try {
            await userService.reactivate(id);
            load();
        } catch (e) {
            alert(e.response?.data?.detail ?? 'Error');
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Team Management</h2>
                    <p>{users.length} member{users.length !== 1 ? 's' : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
                        Show inactive
                    </label>
                    {me?.role_tier === 1 && (
                        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                            <UserPlus size={15} /> Add Member
                        </button>
                    )}
                </div>
            </div>

            <div className="content-area">
                {loading ? <Spinner /> : users.length === 0 ? <EmptyState message="No users found" /> : (
                    <div className="card" style={{ padding: 0 }}>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Department</th>
                                        <th>Status</th>
                                        {me?.role_tier === 1 && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{
                                                        width: 32, height: 32, borderRadius: '50%',
                                                        background: 'var(--accent)',
                                                        display: 'grid', placeItems: 'center',
                                                        fontSize: '.7rem', fontWeight: 700, color: '#fff', flexShrink: 0
                                                    }}>
                                                        {u.first_name?.[0]}{u.last_name?.[0]}
                                                    </div>
                                                    <span style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</span>
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                                            <td>
                                                <span className={`badge badge-${u.role_tier === 1 ? 'high' : u.role_tier === 2 ? 'medium' : 'low'}`}>
                                                    {TIER_LABEL[u.role_tier]}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)' }}>{u.department?.name ?? '—'}</td>
                                            <td>
                                                <span className={`badge ${u.is_active ? 'badge-completed' : 'badge-rework'}`}>
                                                    {u.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            {me?.role_tier === 1 && (
                                                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    {u.is_active && u.id !== me.id && (
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            onClick={() => handleDeactivate(u.id)}
                                                        >
                                                            <PowerOff size={12} /> Deactivate
                                                        </button>
                                                    )}
                                                    {!u.is_active && (
                                                        <button
                                                            className="btn btn-success btn-sm"
                                                            onClick={() => handleReactivate(u.id)}
                                                        >
                                                            <RefreshCw size={12} /> Reactivate
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {showAddModal && (
                <AddUserModal
                    onClose={() => setShowAddModal(false)}
                    onCreated={() => { setShowAddModal(false); load(); }}
                />
            )}
        </div>
    );
}
