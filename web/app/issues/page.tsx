import Link from 'next/link';
import { api } from '@/lib/api';
import { IssueFilters } from '@/components/IssueFilters';
import { Avatar, OverdueBadge, PriorityBadge, StatusBadge } from '@/components/Badges';
import { describeDueDate, formatDate } from '@/lib/format';
import type { Issue, Paginated, UserSummary, Venue } from '@/lib/types';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Forwarded verbatim; the API decides what a given user is allowed to see, so
  // a hand-edited query string cannot widen scope.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry) query.append(key, entry);
    }
  }
  if (!query.has('pageSize')) query.set('pageSize', '20');

  const [me, venues, page] = await Promise.all([
    api<UserSummary>('/me'),
    api<Venue[]>('/venues'),
    api<Paginated<Issue>>(`/issues?${query.toString()}`),
  ]);

  const currentPage = page.page;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Issues</h1>
        <p className="text-sm text-slate-500">
          {page.total} {page.total === 1 ? 'issue' : 'issues'}
          {me.role !== 'HEAD_OFFICE' && me.venue ? ` at ${me.venue.name}` : ''}
        </p>
      </div>

      <IssueFilters venues={venues} showVenueFilter={me.role === 'HEAD_OFFICE'} />

      {page.items.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm font-medium text-slate-700">No issues match</p>
          <p className="mt-1 text-sm text-slate-500">
            Try clearing a filter, or{' '}
            <Link href="/issues/new" className="font-medium text-ember-600 hover:underline">
              raise a new issue
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Issue</th>
                {me.role === 'HEAD_OFFICE' && (
                  <th className="px-3 py-2.5 font-semibold">Venue</th>
                )}
                <th className="px-3 py-2.5 font-semibold">Priority</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Assignee</th>
                <th className="px-3 py-2.5 font-semibold">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {page.items.map((issue) => {
                const due = describeDueDate(issue.dueDate, issue.status);
                return (
                  <tr key={issue.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/issues/${issue.id}`}
                        className="font-medium text-slate-900 hover:text-ember-700"
                      >
                        {issue.title}
                      </Link>
                      <span className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-400">
                        <span>Raised {formatDate(issue.createdAt)}</span>
                        {!!issue._count?.comments && (
                          <span>{issue._count.comments} comments</span>
                        )}
                        {!!issue._count?.attachments && (
                          <span>{issue._count.attachments} photos</span>
                        )}
                      </span>
                    </td>
                    {me.role === 'HEAD_OFFICE' && (
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {issue.venue.name}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <PriorityBadge priority={issue.priority} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={issue.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {issue.assignee ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={issue.assignee.name} />
                          <span className="text-slate-700">{issue.assignee.name}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {due?.overdue ? (
                        <OverdueBadge text={due.text} />
                      ) : (
                        <span className="text-slate-600">{formatDate(issue.dueDate)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {page.pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm">
          <PageLink params={query} page={currentPage - 1} disabled={currentPage <= 1}>
            Previous
          </PageLink>
          <span className="text-slate-500">
            Page {currentPage} of {page.pageCount}
          </span>
          <PageLink
            params={query}
            page={currentPage + 1}
            disabled={currentPage >= page.pageCount}
          >
            Next
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: URLSearchParams;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="btn-secondary pointer-events-none opacity-40">{children}</span>;
  }
  const next = new URLSearchParams(params.toString());
  next.set('page', String(page));
  return (
    <Link href={`/issues?${next.toString()}`} className="btn-secondary">
      {children}
    </Link>
  );
}
