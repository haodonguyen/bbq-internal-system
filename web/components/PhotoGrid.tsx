'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { deletePhoto, uploadPhotos, type ActionResult } from '@/app/actions';
import { attachmentUrl } from '@/lib/urls';
import { formatBytes } from '@/lib/format';
import type { Attachment } from '@/lib/types';

export function PhotoGrid({
  issueId,
  attachments,
  initialError,
}: {
  issueId: string;
  attachments: Attachment[];
  initialError?: string;
}) {
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(attachment: Attachment) {
    setRemoveError(null);
    setRemoving(attachment.id);
    startTransition(async () => {
      const result = await deletePhoto(issueId, attachment.id);
      if ('error' in result) setRemoveError(result.error);
      setRemoving(null);
    });
  }

  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    async (_previous, formData) => uploadPhotos(issueId, formData),
    initialError ? { error: initialError } : null,
  );

  return (
    <section className="card p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        Photos {attachments.length > 0 && <span className="text-slate-400">({attachments.length})</span>}
      </h2>

      {attachments.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="group relative">
              <button
                type="button"
                onClick={() => setLightbox(attachment)}
                className="block w-full overflow-hidden rounded-md border border-slate-200
                           transition hover:border-ember-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachmentUrl(issueId, attachment.id)}
                  alt={attachment.originalName}
                  loading="lazy"
                  className="h-28 w-full bg-slate-100 object-cover transition group-hover:opacity-90"
                />
                <span className="block truncate px-2 py-1 text-left text-[11px] text-slate-500">
                  {attachment.originalName} · {formatBytes(attachment.sizeBytes)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(attachment)}
                disabled={removing === attachment.id}
                aria-label={`Remove ${attachment.originalName}`}
                className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-slate-500
                           opacity-0 shadow-sm transition hover:bg-white hover:text-red-600
                           focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
              >
                {removing === attachment.id ? (
                  <span className="block h-4 w-4 text-[10px] leading-4">…</span>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M8.75 1a1 1 0 0 0-.96.71L7.56 2.5H4.25a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5h-3.31l-.23-.79A1 1 0 0 0 11.25 1h-2.5ZM5.06 5.5l.66 10.02A2 2 0 0 0 7.71 17.5h4.58a2 2 0 0 0 1.99-1.98l.66-10.02H5.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {removeError && (
        <p role="alert" className="mb-3 text-xs text-red-700">
          {removeError}
        </p>
      )}

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="photos"
          accept="image/*"
          capture="environment"
          multiple
          className="block w-full max-w-xs text-xs text-slate-500
                     file:mr-3 file:rounded-md file:border-0 file:bg-slate-100
                     file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700
                     hover:file:bg-slate-200"
        />
        <UploadButton />
        {state && 'error' in state && (
          <p role="alert" className="w-full text-xs text-red-700">
            {state.error}
          </p>
        )}
      </form>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.originalName}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachmentUrl(issueId, lightbox.id)}
            alt={lightbox.originalName}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-5 top-5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-secondary">
      {pending ? 'Uploading…' : 'Upload'}
    </button>
  );
}
