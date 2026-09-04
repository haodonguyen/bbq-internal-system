import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { VenuesModule } from './venues/venues.module';
import { IssuesModule } from './issues/issues.module';
import { CommentsModule } from './comments/comments.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    VenuesModule,
    IssuesModule,
    CommentsModule,
    AttachmentsModule,
    NotificationsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
