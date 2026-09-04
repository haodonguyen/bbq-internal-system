import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Comment, Issue, IssueStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything that writes a notification goes through here, so the "never notify
   * yourself about your own action" rule lives in one place.
   */
  private async emit(params: {
    userIds: (string | null | undefined)[];
    actorId: string;
    type: NotificationType;
    message: string;
    issueId?: string;
  }) {
    const recipients = [...new Set(params.userIds.filter(Boolean) as string[])]
      .filter((id) => id !== params.actorId);

    if (recipients.length === 0) return;

    await this.prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: params.type,
        message: params.message,
        issueId: params.issueId,
      })),
    });
  }

  async issueAssigned(issue: Issue, actor: AuthUser) {
    await this.emit({
      userIds: [issue.assigneeId],
      actorId: actor.id,
      type: NotificationType.ISSUE_ASSIGNED,
      message: `${actor.name} assigned you "${issue.title}"`,
      issueId: issue.id,
    });
  }

  async issueStatusChanged(issue: Issue, actor: AuthUser, from: IssueStatus) {
    await this.emit({
      userIds: [issue.reporterId, issue.assigneeId],
      actorId: actor.id,
      type: NotificationType.ISSUE_STATUS_CHANGED,
      message: `${actor.name} moved "${issue.title}" from ${label(from)} to ${label(issue.status)}`,
      issueId: issue.id,
    });
  }

  async issueCommented(issue: Issue, _comment: Comment, actor: AuthUser) {
    await this.emit({
      userIds: [issue.reporterId, issue.assigneeId],
      actorId: actor.id,
      type: NotificationType.ISSUE_COMMENTED,
      message: `${actor.name} commented on "${issue.title}"`,
      issueId: issue.id,
    });
  }

  async listForUser(user: AuthUser, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        issue: { select: { id: true, title: true, status: true, priority: true } },
      },
    });
  }

  async unreadCount(user: AuthUser) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { count };
  }

  async markRead(user: AuthUser, id: string) {
    // Scoped by userId in the where clause, so one user cannot mark another's read.
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.notification.findFirst({
        where: { id, userId: user.id },
      });
      if (!exists) throw new NotFoundException('Notification not found');
    }
    return { ok: true };
  }

  async markAllRead(user: AuthUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /**
   * Daily sweep for issues that have gone past their due date. Notifies the
   * assignee (or the reporter if unassigned) once per issue — a second run on the
   * same day finds the existing notification and skips it.
   */
  @Cron('0 7 * * *')
  async notifyOverdue() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const overdue = await this.prisma.issue.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { not: IssueStatus.CLOSED },
      },
      select: { id: true, title: true, assigneeId: true, reporterId: true },
    });

    let created = 0;
    for (const issue of overdue) {
      const userId = issue.assigneeId ?? issue.reporterId;

      const alreadyTold = await this.prisma.notification.findFirst({
        where: {
          userId,
          issueId: issue.id,
          type: NotificationType.ISSUE_OVERDUE,
          createdAt: { gte: since },
        },
      });
      if (alreadyTold) continue;

      await this.prisma.notification.create({
        data: {
          userId,
          issueId: issue.id,
          type: NotificationType.ISSUE_OVERDUE,
          message: `"${issue.title}" is past its due date`,
        },
      });
      created++;
    }

    if (created > 0) {
      this.logger.log(`Overdue sweep: ${created} notification(s) created`);
    }
    return { checked: overdue.length, created };
  }
}

function label(status: IssueStatus): string {
  return status === IssueStatus.IN_PROGRESS ? 'In Progress' : status === IssueStatus.OPEN ? 'Open' : 'Closed';
}
