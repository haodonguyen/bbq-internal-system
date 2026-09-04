import { Injectable } from '@nestjs/common';
import { IssueStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, isHeadOffice } from '../auth/auth.types';
import { issueVenueScope } from '../common/scope';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Counts over exactly the issues the caller may see — same scope helper as the
   * list, so the dashboard totals can never disagree with what the list shows.
   */
  async summary(user: AuthUser, requestedVenueId?: string) {
    const scope = issueVenueScope(user, requestedVenueId);
    const now = new Date();

    const overdueWhere: Prisma.IssueWhereInput = {
      AND: [scope, { dueDate: { lt: now }, status: { not: IssueStatus.CLOSED } }],
    };

    const [byStatus, byPriority, overdue, assignedToMe, unassigned, total] =
      await Promise.all([
        this.prisma.issue.groupBy({
          by: ['status'],
          where: scope,
          _count: { _all: true },
        }),
        this.prisma.issue.groupBy({
          by: ['priority'],
          where: { AND: [scope, { status: { not: IssueStatus.CLOSED } }] },
          _count: { _all: true },
        }),
        this.prisma.issue.count({ where: overdueWhere }),
        this.prisma.issue.count({
          where: {
            AND: [scope, { assigneeId: user.id, status: { not: IssueStatus.CLOSED } }],
          },
        }),
        this.prisma.issue.count({
          where: {
            AND: [scope, { assigneeId: null, status: { not: IssueStatus.CLOSED } }],
          },
        }),
        this.prisma.issue.count({ where: scope }),
      ]);

    const statusCounts = {
      OPEN: 0,
      IN_PROGRESS: 0,
      CLOSED: 0,
      ...Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
    };

    const priorityCounts = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
      ...Object.fromEntries(byPriority.map((r) => [r.priority, r._count._all])),
    };

    return {
      total,
      statusCounts,
      priorityCounts,
      overdue,
      assignedToMe,
      unassigned,
      byVenue: isHeadOffice(user) ? await this.perVenue(now) : null,
      recentOverdue: await this.prisma.issue.findMany({
        where: overdueWhere,
        orderBy: { dueDate: 'asc' },
        take: 5,
        include: {
          venue: { select: { id: true, name: true, code: true } },
          assignee: { select: { id: true, name: true } },
        },
      }),
    };
  }

  /**
   * Head Office only. Two grouped queries rather than a pair per venue, so the
   * cost does not grow with the estate.
   */
  private async perVenue(now: Date) {
    const [venues, openGroups, overdueGroups] = await Promise.all([
      this.prisma.venue.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.issue.groupBy({
        by: ['venueId'],
        where: { status: { not: IssueStatus.CLOSED } },
        _count: { _all: true },
      }),
      this.prisma.issue.groupBy({
        by: ['venueId'],
        where: { dueDate: { lt: now }, status: { not: IssueStatus.CLOSED } },
        _count: { _all: true },
      }),
    ]);

    const openBy = new Map(openGroups.map((g) => [g.venueId, g._count._all]));
    const overdueBy = new Map(overdueGroups.map((g) => [g.venueId, g._count._all]));

    return venues.map((venue) => ({
      ...venue,
      open: openBy.get(venue.id) ?? 0,
      overdue: overdueBy.get(venue.id) ?? 0,
    }));
  }
}
