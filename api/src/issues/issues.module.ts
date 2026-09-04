import { Module } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}
