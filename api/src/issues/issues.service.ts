import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Issue, IssueStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { issueVenueScope, resolveCreateVenueId } from '../common/scope';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { ListIssuesDto } from './dto/list-issues.dto';
import { assertValidTransition, closedAtFor } from './status';

const USER_SUMMARY = {
  select: { id: true, name: true, email: true, role: true, venueId: true },
} as const;

const ISSUE_LIST_INCLUDE = {
  venue: { select: { id: true, name: true, code: true } },
  reporter: USER_SUMMARY,
  assignee: USER_SUMMARY,
  _count: { select: { comments: true, attachments: true } },
} as const;

const ISSUE_DETAIL_INCLUDE = {
  venue: { select: { id: true, name: true, code: true } },
  reporter: USER_SUMMARY,
  assignee: USER_SUMMARY,
  attachments: {
    orderBy: { createdAt: 'asc' },
    include: { uploadedBy: USER_SUMMARY },
  },
  comments: {
    orderBy: { createdAt: 'asc' },
    include: { author: USER_SUMMARY },
  },
} as const;

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * The one way to load an issue for any purpose. Comments and attachments call
   * this first, so they inherit venue isolation rather than re-implementing it.
   *
   * Out-of-scope issues raise 404, not 403 — a 403 would confirm the issue exists
   * and leak that another venue has a record with this id.
   */
  async getScopedIssueOrThrow(user: AuthUser, id: string): Promise<Issue> {
    const issue = await this.prisma.issue.findFirst({
      where: { AND: [{ id }, issueVenueScope(user)] },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  async list(user: AuthUser, query: ListIssuesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const filters: Prisma.IssueWhereInput[] = [
      // Always first, and never derived from client input for venue users.
      issueVenueScope(user, query.venueId),
    ];

    if (query.status?.length) filters.push({ status: { in: query.status } });
    if (query.priority?.length) filters.push({ priority: { in: query.priority } });

    if (query.unassigned) {
      filters.push({ assigneeId: null });
    } else if (query.assigneeId) {
      filters.push({
        assigneeId: query.assigneeId === 'me' ? user.id : query.assigneeId,
      });
    }

    if (query.reporterId) {
      filters.push({
        reporterId: query.reporterId === 'me' ? user.id : query.reporterId,
      });
    }

    if (query.overdue) {
      filters.push({
        dueDate: { lt: new Date() },
        status: { not: IssueStatus.CLOSED },
      });
    }

    if (query.q) {
      filters.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.IssueWhereInput = { AND: filters };
    const sort = query.sort ?? 'createdAt';
    const dir = query.dir ?? 'desc';

    // Nulls last on due date, so undated issues do not crowd out the urgent ones.
    const orderBy: Prisma.IssueOrderByWithRelationInput[] =
      sort === 'dueDate'
        ? [{ dueDate: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }]
        : [{ [sort]: dir } as Prisma.IssueOrderByWithRelationInput, { createdAt: 'desc' }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.issue.findMany({
        where,
        include: ISSUE_LIST_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.issue.count({ where }),
    ]);

    return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }

  async findOne(user: AuthUser, id: string) {
    await this.getScopedIssueOrThrow(user, id);
    return this.prisma.issue.findUniqueOrThrow({
      where: { id },
      include: ISSUE_DETAIL_INCLUDE,
    });
  }

  async create(user: AuthUser, dto: CreateIssueDto) {
    const venueId = resolveCreateVenueId(user, dto.venueId);
    if (!venueId) {
      throw new BadRequestException(
        'venueId is required when raising an issue as a Head Office user',
      );
    }

    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new BadRequestException('Unknown venue');

    if (dto.assigneeId) {
      await this.assertAssignable(dto.assigneeId, venueId);
    }

    const issue = await this.prisma.issue.create({
      data: {
        venueId,
        title: dto.title.trim(),
        description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
        reporterId: user.id,
        assigneeId: dto.assigneeId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: ISSUE_DETAIL_INCLUDE,
    });

    if (issue.assigneeId) {
      await this.notifications.issueAssigned(issue, user);
    }

    return issue;
  }

  async update(user: AuthUser, id: string, dto: UpdateIssueDto) {
    const existing = await this.getScopedIssueOrThrow(user, id);

    const data: Prisma.IssueUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = dto.priority;

    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate === null ? null : new Date(dto.dueDate);
    }

    let assigneeChanged = false;
    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId === null) {
        data.assignee = { disconnect: true };
      } else {
        // Server-side, always: the UI dropdown is a convenience, not a control.
        await this.assertAssignable(dto.assigneeId, existing.venueId);
        data.assignee = { connect: { id: dto.assigneeId } };
      }
      assigneeChanged = dto.assigneeId !== existing.assigneeId;
    }

    let statusChanged = false;
    if (dto.status !== undefined) {
      assertValidTransition(existing.status, dto.status);
      const closedAt = closedAtFor(existing.status, dto.status);
      data.status = dto.status;
      if (closedAt !== undefined) data.closedAt = closedAt;
      statusChanged = dto.status !== existing.status;
    }

    const issue = await this.prisma.issue.update({
      where: { id },
      data,
      include: ISSUE_DETAIL_INCLUDE,
    });

    if (assigneeChanged && issue.assigneeId) {
      await this.notifications.issueAssigned(issue, user);
    }
    if (statusChanged) {
      await this.notifications.issueStatusChanged(issue, user, existing.status);
    }

    return issue;
  }

  /**
   * An assignee must work at the issue's venue, or be Head Office — the escalation
   * path for something a venue cannot fix itself.
   */
  private async assertAssignable(assigneeId: string, venueId: string) {
    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, role: true, venueId: true },
    });
    if (!assignee) throw new BadRequestException('Unknown assignee');

    const allowed =
      assignee.role === Role.HEAD_OFFICE || assignee.venueId === venueId;

    if (!allowed) {
      throw new BadRequestException(
        'An issue can only be assigned to someone at its venue, or to Head Office',
      );
    }
  }
}
