ALTER TABLE "Grade" ADD COLUMN "examId" TEXT;

ALTER TABLE "Grade"
ADD CONSTRAINT "Grade_examId_fkey"
FOREIGN KEY ("examId") REFERENCES "Exam"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Grade_examId_idx" ON "Grade"("examId");
