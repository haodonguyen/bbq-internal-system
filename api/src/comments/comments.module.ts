import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { IssuesModule } from '../issues/issues.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [IssuesModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
