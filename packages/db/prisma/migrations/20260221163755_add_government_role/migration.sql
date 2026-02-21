-- CreateTable
CREATE TABLE "GovernmentRole" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "source_url" TEXT,
    "mk_id" TEXT NOT NULL,
    "position_id" INTEGER NOT NULL,
    "position_label" TEXT NOT NULL,
    "gov_ministry_id" INTEGER,
    "ministry_name" TEXT,
    "duty_desc" TEXT,
    "government_num" INTEGER,
    "knesset_num" INTEGER,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovernmentRole_mk_id_idx" ON "GovernmentRole"("mk_id");

-- CreateIndex
CREATE INDEX "GovernmentRole_is_current_idx" ON "GovernmentRole"("is_current");

-- CreateIndex
CREATE INDEX "GovernmentRole_gov_ministry_id_idx" ON "GovernmentRole"("gov_ministry_id");

-- CreateIndex
CREATE INDEX "GovernmentRole_government_num_idx" ON "GovernmentRole"("government_num");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentRole_external_id_external_source_key" ON "GovernmentRole"("external_id", "external_source");

-- AddForeignKey
ALTER TABLE "GovernmentRole" ADD CONSTRAINT "GovernmentRole_mk_id_fkey" FOREIGN KEY ("mk_id") REFERENCES "MK"("id") ON DELETE CASCADE ON UPDATE CASCADE;
