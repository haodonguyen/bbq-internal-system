/**
 * Client-safe URL helpers. Kept out of `lib/api.ts` because that module reaches
 * for `next/headers`, which cannot be imported from a client component.
 */

/**
 * Photos are proxied through the Next server rather than linked straight at the
 * API: a browser will not attach the auth header to an <img src>, but it will
 * send our own cookie. The proxy re-attaches the header, so the API's venue
 * scoping still decides who sees the picture.
 */
export function attachmentUrl(issueId: string, attachmentId: string): string {
  return `/photo/${issueId}/${attachmentId}`;
}
