import { useState, useEffect } from 'react';
import { deptService } from '../services/taskService';
import { Spinner, EmptyState } from '../components/ui/Shared';
import { Building2, Plus } from 'lucide-react';

export default function DepartmentsPage() {
    const [depts, setDepts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await deptService.list();
            setDepts(res.data);
        } catch { /* handled */ }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        setError('');
        try {
            await deptService.create(newName.trim());
            setNewName('');
            await load();
        } catch (err) {
            setError(err.response?.data?.detail ?? 'Failed to create department');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Departments</h2>
                    <p>{depts.length} department{depts.length !== 1 ? 's' : ''}</p>
                </div>
            </div>

            <div className="content-area">
                {/* Create form */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <p style={{ fontWeight: 700, marginBottom: 14, fontSize: '.9rem' }}>
                        <Building2 size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        Add Department
                    </p>
                    {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
                    <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10 }}>
                        <input
                            className="form-input"
                            placeholder="e.g. Design, Content & Comms, Post Production…"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <button type="submit" className="btn btn-primary" disabled={creating}>
                            <Plus size={15} /> {creating ? 'Adding…' : 'Add'}
                        </button>
                    </form>
                </div>

                {/* Department list */}
                {loading ? <Spinner /> : depts.length === 0 ? <EmptyState message="No departments yet" /> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                        {depts.map((d, i) => (
                            <div key={d.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 'var(--r-sm)',
                                    background: `hsl(${(i * 47) % 360}, 65%, 22%)`,
                                    display: 'grid', placeItems: 'center', flexShrink: 0,
                                    color: `hsl(${(i * 47) % 360}, 80%, 70%)`,
                                    fontSize: '1.2rem', fontWeight: 800,
                                }}>
                                    {d.name[0].toUpperCase()}
                                </div>
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: '.9rem' }}>{d.name}</p>
                                    <p style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>ID #{d.id}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
