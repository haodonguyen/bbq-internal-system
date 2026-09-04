import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('issues/:issueId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
  ) {
    return this.comments.list(user, issueId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(user, issueId, dto);
  }
}
