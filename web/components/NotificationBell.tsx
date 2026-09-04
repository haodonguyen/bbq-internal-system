'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions';
import { formatDateTime } from '@/lib/format';
import type { Notification } from '@/lib/types';

export function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className="relative rounded-md border border-slate-300 bg-white p-2 text-slate-600
                   shadow-sm transition hover:bg-slate-50"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
          <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 10 18Z" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center
                       rounded-full bg-ember-600 px-1 text-[10px] font-bold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="text-sm font-semibold text-slate-800">Notifications</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => startTransition(() => markAllNotificationsRead())}
                  className="text-xs font-medium text-ember-600 hover:text-ember-700"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-500">
                  Nothing yet.
                </p>
              )}
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.issueId ? `/issues/${notification.issueId}` : '#'}
                  onClick={() => {
                    setOpen(false);
                    if (!notification.readAt) {
                      startTransition(() => markNotificationRead(notification.id));
                    }
                  }}
                  className={`block border-b border-slate-50 px-3 py-2.5 text-sm transition hover:bg-slate-50 ${
                    notification.readAt ? 'text-slate-600' : 'bg-ember-50/40 text-slate-900'
                  }`}
                >
                  <span className="flex items-start gap-2">
                    {!notification.readAt && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ember-500" />
                    )}
                    <span className={notification.readAt ? 'pl-3.5' : ''}>
                      <span className="block leading-snug">{notification.message}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        {formatDateTime(notification.createdAt)}
                      </span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
