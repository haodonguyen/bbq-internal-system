import { open } from 'node:fs/promises';

/**
 * Verifies an uploaded file really is one of the image formats we accept, by
 * looking at its leading bytes rather than trusting the client-supplied
 * Content-Type — which is just a string the uploader chose.
 */
const ALLOWED_HEIF_BRANDS = new Set([
  'heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1',
]);

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Returns the detected mime type, or null if the bytes are not an accepted image. */
export function sniffImageMimeType(buffer: Buffer): AllowedMimeType | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((byte, i) => buffer[i] === byte)) {
    return 'image/png';
  }

  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (
    buffer.toString('ascii', 4, 8) === 'ftyp' &&
    ALLOWED_HEIF_BRANDS.has(buffer.toString('ascii', 8, 12).toLowerCase())
  ) {
    return 'image/heic';
  }

  return null;
}

const EXTENSIONS: Record<AllowedMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

/** Extension is derived from the sniffed type, never from the uploaded filename. */
export function extensionFor(mimeType: AllowedMimeType): string {
  return EXTENSIONS[mimeType];
}

/**
 * Reads just the leading bytes of a file.
 *
 * The whole point is not to pull a 10 MB photo into memory to look at 32 bytes —
 * eight of those in one request was 80 MB of Buffers for no reason.
 */
export async function readFileHeader(path: string, length = 32): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
