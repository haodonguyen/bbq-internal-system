import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IssueStatus, Priority } from '@prisma/client';

export class UpdateIssueDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  description?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  /** Explicit null unassigns. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeId?: string | null;

  /** Explicit null clears the due date. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dueDate?: string | null;
}
