import type { IssueStatus, Priority, Role } from './types';

export const STATUS_LABEL: Record<IssueStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  CLOSED: 'Closed',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const ROLE_LABEL: Record<Role, string> = {
  HEAD_OFFICE: 'Head Office',
  VENUE_MANAGER: 'Venue Manager',
  VENUE_STAFF: 'Venue Staff',
};

export const STATUS_CLASS: Record<IssueStatus, string> = {
  OPEN: 'bg-slate-100 text-slate-700 ring-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-blue-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600 ring-slate-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
  HIGH: 'bg-orange-100 text-orange-800 ring-orange-300',
  URGENT: 'bg-red-100 text-red-800 ring-red-300',
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "3 days overdue" / "due in 2 days" / "due today". */
export function describeDueDate(
  dueDate: string | null,
  status: IssueStatus,
): { text: string; overdue: boolean } | null {
  if (!dueDate) return null;

  const due = new Date(dueDate);
  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      dayMs,
  );

  if (status === 'CLOSED') return { text: formatDate(dueDate), overdue: false };
  if (days < 0) {
    const n = Math.abs(days);
    return { text: `${n} day${n === 1 ? '' : 's'} overdue`, overdue: true };
  }
  if (days === 0) return { text: 'Due today', overdue: false };
  return { text: `Due in ${days} day${days === 1 ? '' : 's'}`, overdue: false };
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
