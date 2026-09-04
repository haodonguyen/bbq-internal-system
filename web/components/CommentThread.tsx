'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { addComment, type ActionResult } from '@/app/actions';
import { Avatar } from './Badges';
import { ROLE_LABEL, formatDateTime } from '@/lib/format';
import type { Comment } from '@/lib/types';

export function CommentThread({
  issueId,
  comments,
}: {
  issueId: string;
  comments: Comment[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    async (_previous, formData) => {
      const result = await addComment(issueId, formData);
      if ('ok' in result) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">
        Comments {comments.length > 0 && <span className="text-slate-400">({comments.length})</span>}
      </h2>

      {comments.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">
          No comments yet. Add an update so the venue and Head Office stay in the loop.
        </p>
      ) : (
        <ol className="mb-5 space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar name={comment.author.name} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-slate-900">
                    {comment.author.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {ROLE_LABEL[comment.author.role]} · {formatDateTime(comment.createdAt)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form ref={formRef} action={formAction} className="border-t border-slate-100 pt-4">
        <label htmlFor="comment-body" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="comment-body"
          name="body"
          rows={3}
          required
          maxLength={5000}
          placeholder="Add an update…"
          className="field resize-y"
        />
        {state && 'error' in state && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {state.error}
          </p>
        )}
        <div className="mt-2 flex justify-end">
          <CommentSubmit />
        </div>
      </form>
    </section>
  );
}

function CommentSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Posting…' : 'Comment'}
    </button>
  );
}
