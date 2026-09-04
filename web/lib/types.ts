export type Role = 'HEAD_OFFICE' | 'VENUE_MANAGER' | 'VENUE_STAFF';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export interface Venue {
  id: string;
  name: string;
  code: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  venueId: string | null;
  venue?: Venue | null;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: { id: string; name: string; role: Role };
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: UserSummary;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: IssueStatus;
  dueDate: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  venue: Venue;
  reporter: UserSummary;
  assignee: UserSummary | null;
  attachments?: Attachment[];
  comments?: Comment[];
  _count?: { comments: number; attachments: number };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface Notification {
  id: string;
  type: 'ISSUE_ASSIGNED' | 'ISSUE_COMMENTED' | 'ISSUE_STATUS_CHANGED' | 'ISSUE_OVERDUE';
  message: string;
  readAt: string | null;
  createdAt: string;
  issueId: string | null;
  issue?: { id: string; title: string; status: IssueStatus; priority: Priority } | null;
}

export interface DashboardSummary {
  total: number;
  statusCounts: Record<IssueStatus, number>;
  priorityCounts: Record<Priority, number>;
  overdue: number;
  assignedToMe: number;
  unassigned: number;
  byVenue: (Venue & { open: number; overdue: number })[] | null;
  recentOverdue: (Pick<Issue, 'id' | 'title' | 'dueDate' | 'priority'> & {
    venue: Venue;
    assignee: { id: string; name: string } | null;
  })[];
}
