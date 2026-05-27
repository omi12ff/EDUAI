ALTER TABLE "Subject" ADD COLUMN "userId" TEXT;

UPDATE "Subject"
SET "userId" = (
    SELECT "id"
    FROM "User"
    ORDER BY "createdAt" ASC
    LIMIT 1
)
WHERE "userId" IS NULL
  AND EXISTS (SELECT 1 FROM "User");

CREATE INDEX "Subject_userId_idx" ON "Subject"("userId");

ALTER TABLE "Subject" ADD CONSTRAINT "Subject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
