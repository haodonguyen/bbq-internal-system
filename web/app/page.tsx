import Link from 'next/link';
import { api } from '@/lib/api';
import { OverdueBadge, PriorityBadge } from '@/components/Badges';
import { PRIORITY_LABEL, describeDueDate } from '@/lib/format';
import type { DashboardSummary, Priority, UserSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PRIORITY_ORDER: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

const PRIORITY_BAR: Record<Priority, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-400',
  MEDIUM: 'bg-amber-300',
  LOW: 'bg-slate-300',
};

export default async function DashboardPage() {
  const [me, summary] = await Promise.all([
    api<UserSummary>('/me'),
    api<DashboardSummary>('/dashboard/summary'),
  ]);

  const open = summary.statusCounts.OPEN + summary.statusCounts.IN_PROGRESS;
  const priorityTotal = PRIORITY_ORDER.reduce(
    (sum, priority) => sum + summary.priorityCounts[priority],
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {me.role === 'HEAD_OFFICE'
            ? 'All venues'
            : (me.venue?.name ?? 'Your venue')}
        </h1>
        <p className="text-sm text-slate-500">
          {me.role === 'HEAD_OFFICE'
            ? 'Maintenance across the whole estate.'
            : 'Maintenance and operational issues at your venue.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open issues"
          value={open}
          href="/issues?status=OPEN&status=IN_PROGRESS"
        />
        <StatCard
          label="Overdue"
          value={summary.overdue}
          href="/issues?overdue=true"
          tone={summary.overdue > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Assigned to me"
          value={summary.assignedToMe}
          href="/issues?assigneeId=me"
        />
        <StatCard
          label="Unassigned"
          value={summary.unassigned}
          href="/issues?unassigned=true"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Open issues by priority
          </h2>
          {priorityTotal === 0 ? (
            <p className="text-sm text-slate-500">Nothing open. Good day.</p>
          ) : (
            <ul className="space-y-3">
              {PRIORITY_ORDER.map((priority) => {
                const count = summary.priorityCounts[priority];
                const pct = priorityTotal === 0 ? 0 : (count / priorityTotal) * 100;
                return (
                  <li key={priority}>
                    <Link
                      href={`/issues?priority=${priority}&status=OPEN&status=IN_PROGRESS`}
                      className="group block"
                    >
                      <span className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="text-slate-700 group-hover:text-ember-700">
                          {PRIORITY_LABEL[priority]}
                        </span>
                        <span className="font-medium tabular-nums text-slate-900">
                          {count}
                        </span>
                      </span>
                      <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className={`block h-full rounded-full ${PRIORITY_BAR[priority]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Most overdue</h2>
          {summary.recentOverdue.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing is past its due date.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.recentOverdue.map((issue) => {
                const due = describeDueDate(issue.dueDate, 'OPEN');
                return (
                  <li key={issue.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link href={`/issues/${issue.id}`} className="group block">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-ember-700">
                            {issue.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            {issue.venue.name} ·{' '}
                            {issue.assignee ? issue.assignee.name : 'Unassigned'}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <PriorityBadge priority={issue.priority} />
                          {due?.overdue && <OverdueBadge text={due.text} />}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {summary.byVenue && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
            By venue
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Venue</th>
                <th className="px-3 py-2.5 text-right font-semibold">Open</th>
                <th className="px-3 py-2.5 text-right font-semibold">Overdue</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.byVenue.map((venue) => (
                <tr key={venue.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{venue.name}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                    {venue.open}
                  </td>
                  <td
                    className={`px-3 py-3 text-right tabular-nums ${
                      venue.overdue > 0 ? 'font-semibold text-red-700' : 'text-slate-400'
                    }`}
                  >
                    {venue.overdue}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/issues?venueId=${venue.id}`}
                      className="text-xs font-medium text-ember-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  tone = 'default',
}: {
  label: string;
  value: number;
  href: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <Link
      href={href}
      className="card p-4 transition hover:border-ember-300 hover:shadow"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          tone === 'danger' && value > 0 ? 'text-red-600' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </Link>
  );
}
