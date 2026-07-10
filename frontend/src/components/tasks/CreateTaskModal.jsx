import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { taskService, userService, deptService } from '../../services/taskService';

export default function CreateTaskModal({ onClose, onCreated }) {
    const [depts, setDepts] = useState([]);
    const [users, setUsers] = useState([]);
    const [form, setForm] = useState({
        brand_name: '', title: '', description: '',
        priority: 'medium', department_id: '',
        assigned_to: '', due_date: '', expected_delivery: '',
    });
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
            await taskService.create({
                ...form,
                department_id: Number(form.department_id),
                assigned_to: Number(form.assigned_to),
                due_date: new Date(form.due_date).toISOString(),
                expected_delivery: new Date(form.expected_delivery).toISOString(),
            });
            onCreated?.();
        } catch (err) {
            setError(err.response?.data?.detail ?? 'Failed to create task');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">New Task</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Brand Name *</label>
                            <input className="form-input" required value={form.brand_name}
                                onChange={e => set('brand_name', e.target.value)} placeholder="e.g. Acme Corp" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Priority</label>
                            <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Task Title *</label>
                        <input className="form-input" required value={form.title}
                            onChange={e => set('title', e.target.value)} placeholder="What needs to be done?" />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-textarea" value={form.description}
                            onChange={e => set('description', e.target.value)} placeholder="Optional details…" />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Department *</label>
                            <select className="form-select" required value={form.department_id}
                                onChange={e => set('department_id', e.target.value)}>
                                <option value="">Select…</option>
                                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Assign To *</label>
                            <select className="form-select" required value={form.assigned_to}
                                onChange={e => set('assigned_to', e.target.value)}>
                                <option value="">Select…</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Due Date *</label>
                            <input type="datetime-local" className="form-input" required value={form.due_date}
                                onChange={e => set('due_date', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Expected Delivery *</label>
                            <input type="datetime-local" className="form-input" required value={form.expected_delivery}
                                onChange={e => set('expected_delivery', e.target.value)} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Creating…' : 'Create Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
