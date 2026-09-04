import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';

@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.venues.list(user);
  }

  @Get(':id/assignable-users')
  assignable(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.venues.assignableUsers(user, id);
  }
}
