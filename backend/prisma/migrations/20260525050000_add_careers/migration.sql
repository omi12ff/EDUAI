CREATE TABLE "Career" (
  "id" TEXT NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Career_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Career_code_key" ON "Career"("code");
CREATE UNIQUE INDEX "Career_name_key" ON "Career"("name");

INSERT INTO "Career" ("id", "code", "name")
SELECT md5("career"), NULL, "career"
FROM (
  SELECT DISTINCT "career"
  FROM "AcademicImport"
  WHERE "career" IS NOT NULL AND trim("career") <> ''
) AS imported_careers
ON CONFLICT ("name") DO NOTHING;
