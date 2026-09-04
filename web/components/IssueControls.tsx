'use client';

import { useState, useTransition } from 'react';
import { updateIssue } from '@/app/actions';
import { PRIORITY_LABEL, ROLE_LABEL, STATUS_LABEL } from '@/lib/format';
import type { Issue, IssueStatus, Priority, UserSummary } from '@/lib/types';

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

/**
 * Which statuses can be reached from here mirrors the server's transition rules.
 * The server is still the authority — this only keeps the UI from offering a
 * move it would reject.
 */
const NEXT_STATUS: Record<IssueStatus, IssueStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};

export function IssueControls({
  issue,
  assignable,
}: {
  issue: Issue;
  assignable: UserSummary[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(body: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const result = await updateIssue(issue.id, body);
      if ('error' in result) setError(result.error);
    });
  }

  return (
    <div className="card divide-y divide-slate-100">
      <div className="p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Status
        </p>
        <div className="flex flex-wrap gap-2">
          {NEXT_STATUS[issue.status].map((status) => (
            <button
              key={status}
              type="button"
              disabled={pending}
              onClick={() => patch({ status })}
              className="btn-secondary text-xs"
            >
              {status === 'CLOSED'
                ? 'Close issue'
                : status === 'OPEN' && issue.status === 'CLOSED'
                  ? 'Reopen'
                  : `Move to ${STATUS_LABEL[status]}`}
            </button>
          ))}
        </div>
      </div>

      <Field label="Priority">
        <select
          value={issue.priority}
          disabled={pending}
          onChange={(event) => patch({ priority: event.target.value })}
          className="field"
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABEL[priority]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Assignee">
        <select
          value={issue.assignee?.id ?? ''}
          disabled={pending}
          onChange={(event) =>
            patch({ assigneeId: event.target.value === '' ? null : event.target.value })
          }
          className="field"
        >
          <option value="">Unassigned</option>
          {assignable.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} — {ROLE_LABEL[user.role]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Due date">
        <input
          type="date"
          disabled={pending}
          defaultValue={issue.dueDate ? issue.dueDate.slice(0, 10) : ''}
          onChange={(event) =>
            patch({
              dueDate: event.target.value
                ? new Date(event.target.value).toISOString()
                : null,
            })
          }
          className="field"
        />
      </Field>

      {error && (
        <p role="alert" className="bg-red-50 px-4 py-2 text-xs text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {children}
    </div>
  );
}
