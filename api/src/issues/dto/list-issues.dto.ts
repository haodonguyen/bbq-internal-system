import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IssueStatus, Priority } from '@prisma/client';

/** `?status=OPEN&status=CLOSED` and `?status=OPEN,CLOSED` both work. */
const toArray = ({ value }: { value: unknown }): unknown[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  return raw.flatMap((v) => String(v).split(',')).filter(Boolean);
};

export const ISSUE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'dueDate',
  'priority',
  'status',
  'title',
] as const;
export type IssueSortField = (typeof ISSUE_SORT_FIELDS)[number];

export class ListIssuesDto {
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(IssueStatus, { each: true })
  status?: IssueStatus[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(Priority, { each: true })
  priority?: Priority[];

  /** A user id, or the literal `me`. */
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  reporterId?: string;

  /** Honoured for Head Office only; silently ignored for venue users. */
  @IsOptional()
  @IsString()
  venueId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unassigned?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(ISSUE_SORT_FIELDS as unknown as string[])
  sort?: IssueSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize?: number;
}
