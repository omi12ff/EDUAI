-- CreateEnum
CREATE TYPE "GradeKind" AS ENUM ('PARCIAL', 'FINAL', 'RECUPERATORIO', 'TAREA', 'PRACTICA', 'LABORATORIO', 'PROYECTO', 'ASISTENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('EDUCA', 'EALU', 'POLIPLANNER', 'MANUAL');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'NEEDS_ACTION', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'NEEDS_REVIEW', 'ERROR');

-- CreateEnum
CREATE TYPE "AcademicEventKind" AS ENUM ('SUBJECT', 'GRADE', 'ASSIGNMENT', 'EXAM', 'SCHEDULE', 'DOCUMENT', 'ANNOUNCEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportReviewStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "GradeKind" NOT NULL DEFAULT 'OTRO',
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "weight" DOUBLE PRECISION,
    "date" TIMESTAMP(3),
    "notes" TEXT,
    "source" "IntegrationProvider" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT,
    "username" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "imported" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "connectionId" TEXT NOT NULL,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedAcademicEvent" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "kind" "AcademicEventKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3),
    "raw" JSONB,
    "status" "ImportReviewStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "connectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedAcademicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Grade_userId_source_externalId_key" ON "Grade"("userId", "source", "externalId");

-- CreateIndex
CREATE INDEX "Grade_userId_subjectId_idx" ON "Grade"("userId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_userId_provider_key" ON "IntegrationConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "ImportedAcademicEvent_userId_status_idx" ON "ImportedAcademicEvent"("userId", "status");

-- CreateIndex
CREATE INDEX "ImportedAcademicEvent_provider_kind_idx" ON "ImportedAcademicEvent"("provider", "kind");

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedAcademicEvent" ADD CONSTRAINT "ImportedAcademicEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedAcademicEvent" ADD CONSTRAINT "ImportedAcademicEvent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedAcademicEvent" ADD CONSTRAINT "ImportedAcademicEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
