'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadPhotos, type ActionResult } from '@/app/actions';
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
            <li key={attachment.id}>
              <button
                type="button"
                onClick={() => setLightbox(attachment)}
                className="group block w-full overflow-hidden rounded-md border border-slate-200
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
            </li>
          ))}
        </ul>
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
