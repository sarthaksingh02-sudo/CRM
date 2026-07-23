// Shared small components
import { useEffect } from 'react';
import { format, parseISO } from 'date-fns';

// ── StatusBadge ──────────────────────────────────────────────
export function StatusBadge({ status }) {
    const labels = {
        yet_to_start: 'Yet to Start',
        in_progress: 'In Progress',
        in_review: 'In Review',
        completed: 'Completed',
        rework: 'Rework',
    };
    return (
        <span className={`badge badge-${status}`}>
            {labels[status] ?? status}
        </span>
    );
}

// ── PriorityBadge ─────────────────────────────────────────────
export function PriorityBadge({ priority }) {
    return (
        <span className={`badge badge-${priority}`}>
            {priority}
        </span>
    );
}

// ── ProgressBar ───────────────────────────────────────────────
export function ProgressBar({ value, status, isOverdue }) {
    const cls = isOverdue
        ? 'overdue'
        : status === 'completed'
            ? 'done'
            : status === 'in_review'
                ? 'review'
                : status === 'rework'
                    ? 'rework'
                    : '';

    return (
        <div>
            <div className="progress-wrap">
                <div
                    className={`progress-bar ${cls}`}
                    style={{ width: `${value}%` }}
                />
            </div>
            <div className="progress-label">
                <span>{isOverdue ? '⚠ Overdue' : status?.replace('_', ' ')}</span>
                <span>{value}%</span>
            </div>
        </div>
    );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner() {
    return (
        <div className="loading-screen">
            <div className="spinner" />
        </div>
    );
}

// ── EmptyState ────────────────────────────────────────────────
export function EmptyState({ message = 'No items found' }) {
    return (
        <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>{message}</p>
        </div>
    );
}

export function parseLocalOrUTC(d) {
    if (!d) return null;
    if (typeof d === 'string') {
        let clean = d;
        if (!clean.endsWith('Z') && !clean.includes('+') && !clean.match(/[-+]\d{2}:?\d{2}$/)) {
            clean = clean.includes('T') ? clean + 'Z' : clean.replace(' ', 'T') + 'Z';
        }
        return parseISO(clean);
    }
    return d;
}

// ── DueChip ───────────────────────────────────────────────────
export function DueChip({ date, isOverdue }) {
    if (!date) return null;
    const d = parseLocalOrUTC(date);
    return (
        <span className={`due-chip ${isOverdue ? 'overdue' : ''}`}>
            {isOverdue ? '⚠ ' : '📅 '}
            {format(d, 'dd MMM')}
        </span>
    );
}

// ── AssigneeChip ──────────────────────────────────────────────
export function AssigneeChip({ user }) {
    if (!user) return null;
    const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase();
    return (
        <div className="assignee-chip">
            <div className="assignee-avatar">{initials}</div>
            <span>{user.first_name} {user.last_name}</span>
        </div>
    );
}

// ── Toast ─────────────────────────────────────────────────────
export function Toast({ message, type = 'success', onClose }) {
    useEffect(() => {
        if (!onClose) return;
        const timer = setTimeout(() => {
            onClose();
        }, 5000);
        return () => clearTimeout(timer);
    }, [message, type, onClose]);

    return (
        <div className={`toast ${type}`} onClick={onClose} style={{ cursor: 'pointer' }}>
            {type === 'success' ? '✅ ' : '❌ '}{message}
        </div>
    );
}

