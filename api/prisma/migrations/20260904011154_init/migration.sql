-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HEAD_OFFICE', 'VENUE_MANAGER', 'VENUE_STAFF');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ISSUE_ASSIGNED', 'ISSUE_COMMENTED', 'ISSUE_STATUS_CHANGED', 'ISSUE_OVERDUE');

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "venueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "issueId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_code_key" ON "Venue"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_venueId_idx" ON "User"("venueId");

-- CreateIndex
CREATE INDEX "Issue_venueId_status_idx" ON "Issue"("venueId", "status");

-- CreateIndex
CREATE INDEX "Issue_assigneeId_idx" ON "Issue"("assigneeId");

-- CreateIndex
CREATE INDEX "Issue_dueDate_idx" ON "Issue"("dueDate");

-- CreateIndex
CREATE INDEX "Issue_createdAt_idx" ON "Issue"("createdAt");

-- CreateIndex
CREATE INDEX "Attachment_issueId_idx" ON "Attachment"("issueId");

-- CreateIndex
CREATE INDEX "Comment_issueId_createdAt_idx" ON "Comment"("issueId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
