import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IssuesService } from './issues.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { ListIssuesDto } from './dto/list-issues.dto';

// Controllers pass `user` straight through; the service owns venue scoping, so a
// future non-HTTP caller inherits the same rule instead of re-deriving it.
@Controller('issues')
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListIssuesDto) {
    return this.issues.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIssueDto) {
    return this.issues.create(user, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.issues.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIssueDto,
  ) {
    return this.issues.update(user, id, dto);
  }
}
