import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.detail ?? 'Login failed. Check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <div className="login-logo-icon" style={{ background: 'transparent', width: '64px', height: '64px' }}>
                        <img src="/voxo-logo.png" style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Logo" />
                    </div>
                    <h1>VoxoMate</h1>
                    <p>Digital Marketing Agency CRM</p>
                </div>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email address</label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@agency.com"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '12px' }}
                        disabled={loading}
                    >
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '.75rem', marginTop: 20 }}>
                    Role-based access: Admins · Dept Heads · Staff
                </p>
            </div>
        </div>
    );
}
