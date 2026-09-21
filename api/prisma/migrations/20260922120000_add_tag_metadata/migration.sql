-- M1 UI Foundation + Tags: stable user-owned tag metadata while Task.tags and
-- Inspiration.tags remain the entity snapshots used by existing query paths.

CREATE TABLE "tags" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#cae393',
  "parentId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tags_userId_name_key" ON "tags"("userId", "name");
CREATE INDEX "tags_userId_archived_sortOrder_idx" ON "tags"("userId", "archived", "sortOrder");
CREATE INDEX "tags_parentId_idx" ON "tags"("parentId");

ALTER TABLE "tags" ADD CONSTRAINT "tags_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed metadata from the current string snapshots without changing either fact source.
INSERT INTO "tags" ("id", "userId", "name", "sortOrder", "updatedAt")
SELECT md5(source."userId" || ':' || source.name), source."userId", source.name,
       (row_number() OVER (PARTITION BY source."userId" ORDER BY source.name) - 1)::integer,
       CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT t."userId", btrim(tag_name) AS name
  FROM "tasks" t, unnest(t."tags") AS tag_name
  WHERE btrim(tag_name) <> ''
  UNION
  SELECT DISTINCT i."userId", btrim(tag_name) AS name
  FROM "inspirations" i, unnest(i."tags") AS tag_name
  WHERE btrim(tag_name) <> ''
) source
ON CONFLICT ("userId", "name") DO NOTHING;

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tags FROM anon, authenticated;
CREATE POLICY deny_direct_client_access ON public.tags
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
