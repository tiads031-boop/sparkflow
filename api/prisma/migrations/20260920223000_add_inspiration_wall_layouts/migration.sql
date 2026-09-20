CREATE TABLE "inspiration_wall_layouts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inspirationId" TEXT NOT NULL,
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL,
  "width" DOUBLE PRECISION NOT NULL DEFAULT 176,
  "height" DOUBLE PRECISION NOT NULL DEFAULT 156,
  "z" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT NOT NULL DEFAULT '#f2f0e8',
  "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inspiration_wall_layouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inspiration_wall_layouts_userId_inspirationId_key"
  ON "inspiration_wall_layouts"("userId", "inspirationId");
CREATE INDEX "inspiration_wall_layouts_userId_z_idx"
  ON "inspiration_wall_layouts"("userId", "z");
CREATE INDEX "inspiration_wall_layouts_inspirationId_idx"
  ON "inspiration_wall_layouts"("inspirationId");

ALTER TABLE "inspiration_wall_layouts"
  ADD CONSTRAINT "inspiration_wall_layouts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inspiration_wall_layouts"
  ADD CONSTRAINT "inspiration_wall_layouts_inspirationId_fkey"
  FOREIGN KEY ("inspirationId") REFERENCES "inspirations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
