import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query('venueId') venueId?: string) {
    return this.dashboard.summary(user, venueId);
  }
}
