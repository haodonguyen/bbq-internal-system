import {
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
} from '@/lib/format';
import type { IssueStatus, Priority } from '@/lib/types';

export function StatusBadge({ status }: { status: IssueStatus }) {
  return <span className={`badge ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`badge ${PRIORITY_CLASS[priority]}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function OverdueBadge({ text }: { text: string }) {
  return (
    <span className="badge bg-red-50 text-red-700 ring-red-200">
      <svg viewBox="0 0 20 20" fill="currentColor" className="mr-1 h-3 w-3" aria-hidden>
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.515 2.625H3.72c-1.345 0-2.188-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
      {text}
    </span>
  );
}

export function Avatar({ name, title }: { name: string; title?: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      title={title ?? name}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                 bg-slate-200 text-[11px] font-semibold text-slate-600"
    >
      {initials}
    </span>
  );
}
