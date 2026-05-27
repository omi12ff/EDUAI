-- CreateTable
CREATE TABLE "AcademicImport" (
    "id" TEXT NOT NULL,
    "career" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "semester" TEXT,
    "group" TEXT,
    "teacher" TEXT,
    "email" TEXT,
    "firstPartialDate" TEXT,
    "secondPartialDate" TEXT,
    "firstFinalDate" TEXT,
    "secondFinalDate" TEXT,
    "monday" TEXT,
    "tuesday" TEXT,
    "wednesday" TEXT,
    "thursday" TEXT,
    "friday" TEXT,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicImport_pkey" PRIMARY KEY ("id")
);
