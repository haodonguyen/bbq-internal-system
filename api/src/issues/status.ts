import { BadRequestException } from '@nestjs/common';
import { IssueStatus } from '@prisma/client';

/**
 * OPEN        -> IN_PROGRESS, CLOSED
 * IN_PROGRESS -> OPEN, CLOSED
 * CLOSED      -> OPEN            (reopen)
 *
 * Staying put is always allowed and is a no-op.
 */
const ALLOWED: Record<IssueStatus, IssueStatus[]> = {
  [IssueStatus.OPEN]: [IssueStatus.IN_PROGRESS, IssueStatus.CLOSED],
  [IssueStatus.IN_PROGRESS]: [IssueStatus.OPEN, IssueStatus.CLOSED],
  [IssueStatus.CLOSED]: [IssueStatus.OPEN],
};

export function isValidTransition(from: IssueStatus, to: IssueStatus): boolean {
  return from === to || ALLOWED[from].includes(to);
}

export function assertValidTransition(from: IssueStatus, to: IssueStatus): void {
  if (!isValidTransition(from, to)) {
    throw new BadRequestException(
      `Cannot move an issue from ${from} to ${to}. Allowed from ${from}: ${ALLOWED[from].join(', ')}.`,
    );
  }
}

/**
 * `closedAt` is derived from the status, never set by the client: stamped on the
 * way into CLOSED, cleared on reopen.
 */
export function closedAtFor(
  from: IssueStatus,
  to: IssueStatus,
): Date | null | undefined {
  if (from === to) return undefined;
  if (to === IssueStatus.CLOSED) return new Date();
  if (from === IssueStatus.CLOSED) return null;
  return undefined;
}
