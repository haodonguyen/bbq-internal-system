import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { rename, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { IssuesService } from '../issues/issues.service';
import { canManage } from '../common/scope';
import {
  AllowedMimeType,
  extensionFor,
  readFileHeader,
  sniffImageMimeType,
} from './file-signature';
import { uploadDir } from './upload.config';

const ATTACHMENT_INCLUDE = {
  uploadedBy: { select: { id: true, name: true, role: true } },
} as const;

/** A file that passed validation and has a name reserved, but is not yet stored. */
interface PendingAttachment {
  file: Express.Multer.File;
  mimeType: AllowedMimeType;
  storedName: string;
}

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly issues: IssuesService,
  ) {}

  /**
   * Uploads are all-or-nothing.
   *
   * Multer has already written every file to disk by the time this runs, so the
   * work is in three phases: validate everything, only then move it into place,
   * and clean up whatever is left over on any exit. Committing as we went meant a
   * batch with one bad file returned 400 while quietly keeping the good ones, and
   * left the unreached files sitting in the upload directory forever.
   */
  async upload(user: AuthUser, issueId: string, files: Express.Multer.File[]) {
    const issue = await this.issues.getScopedIssueOrThrow(user, issueId);

    if (!files?.length) {
      throw new BadRequestException('No files were uploaded');
    }

    const dir = uploadDir();
    const moved: string[] = [];

    try {
      // Phase 1 — check every file before any of them counts as an attachment.
      const rows: PendingAttachment[] = [];
      for (const file of files) {
        const detected = sniffImageMimeType(await readFileHeader(file.path));
        if (!detected) {
          throw new BadRequestException(
            `"${file.originalname}" is not a JPEG, PNG, WebP or HEIC image`,
          );
        }
        rows.push({
          file,
          mimeType: detected,
          storedName: `${randomUUID()}${extensionFor(detected)}`,
        });
      }

      // Phase 2 — move them into place, remembering what to undo.
      for (const row of rows) {
        await rename(row.file.path, join(dir, row.storedName));
        moved.push(row.storedName);
      }

      // Phase 3 — one transaction, so a failure part-way leaves no rows behind.
      return await this.prisma.$transaction(
        rows.map((row) =>
          this.prisma.attachment.create({
            data: {
              issueId: issue.id,
              storedName: row.storedName,
              // Display only — never used to build a filesystem path.
              originalName: basename(row.file.originalname).slice(0, 255),
              mimeType: row.mimeType,
              sizeBytes: row.file.size,
              uploadedById: user.id,
            },
            include: ATTACHMENT_INCLUDE,
          }),
        ),
      );
    } catch (error) {
      // Undo anything already moved, so a failed upload leaves the directory as
      // it found it.
      await Promise.all(moved.map((name) => this.discard(join(dir, name))));
      throw error;
    } finally {
      // Anything multer wrote that was never moved: the rejected file, and every
      // file queued behind it.
      await Promise.all(files.map((file) => this.discard(file.path)));
    }
  }

  /**
   * Photos are streamed through this route, never served as static files: the
   * same venue scoping that hides an issue has to hide its pictures too.
   */
  async stream(user: AuthUser, issueId: string, attachmentId: string) {
    await this.issues.getScopedIssueOrThrow(user, issueId);

    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, issueId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    // storedName is a generated uuid + known extension, but resolve and re-check
    // anyway so a bad row can never read outside the upload directory.
    const dir = resolve(uploadDir());
    const path = resolve(join(dir, attachment.storedName));
    if (!path.startsWith(dir + '/')) {
      throw new NotFoundException('Attachment not found');
    }

    try {
      await stat(path);
    } catch {
      this.logger.warn(`Attachment ${attachment.id} missing on disk at ${path}`);
      throw new NotFoundException('Attachment file is missing');
    }

    return {
      file: new StreamableFile(createReadStream(path)),
      mimeType: attachment.mimeType,
      originalName: attachment.originalName,
    };
  }

  async remove(user: AuthUser, issueId: string, attachmentId: string) {
    await this.issues.getScopedIssueOrThrow(user, issueId);

    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, issueId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.uploadedById !== user.id && !canManage(user)) {
      throw new ForbiddenException(
        'Only the uploader, a venue manager or Head Office can remove a photo',
      );
    }

    await this.prisma.attachment.delete({ where: { id: attachment.id } });
    await this.discard(join(uploadDir(), attachment.storedName));
    return { ok: true };
  }

  /** Best-effort cleanup; a stranded file must never fail the request. */
  private async discard(path: string) {
    try {
      await rm(path, { force: true });
    } catch (error) {
      this.logger.warn(`Could not remove ${path}: ${error}`);
    }
  }
}
