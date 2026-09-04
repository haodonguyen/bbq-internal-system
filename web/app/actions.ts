'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { api, ApiError } from '@/lib/api';
import { USER_COOKIE } from '@/lib/session';
import type { Issue } from '@/lib/types';

export type ActionResult = { error: string } | { ok: true };

/** DEV ONLY — the switcher. Replaced by a real login. */
export async function selectUser(userId: string, from?: string) {
  const store = await cookies();
  store.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath('/', 'layout');

  // Coming from the sign-in screen there is nowhere to stay, so land on the
  // dashboard. Switching from a real page keeps you where you were, which is what
  // makes "the same URL, seen as someone else" easy to try.
  if (!from || from === '/welcome') redirect('/');
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}

export async function createIssue(formData: FormData): Promise<ActionResult> {
  const photos = selectFiles(formData);

  let issue: Issue;
  try {
    issue = await api<Issue>('/issues', {
      method: 'POST',
      body: {
        title: String(formData.get('title') ?? ''),
        description: String(formData.get('description') ?? ''),
        priority: String(formData.get('priority') ?? 'MEDIUM'),
        assigneeId: emptyToUndefined(formData.get('assigneeId')),
        dueDate: toIsoOrUndefined(formData.get('dueDate')),
        venueId: emptyToUndefined(formData.get('venueId')),
      },
    });
  } catch (error) {
    return { error: toMessage(error) };
  }

  if (photos.length > 0) {
    // The issue is already saved, so a rejected photo loses the photo, not the
    // report. Surfaced on the detail page rather than discarding the issue.
    try {
      const upload = new FormData();
      for (const photo of photos) upload.append('files', photo);
      await api(`/issues/${issue.id}/attachments`, { method: 'POST', body: upload });
    } catch (error) {
      revalidatePath('/issues');
      redirect(`/issues/${issue.id}?photoError=${encodeURIComponent(toMessage(error))}`);
    }
  }

  revalidatePath('/issues');
  revalidatePath('/');
  redirect(`/issues/${issue.id}`);
}

export async function updateIssue(
  issueId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await api(`/issues/${issueId}`, { method: 'PATCH', body: patch });
  } catch (error) {
    return { error: toMessage(error) };
  }
  revalidatePath(`/issues/${issueId}`);
  revalidatePath('/issues');
  revalidatePath('/');
  return { ok: true };
}

export async function addComment(
  issueId: string,
  formData: FormData,
): Promise<ActionResult> {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return { error: 'Write something first.' };

  try {
    await api(`/issues/${issueId}/comments`, { method: 'POST', body: { body } });
  } catch (error) {
    return { error: toMessage(error) };
  }
  revalidatePath(`/issues/${issueId}`);
  return { ok: true };
}

export async function uploadPhotos(
  issueId: string,
  formData: FormData,
): Promise<ActionResult> {
  const photos = selectFiles(formData);
  if (photos.length === 0) return { error: 'Choose at least one photo.' };

  const upload = new FormData();
  for (const photo of photos) upload.append('files', photo);

  try {
    await api(`/issues/${issueId}/attachments`, { method: 'POST', body: upload });
  } catch (error) {
    return { error: toMessage(error) };
  }
  revalidatePath(`/issues/${issueId}`);
  return { ok: true };
}

export async function deletePhoto(
  issueId: string,
  attachmentId: string,
): Promise<ActionResult> {
  try {
    await api(`/issues/${issueId}/attachments/${attachmentId}`, { method: 'DELETE' });
  } catch (error) {
    return { error: toMessage(error) };
  }
  revalidatePath(`/issues/${issueId}`);
  return { ok: true };
}

export async function markAllNotificationsRead() {
  await api('/notifications/read-all', { method: 'POST' });
  revalidatePath('/', 'layout');
}

export async function markNotificationRead(id: string) {
  await api(`/notifications/${id}/read`, { method: 'POST' });
  revalidatePath('/', 'layout');
}

/**
 * `File` is only a global from Node 20 on, so duck-type instead of using
 * `instanceof` — the app has to run on 18 too.
 */
function selectFiles(formData: FormData): File[] {
  return formData
    .getAll('photos')
    .filter(
      (entry): entry is File =>
        typeof entry !== 'string' &&
        typeof (entry as File).size === 'number' &&
        (entry as File).size > 0,
    );
}

function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  const text = value === null ? '' : String(value).trim();
  return text === '' ? undefined : text;
}

function toIsoOrUndefined(value: FormDataEntryValue | null): string | undefined {
  const text = emptyToUndefined(value);
  return text ? new Date(text).toISOString() : undefined;
}
