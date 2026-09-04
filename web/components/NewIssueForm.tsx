'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createIssue, type ActionResult } from '@/app/actions';
import { PRIORITY_LABEL, ROLE_LABEL, formatBytes } from '@/lib/format';
import type { Priority, UserSummary, Venue } from '@/lib/types';

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function NewIssueForm({
  me,
  venues,
  assignableByVenue,
}: {
  me: UserSummary;
  venues: Venue[];
  assignableByVenue: Record<string, UserSummary[]>;
}) {
  const isHeadOffice = me.role === 'HEAD_OFFICE';
  const [venueId, setVenueId] = useState(
    isHeadOffice ? (venues[0]?.id ?? '') : (me.venueId ?? ''),
  );
  const [photos, setPhotos] = useState<File[]>([]);

  // Object URLs are minted once per selection and revoked when it changes.
  // Calling createObjectURL inline in the JSX allocated a fresh URL on every
  // render and released none of them.
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);

  useEffect(() => {
    const next = photos.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => next.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [photos]);

  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    async (_previous, formData) => createIssue(formData),
    null,
  );

  const assignable = assignableByVenue[venueId] ?? [];

  return (
    <form action={formAction} className="space-y-5">
      {state && 'error' in state && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}

      <div className="card space-y-5 p-5">
        {isHeadOffice ? (
          <div>
            <label htmlFor="venueId" className="label">
              Venue
            </label>
            <select
              id="venueId"
              name="venueId"
              value={venueId}
              onChange={(event) => setVenueId(event.target.value)}
              required
              className="field"
            >
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              As Head Office you must say which venue this issue belongs to.
            </p>
          </div>
        ) : (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Raising this against <strong>{me.venue?.name}</strong>.
          </p>
        )}

        <div>
          <label htmlFor="title" className="label">
            What is wrong?
          </label>
          <input
            id="title"
            name="title"
            required
            minLength={3}
            maxLength={200}
            placeholder="e.g. Walk-in cool room running warm"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="description" className="label">
            Details
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={5}
            maxLength={10000}
            placeholder="What is happening, when it started, and anything already tried."
            className="field resize-y"
          />
        </div>

        <div>
          <span className="label">Photos</span>
          <label
            htmlFor="photos"
            className="flex cursor-pointer flex-col items-center justify-center rounded-md
                       border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6
                       text-center transition hover:border-ember-400 hover:bg-ember-50/40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7 text-slate-400" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.9 47.9 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
            <span className="mt-2 text-sm font-medium text-slate-700">
              Add photos
            </span>
            <span className="mt-0.5 text-xs text-slate-500">
              JPEG, PNG, WebP or HEIC · up to 8 files
            </span>
          </label>
          <input
            id="photos"
            name="photos"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(event) => setPhotos(Array.from(event.target.files ?? []).slice(0, 8))}
          />

          {previews.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {previews.map(({ file, url }, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="overflow-hidden rounded-md border border-slate-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-24 w-full object-cover" />
                  <p className="truncate px-2 py-1 text-[11px] text-slate-500">
                    {file.name} · {formatBytes(file.size)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card grid gap-5 p-5 sm:grid-cols-3">
        <div>
          <label htmlFor="priority" className="label">
            Priority
          </label>
          <select id="priority" name="priority" defaultValue="MEDIUM" className="field">
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="assigneeId" className="label">
            Assign to
          </label>
          <select id="assigneeId" name="assigneeId" defaultValue="" className="field">
            <option value="">Nobody yet</option>
            {assignable.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} — {ROLE_LABEL[user.role]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dueDate" className="label">
            Due date
          </label>
          <input id="dueDate" name="dueDate" type="date" className="field" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href="/issues" className="btn-secondary">
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Raising…' : 'Raise issue'}
    </button>
  );
}
