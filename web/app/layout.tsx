import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { api } from '@/lib/api';
import { getSelectedUserId } from '@/lib/session';
import { UserSwitcher } from '@/components/UserSwitcher';
import { NotificationBell } from '@/components/NotificationBell';
import type { Notification, UserSummary } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Third Wave BBQ — Maintenance',
  description: 'Maintenance and operational issue tracking across venues',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The dev user list is unauthenticated by design — it is the stand-in for a
  // login screen, and is not registered at all in production.
  const users = await api<UserSummary[]>('/dev/users', { anonymous: true }).catch(
    () => [] as UserSummary[],
  );

  const selectedId = await getSelectedUserId();
  const current = users.find((user) => user.id === selectedId) ?? null;

  const notifications = current
    ? await api<Notification[]>('/notifications').catch(() => [])
    : [];

  return (
    <html lang="en-AU">
      <body>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ember-600 text-sm font-bold text-white">
                3W
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold text-slate-900">
                  Third Wave BBQ
                </span>
                <span className="block text-[11px] text-slate-500">Maintenance</span>
              </span>
            </Link>

            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/issues">Issues</NavLink>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {current && (
                <Link href="/issues/new" className="btn-primary">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                    <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                  </svg>
                  <span className="hidden sm:inline">New issue</span>
                </Link>
              )}
              {current && <NotificationBell notifications={notifications} />}
              <UserSwitcher users={users} current={current} />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2.5 py-1.5 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}
