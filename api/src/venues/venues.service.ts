import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { venueListScope } from '../common/scope';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Head Office sees every venue; a venue user sees only their own. */
  list(user: AuthUser) {
    return this.prisma.venue.findMany({
      where: venueListScope(user),
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
  }

  /**
   * Who this venue's issues may be assigned to: its own people, plus every Head
   * Office user as the escalation path.
   */
  async assignableUsers(user: AuthUser, venueId: string) {
    const venue = await this.prisma.venue.findFirst({
      where: { AND: [{ id: venueId }, venueListScope(user)] },
    });
    if (!venue) throw new NotFoundException('Venue not found');

    return this.prisma.user.findMany({
      where: { OR: [{ venueId }, { role: Role.HEAD_OFFICE }] },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        venueId: true,
        venue: { select: { id: true, name: true, code: true } },
      },
    });
  }
}
