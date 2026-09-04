import { NextRequest } from 'next/server';
import { getSelectedUserId } from '@/lib/session';

/**
 * Same-origin proxy for issue photos.
 *
 * It adds nothing to what the caller is allowed to see: the request is forwarded
 * to the API's authenticated, venue-scoped attachment route, so a user from
 * another venue gets the API's 404 passed straight back.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ issueId: string; attachmentId: string }> },
) {
  const { issueId, attachmentId } = await params;
  const userId = await getSelectedUserId();

  if (!userId) return new Response('Not authenticated', { status: 401 });

  const base =
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://127.0.0.1:3001/api';

  const upstream = await fetch(
    `${base}/issues/${issueId}/attachments/${attachmentId}`,
    { headers: { 'X-User-Id': userId }, cache: 'no-store' },
  );

  if (!upstream.ok || !upstream.body) {
    return new Response('Not found', { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      // Per-viewer, never shared: this response depends on who is asking.
      'Cache-Control': 'private, max-age=300',
    },
  });
}
