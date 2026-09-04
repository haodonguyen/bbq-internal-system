import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { readFile, rename, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { IssuesService } from '../issues/issues.service';
import { canManage } from '../common/scope';
import { extensionFor, sniffImageMimeType } from './file-signature';
import { uploadDir } from './upload.config';

const ATTACHMENT_INCLUDE = {
  uploadedBy: { select: { id: true, name: true, role: true } },
} as const;

type AttachmentWithUploader = Prisma.AttachmentGetPayload<{
  include: typeof ATTACHMENT_INCLUDE;
}>;

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly issues: IssuesService,
  ) {}

  async upload(
    user: AuthUser,
    issueId: string,
    files: Express.Multer.File[],
  ) {
    const issue = await this.issues.getScopedIssueOrThrow(user, issueId);

    if (!files?.length) {
      throw new BadRequestException('No files were uploaded');
    }

    const created: AttachmentWithUploader[] = [];
    for (const file of files) {
      // Multer has already written the file to a temp name. Check what it
      // actually is before it becomes an attachment.
      const head = await readFile(file.path).then((buf) => buf.subarray(0, 32));
      const detected = sniffImageMimeType(head);

      if (!detected) {
        await this.discard(file.path);
        throw new BadRequestException(
          `"${file.originalname}" is not a JPEG, PNG, WebP or HEIC image`,
        );
      }

      const storedName = `${randomUUID()}${extensionFor(detected)}`;
      await rename(file.path, join(uploadDir(), storedName));

      created.push(
        await this.prisma.attachment.create({
          data: {
            issueId: issue.id,
            storedName,
            // Display only — never used to build a filesystem path.
            originalName: basename(file.originalname).slice(0, 255),
            mimeType: detected,
            sizeBytes: file.size,
            uploadedById: user.id,
          },
          include: ATTACHMENT_INCLUDE,
        }),
      );
    }

    return created;
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
