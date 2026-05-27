/*
  Warnings:

  - You are about to drop the column `status` on the `Assignment` table. All the data in the column will be lost.
  - You are about to drop the column `classroom` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Grade` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_userId_fkey";

-- DropIndex
DROP INDEX "Enrollment_userId_subjectId_key";

-- AlterTable
ALTER TABLE "Assignment" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Schedule" DROP COLUMN "classroom";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "updatedAt";

-- DropTable
DROP TABLE "Grade";

-- DropEnum
DROP TYPE "AssignmentStatus";
