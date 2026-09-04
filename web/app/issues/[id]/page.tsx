import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { IssueControls } from '@/components/IssueControls';
import { CommentThread } from '@/components/CommentThread';
import { PhotoGrid } from '@/components/PhotoGrid';
import { Avatar, OverdueBadge, PriorityBadge, StatusBadge } from '@/components/Badges';
import { ROLE_LABEL, describeDueDate, formatDate, formatDateTime } from '@/lib/format';
import type { Issue, UserSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function IssueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ photoError?: string }>;
}) {
  const { id } = await params;
  const { photoError } = await searchParams;

  let issue: Issue;
  try {
    issue = await api<Issue>(`/issues/${id}`);
  } catch (error) {
    // A 404 here is also what another venue's staff sees — the API does not
    // distinguish "does not exist" from "not yours", and neither does this page.
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  const assignable = await api<UserSummary[]>(
    `/venues/${issue.venue.id}/assignable-users`,
  );

  const due = describeDueDate(issue.dueDate, issue.status);

  return (
    <div>
      <Link
        href="/issues"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path
            fillRule="evenodd"
            d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
        All issues
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <header className="card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={issue.status} />
              <PriorityBadge priority={issue.priority} />
              {due?.overdue && <OverdueBadge text={due.text} />}
              <span className="badge bg-slate-100 text-slate-600 ring-slate-200">
                {issue.venue.name}
              </span>
            </div>

            <h1 className="text-xl font-semibold leading-snug text-slate-900">
              {issue.title}
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              Raised by {issue.reporter.name} ({ROLE_LABEL[issue.reporter.role]}) on{' '}
              {formatDateTime(issue.createdAt)}
              {issue.closedAt && ` · Closed ${formatDate(issue.closedAt)}`}
            </p>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {issue.description}
            </p>
          </header>

          <PhotoGrid
            issueId={issue.id}
            attachments={issue.attachments ?? []}
            initialError={photoError}
          />

          <CommentThread issueId={issue.id} comments={issue.comments ?? []} />
        </div>

        <aside className="space-y-4">
          <IssueControls issue={issue} assignable={assignable} />

          <div className="card space-y-3 p-4 text-sm">
            <Detail label="Assignee">
              {issue.assignee ? (
                <span className="flex items-center gap-2">
                  <Avatar name={issue.assignee.name} />
                  <span>
                    <span className="block text-slate-800">{issue.assignee.name}</span>
                    <span className="block text-[11px] text-slate-500">
                      {ROLE_LABEL[issue.assignee.role]}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="text-slate-400">Unassigned</span>
              )}
            </Detail>

            <Detail label="Due">
              <span className={due?.overdue ? 'font-medium text-red-700' : 'text-slate-700'}>
                {issue.dueDate ? formatDate(issue.dueDate) : 'No due date'}
                {due && !due.overdue && issue.status !== 'CLOSED' && (
                  <span className="block text-[11px] text-slate-500">{due.text}</span>
                )}
              </span>
            </Detail>

            <Detail label="Last updated">
              <span className="text-slate-700">{formatDateTime(issue.updatedAt)}</span>
            </Detail>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
