import { Controller, Get, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from './auth.types';

@Controller()
export class DevController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Backs the frontend user switcher. Deliberately unauthenticated because it is
   * the only way to obtain an id for the header — and deliberately unavailable
   * in production, where a real login replaces it.
   */
  @Public()
  @Get('dev/users')
  async devUsers() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        venueId: true,
        venue: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
