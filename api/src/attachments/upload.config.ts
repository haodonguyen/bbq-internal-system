import { existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { ALLOWED_MIME_TYPES } from './file-signature';

export const MAX_FILES = 8;

export function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? '/data/uploads';
}

export function maxFileBytes(): number {
  return Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024;
}

export function ensureUploadDir(): void {
  const dir = uploadDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Files land under a random temp name with no extension. The service then sniffs
 * the bytes and only afterwards renames them into place — so an upload that lies
 * about its type never gets a usable name on disk.
 */
export const uploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadDir();
      cb(null, uploadDir());
    },
    filename: (_req, _file, cb) => cb(null, `tmp-${randomUUID()}`),
  }),
  limits: {
    fileSize: maxFileBytes(),
    files: MAX_FILES,
  },
  fileFilter: (_req, file, cb) => {
    // A cheap first pass so obvious non-images are rejected before hitting disk.
    // The authoritative check is the byte sniff in AttachmentsService.
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      return cb(
        new Error(`Unsupported file type: ${file.mimetype}`) as any,
        false,
      );
    }
    cb(null, true);
  },
};
