import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { MAX_FILES, uploadOptions } from './upload.config';

@Controller('issues/:issueId/attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  // MAX_FILES + 1 mirrors the multer limit: the extra slot exists so the service
  // can report the overflow rather than the connection simply dropping.
  @UseInterceptors(FilesInterceptor('files', MAX_FILES + 1, uploadOptions))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.attachments.upload(user, issueId, files);
  }

  @Get(':attachmentId')
  async stream(
    @CurrentUser() user: AuthUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { file, mimeType, originalName } = await this.attachments.stream(
      user,
      issueId,
      attachmentId,
    );

    res.set({
      'Content-Type': mimeType,
      // Quotes stripped from the display name so it cannot break out of the header.
      'Content-Disposition': `inline; filename="${originalName.replace(/["\\]/g, '')}"`,
      // Tenant-scoped, so not cacheable at all. `private` keeps shared caches
      // out, but the browser cache is keyed on URL alone — after a user switch
      // it would happily replay another venue's photo from disk without ever
      // asking the API, and the venue check would never run.
      'Cache-Control': 'no-store',
    });

    return file;
  }

  @Delete(':attachmentId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachments.remove(user, issueId, attachmentId);
  }
}
