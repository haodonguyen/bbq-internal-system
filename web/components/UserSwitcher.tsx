'use client';

import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { selectUser } from '@/app/actions';
import { ROLE_LABEL } from '@/lib/format';
import type { UserSummary } from '@/lib/types';

/**
 * DEV ONLY — stands in for a login screen. Picking a user sets the cookie that
 * the API's stub guard reads, which is how the venue-scoping behaviour can be
 * seen from both sides without building accounts.
 */
export function UserSwitcher({
  users,
  current,
}: {
  users: UserSummary[];
  current: UserSummary | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();

  const grouped = users.reduce<Record<string, UserSummary[]>>((acc, user) => {
    const key = user.venue?.name ?? 'Head Office';
    (acc[key] ??= []).push(user);
    return acc;
  }, {});

  function choose(id: string) {
    startTransition(async () => {
      await selectUser(id, pathname);
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 rounded-md border border-slate-300 bg-white
                   px-3 py-1.5 text-sm shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ember-100 text-[10px] font-bold text-ember-700">
          {current
            ? current.name.split(' ').slice(0, 2).map((p) => p[0]).join('')
            : '?'}
        </span>
        <span className="text-left leading-tight">
          <span className="block font-medium text-slate-800">
            {current?.name ?? 'Choose a user'}
          </span>
          <span className="block text-[11px] text-slate-500">
            {current
              ? `${ROLE_LABEL[current.role]}${current.venue ? ` · ${current.venue.name}` : ''}`
              : 'Not signed in'}
          </span>
        </span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400" aria-hidden>
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="listbox"
            className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-lg border
                       border-slate-200 bg-white shadow-lg"
          >
            <p className="border-b border-slate-100 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
              <strong>Development sign-in.</strong> No password — this stands in for
              real authentication so venue scoping can be tested from both sides.
            </p>
            <div className="max-h-96 overflow-y-auto py-1">
              {Object.entries(grouped).map(([group, groupUsers]) => (
                <div key={group}>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {group}
                  </p>
                  {groupUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      role="option"
                      aria-selected={user.id === current?.id}
                      onClick={() => choose(user.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm
                                  hover:bg-slate-50 ${
                                    user.id === current?.id ? 'bg-ember-50' : ''
                                  }`}
                    >
                      <span>
                        <span className="block font-medium text-slate-800">{user.name}</span>
                        <span className="block text-[11px] text-slate-500">
                          {ROLE_LABEL[user.role]}
                        </span>
                      </span>
                      {user.id === current?.id && (
                        <span className="text-xs font-medium text-ember-600">Current</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
