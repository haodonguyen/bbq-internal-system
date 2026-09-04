import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.notifications.listForUser(user, unread === 'true');
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user, id);
  }
}
