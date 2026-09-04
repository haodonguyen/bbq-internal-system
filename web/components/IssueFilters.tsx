'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/format';
import type { IssueStatus, Priority, Venue } from '@/lib/types';

const STATUSES: IssueStatus[] = ['OPEN', 'IN_PROGRESS', 'CLOSED'];
const PRIORITIES: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * Filters live in the URL, so a view can be linked to a colleague, survives a
 * reload, and works with the back button.
 */
export function IssueFilters({
  venues,
  showVenueFilter,
}: {
  venues: Venue[];
  showVenueFilter: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get('q') ?? '');

  // Keep the box in step when the URL changes from elsewhere (back button, reset).
  useEffect(() => {
    setSearch(params.get('q') ?? '');
  }, [params]);

  function apply(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete('page'); // any filter change puts you back on page one
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  function toggleMulti(key: string, value: string) {
    apply((next) => {
      const current = next.getAll(key);
      next.delete(key);
      const updated = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      updated.forEach((entry) => next.append(key, entry));
    });
  }

  function setSingle(key: string, value: string) {
    apply((next) => (value ? next.set(key, value) : next.delete(key)));
  }

  const activeStatuses = params.getAll('status');
  const activePriorities = params.getAll('priority');
  const hasFilters = Array.from(params.keys()).some((key) => key !== 'page');

  return (
    <div className="card mb-4 p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSingle('q', search.trim());
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="issue-search" className="label">
            Search
          </label>
          <input
            id="issue-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title or description…"
            className="field"
          />
        </div>

        {showVenueFilter && (
          <div className="w-48">
            <label htmlFor="venue-filter" className="label">
              Venue
            </label>
            <select
              id="venue-filter"
              value={params.get('venueId') ?? ''}
              onChange={(event) => setSingle('venueId', event.target.value)}
              className="field"
            >
              <option value="">All venues</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="w-44">
          <label htmlFor="sort" className="label">
            Sort by
          </label>
          <select
            id="sort"
            value={`${params.get('sort') ?? 'createdAt'}:${params.get('dir') ?? 'desc'}`}
            onChange={(event) => {
              const [sort, dir] = event.target.value.split(':');
              apply((next) => {
                next.set('sort', sort);
                next.set('dir', dir);
              });
            }}
            className="field"
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="dueDate:asc">Due date (soonest)</option>
            <option value="priority:desc">Priority (highest)</option>
            <option value="title:asc">Title (A–Z)</option>
          </select>
        </div>

        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
        <FilterGroup label="Status">
          {STATUSES.map((status) => (
            <Chip
              key={status}
              active={activeStatuses.includes(status)}
              onClick={() => toggleMulti('status', status)}
            >
              {STATUS_LABEL[status]}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Priority">
          {PRIORITIES.map((priority) => (
            <Chip
              key={priority}
              active={activePriorities.includes(priority)}
              onClick={() => toggleMulti('priority', priority)}
            >
              {PRIORITY_LABEL[priority]}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Quick">
          <Chip
            active={params.get('overdue') === 'true'}
            onClick={() =>
              setSingle('overdue', params.get('overdue') === 'true' ? '' : 'true')
            }
          >
            Overdue
          </Chip>
          <Chip
            active={params.get('assigneeId') === 'me'}
            onClick={() =>
              setSingle('assigneeId', params.get('assigneeId') === 'me' ? '' : 'me')
            }
          >
            Assigned to me
          </Chip>
          <Chip
            active={params.get('unassigned') === 'true'}
            onClick={() =>
              setSingle('unassigned', params.get('unassigned') === 'true' ? '' : 'true')
            }
          >
            Unassigned
          </Chip>
        </FilterGroup>

        {hasFilters && (
          <button
            type="button"
            onClick={() => startTransition(() => router.push(pathname))}
            className="ml-auto text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${
        active
          ? 'bg-ember-600 text-white ring-ember-600'
          : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
