import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard, ChartBar, ClipboardList,
    Users, Building2, LogOut, X, MessageSquare
} from 'lucide-react';

const TIER_LABEL = { 1: 'Executive Admin', 2: 'Dept Head', 3: 'Staff' };

export default function Sidebar({ isOpen, onClose }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        if (onClose) onClose();
        navigate('/login');
    };

    const initials = user
        ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
        : '';

    const links = [
        { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard', tiers: [1, 2, 3] },
        { to: '/tasks', icon: <ClipboardList size={18} />, label: 'Tasks', tiers: [1, 2, 3] },
        { to: '/discussion', icon: <MessageSquare size={18} />, label: 'Discussion', tiers: [1, 2, 3] },
        { to: '/analytics', icon: <ChartBar size={18} />, label: 'Analytics', tiers: [1, 2] },
        { to: '/users', icon: <Users size={18} />, label: 'Team', tiers: [1, 2] },
        { to: '/departments', icon: <Building2 size={18} />, label: 'Departments', tiers: [1] },
    ].filter(l => user && l.tiers.includes(user.role_tier));

    return (
        <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/voxo-logo.png" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} alt="Voxo Logo" />
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}><span>Mate</span></h1>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                        }}
                        className="mobile-only-close"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            <nav className="sidebar-nav">
                {links.map(l => (
                    <NavLink
                        key={l.to}
                        to={l.to}
                        end={l.to === '/'}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        onClick={() => onClose && onClose()}
                    >
                        {l.icon}
                        {l.label}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="user-chip" style={{ marginBottom: 8 }}>
                    <div className="user-avatar">{initials}</div>
                    <div className="user-info">
                        <p>{user?.first_name} {user?.last_name}</p>
                        <span>{TIER_LABEL[user?.role_tier]}</span>
                    </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={handleLogout}>
                    <LogOut size={14} /> Sign out
                </button>
            </div>
        </aside>
    );
}
