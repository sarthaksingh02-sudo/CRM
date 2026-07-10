import { useState } from 'react';
import { ProgressBar, StatusBadge, PriorityBadge, DueChip, AssigneeChip } from '../ui/Shared';
import TaskDetailModal from './TaskDetailModal';

export default function TaskCard({ task, onRefresh }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div className="task-card" onClick={() => setOpen(true)}>
                {task.is_overdue && <div className="overdue-ribbon">OVERDUE</div>}

                <div className="task-card-header">
                    <div>
                        <p className="task-brand">{task.brand_name}</p>
                        <StatusBadge status={task.status} />
                    </div>
                    <PriorityBadge priority={task.priority} />
                </div>

                <p className="task-title">{task.title}</p>

                <ProgressBar
                    value={task.progress_percentage}
                    status={task.status}
                    isOverdue={task.is_overdue}
                />

                <div className="task-meta" style={{ marginTop: 8 }}>
                    <DueChip date={task.expected_delivery} isOverdue={task.is_overdue} />
                </div>

                <div className="task-footer">
                    <AssigneeChip user={task.assignee} />
                    <span style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>
                        Dept: {task.department?.name ?? '—'}
                    </span>
                </div>
            </div>

            {open && (
                <TaskDetailModal
                    task={task}
                    onClose={() => setOpen(false)}
                    onRefresh={() => { setOpen(false); onRefresh?.(); }}
                />
            )}
        </>
    );
}
