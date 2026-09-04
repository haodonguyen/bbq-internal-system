import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { IssuesModule } from '../issues/issues.module';

@Module({
  imports: [IssuesModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
