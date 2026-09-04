import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateIssueDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  description!: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /** Head Office must supply this. Ignored for venue users, who file against their own venue. */
  @IsOptional()
  @IsUUID()
  venueId?: string;
}
