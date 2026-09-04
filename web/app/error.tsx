'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Catches anything a page throws — most often the API being unreachable, which
 * makes every data fetch fail. Without this the user gets Next's raw
 * "Application error: a server-side exception has occurred" screen with no way
 * forward.
 *
 * The root layout handles its own fetch failure, so it is not covered here (that
 * would need global-error.tsx).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();

  // reset() alone re-renders the segment from the payload that already failed.
  // The data has to be refetched from the server first, or the button appears to
  // do nothing once the API comes back.
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="card mx-auto mt-12 max-w-lg p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        This page could not be loaded. The most likely cause is that the API is not
        reachable — check that it is running, then try again.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-slate-400">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="btn-primary"
        >
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
        <Link href="/signout" className="btn-secondary">
          Choose another user
        </Link>
      </div>
    </div>
  );
}
