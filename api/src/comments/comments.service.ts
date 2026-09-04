import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { IssuesService } from '../issues/issues.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issues: IssuesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, issueId: string) {
    // Scoping first: if the issue is not visible to this user, neither are its comments.
    await this.issues.getScopedIssueOrThrow(user, issueId);

    return this.prisma.comment.findMany({
      where: { issueId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, email: true, role: true, venueId: true } },
      },
    });
  }

  async create(user: AuthUser, issueId: string, dto: CreateCommentDto) {
    const issue = await this.issues.getScopedIssueOrThrow(user, issueId);

    const comment = await this.prisma.comment.create({
      data: { issueId, authorId: user.id, body: dto.body.trim() },
      include: {
        author: { select: { id: true, name: true, email: true, role: true, venueId: true } },
      },
    });

    await this.notifications.issueCommented(issue, comment, user);
    return comment;
  }
}
