-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "source_url" TEXT,
    "name_he" TEXT NOT NULL,
    "name_en" TEXT,
    "abbreviation" TEXT,
    "knesset_number" INTEGER,
    "seat_count" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3),
    "last_changed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MK" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "source_url" TEXT,
    "name_he" TEXT NOT NULL,
    "name_en" TEXT,
    "name_first_he" TEXT,
    "name_last_he" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'unknown',
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "image_url" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "last_changed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MK_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMembership" (
    "id" TEXT NOT NULL,
    "mk_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "external_id" TEXT,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "knesset_number" INTEGER,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "source_url" TEXT,
    "title_he" TEXT NOT NULL,
    "title_en" TEXT,
    "description_he" TEXT,
    "description_en" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "topic" TEXT,
    "knesset_number" INTEGER,
    "submitted_date" TIMESTAMP(3),
    "last_status_date" TIMESTAMP(3),
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3),
    "last_changed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillStage" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "external_id" TEXT,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "stage_name_he" TEXT NOT NULL,
    "stage_name_en" TEXT,
    "status" TEXT,
    "stage_date" TIMESTAMP(3),
    "committee_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MKBillRole" (
    "id" TEXT NOT NULL,
    "mk_id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "party_id" TEXT,
    "external_id" TEXT,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "role" TEXT NOT NULL DEFAULT 'initiator',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MKBillRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Committee" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "source_url" TEXT,
    "name_he" TEXT NOT NULL,
    "name_en" TEXT,
    "knesset_number" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Committee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMembership" (
    "id" TEXT NOT NULL,
    "mk_id" TEXT NOT NULL,
    "committee_id" TEXT NOT NULL,
    "external_id" TEXT,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "role" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "source_url" TEXT,
    "title_he" TEXT NOT NULL,
    "title_en" TEXT,
    "vote_date" TIMESTAMP(3),
    "knesset_number" INTEGER,
    "bill_id" TEXT,
    "topic" TEXT,
    "yes_count" INTEGER,
    "no_count" INTEGER,
    "abstain_count" INTEGER,
    "result" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteRecord" (
    "id" TEXT NOT NULL,
    "vote_id" TEXT NOT NULL,
    "mk_id" TEXT NOT NULL,
    "external_id" TEXT,
    "external_source" TEXT NOT NULL DEFAULT 'knesset_odata',
    "position" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promise" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'statement',
    "topic" TEXT,
    "mk_id" TEXT,
    "party_id" TEXT,
    "stated_on" TIMESTAMP(3),
    "source_url" TEXT NOT NULL,
    "source_label" TEXT NOT NULL,
    "added_by" TEXT NOT NULL DEFAULT 'manual',
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromiseMatch" (
    "id" TEXT NOT NULL,
    "promise_id" TEXT NOT NULL,
    "bill_id" TEXT,
    "vote_id" TEXT,
    "match_type" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'no_match',
    "status_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromiseMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceLink" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "external_source" TEXT NOT NULL,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawSnapshot" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "external_source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "etl_run_id" TEXT NOT NULL,
    "payload_json" JSONB,
    "payload_hash" TEXT NOT NULL,
    "payload_size" INTEGER NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ETLRun" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "source" TEXT NOT NULL,
    "source_version" TEXT,
    "commit_hash" TEXT,
    "counts_json" JSONB,
    "errors_json" JSONB,
    "latency_ms" INTEGER,
    "entity_sets_discovered" JSONB,

    CONSTRAINT "ETLRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillAISummary" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "summary_text" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "model_version" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_fields" JSONB NOT NULL,
    "warning" TEXT NOT NULL DEFAULT 'AI-generated summary; verify with official sources below.',

    CONSTRAINT "BillAISummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Party_name_he_idx" ON "Party"("name_he");

-- CreateIndex
CREATE INDEX "Party_is_active_idx" ON "Party"("is_active");

-- CreateIndex
CREATE INDEX "Party_knesset_number_idx" ON "Party"("knesset_number");

-- CreateIndex
CREATE UNIQUE INDEX "Party_external_id_external_source_key" ON "Party"("external_id", "external_source");

-- CreateIndex
CREATE INDEX "MK_name_he_idx" ON "MK"("name_he");

-- CreateIndex
CREATE INDEX "MK_name_last_he_idx" ON "MK"("name_last_he");

-- CreateIndex
CREATE INDEX "MK_is_current_idx" ON "MK"("is_current");

-- CreateIndex
CREATE UNIQUE INDEX "MK_external_id_external_source_key" ON "MK"("external_id", "external_source");

-- CreateIndex
CREATE INDEX "PartyMembership_mk_id_idx" ON "PartyMembership"("mk_id");

-- CreateIndex
CREATE INDEX "PartyMembership_party_id_idx" ON "PartyMembership"("party_id");

-- CreateIndex
CREATE INDEX "PartyMembership_is_current_idx" ON "PartyMembership"("is_current");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMembership_mk_id_party_id_knesset_number_key" ON "PartyMembership"("mk_id", "party_id", "knesset_number");

-- CreateIndex
CREATE INDEX "Bill_title_he_idx" ON "Bill"("title_he");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Bill_topic_idx" ON "Bill"("topic");

-- CreateIndex
CREATE INDEX "Bill_knesset_number_idx" ON "Bill"("knesset_number");

-- CreateIndex
CREATE INDEX "Bill_submitted_date_idx" ON "Bill"("submitted_date");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_external_id_external_source_key" ON "Bill"("external_id", "external_source");

-- CreateIndex
CREATE INDEX "BillStage_bill_id_idx" ON "BillStage"("bill_id");

-- CreateIndex
CREATE INDEX "BillStage_stage_date_idx" ON "BillStage"("stage_date");

-- CreateIndex
CREATE UNIQUE INDEX "BillStage_bill_id_external_id_key" ON "BillStage"("bill_id", "external_id");

-- CreateIndex
CREATE INDEX "MKBillRole_mk_id_idx" ON "MKBillRole"("mk_id");

-- CreateIndex
CREATE INDEX "MKBillRole_bill_id_idx" ON "MKBillRole"("bill_id");

-- CreateIndex
CREATE INDEX "MKBillRole_party_id_idx" ON "MKBillRole"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "MKBillRole_mk_id_bill_id_role_key" ON "MKBillRole"("mk_id", "bill_id", "role");

-- CreateIndex
CREATE INDEX "Committee_name_he_idx" ON "Committee"("name_he");

-- CreateIndex
CREATE INDEX "Committee_is_active_idx" ON "Committee"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Committee_external_id_external_source_key" ON "Committee"("external_id", "external_source");

-- CreateIndex
CREATE INDEX "CommitteeMembership_mk_id_idx" ON "CommitteeMembership"("mk_id");

-- CreateIndex
CREATE INDEX "CommitteeMembership_committee_id_idx" ON "CommitteeMembership"("committee_id");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMembership_mk_id_committee_id_key" ON "CommitteeMembership"("mk_id", "committee_id");

-- CreateIndex
CREATE INDEX "Vote_vote_date_idx" ON "Vote"("vote_date");

-- CreateIndex
CREATE INDEX "Vote_bill_id_idx" ON "Vote"("bill_id");

-- CreateIndex
CREATE INDEX "Vote_topic_idx" ON "Vote"("topic");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_external_id_external_source_key" ON "Vote"("external_id", "external_source");

-- CreateIndex
CREATE INDEX "VoteRecord_vote_id_idx" ON "VoteRecord"("vote_id");

-- CreateIndex
CREATE INDEX "VoteRecord_mk_id_idx" ON "VoteRecord"("mk_id");

-- CreateIndex
CREATE UNIQUE INDEX "VoteRecord_vote_id_mk_id_key" ON "VoteRecord"("vote_id", "mk_id");

-- CreateIndex
CREATE INDEX "Promise_mk_id_idx" ON "Promise"("mk_id");

-- CreateIndex
CREATE INDEX "Promise_party_id_idx" ON "Promise"("party_id");

-- CreateIndex
CREATE INDEX "Promise_topic_idx" ON "Promise"("topic");

-- CreateIndex
CREATE INDEX "PromiseMatch_promise_id_idx" ON "PromiseMatch"("promise_id");

-- CreateIndex
CREATE INDEX "PromiseMatch_bill_id_idx" ON "PromiseMatch"("bill_id");

-- CreateIndex
CREATE INDEX "PromiseMatch_status_idx" ON "PromiseMatch"("status");

-- CreateIndex
CREATE INDEX "SourceLink_entity_type_entity_id_idx" ON "SourceLink"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "SourceLink_external_source_external_id_idx" ON "SourceLink"("external_source", "external_id");

-- CreateIndex
CREATE INDEX "RawSnapshot_entity_type_entity_id_idx" ON "RawSnapshot"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "RawSnapshot_etl_run_id_idx" ON "RawSnapshot"("etl_run_id");

-- CreateIndex
CREATE INDEX "RawSnapshot_external_source_external_id_idx" ON "RawSnapshot"("external_source", "external_id");

-- CreateIndex
CREATE INDEX "RawSnapshot_fetched_at_idx" ON "RawSnapshot"("fetched_at");

-- CreateIndex
CREATE INDEX "ETLRun_started_at_idx" ON "ETLRun"("started_at");

-- CreateIndex
CREATE INDEX "ETLRun_status_idx" ON "ETLRun"("status");

-- CreateIndex
CREATE INDEX "ETLRun_source_idx" ON "ETLRun"("source");

-- CreateIndex
CREATE UNIQUE INDEX "BillAISummary_bill_id_key" ON "BillAISummary"("bill_id");

-- AddForeignKey
ALTER TABLE "PartyMembership" ADD CONSTRAINT "PartyMembership_mk_id_fkey" FOREIGN KEY ("mk_id") REFERENCES "MK"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMembership" ADD CONSTRAINT "PartyMembership_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillStage" ADD CONSTRAINT "BillStage_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillStage" ADD CONSTRAINT "BillStage_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MKBillRole" ADD CONSTRAINT "MKBillRole_mk_id_fkey" FOREIGN KEY ("mk_id") REFERENCES "MK"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MKBillRole" ADD CONSTRAINT "MKBillRole_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMembership" ADD CONSTRAINT "CommitteeMembership_mk_id_fkey" FOREIGN KEY ("mk_id") REFERENCES "MK"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMembership" ADD CONSTRAINT "CommitteeMembership_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_mk_id_fkey" FOREIGN KEY ("mk_id") REFERENCES "MK"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promise" ADD CONSTRAINT "Promise_mk_id_fkey" FOREIGN KEY ("mk_id") REFERENCES "MK"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promise" ADD CONSTRAINT "Promise_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseMatch" ADD CONSTRAINT "PromiseMatch_promise_id_fkey" FOREIGN KEY ("promise_id") REFERENCES "Promise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseMatch" ADD CONSTRAINT "PromiseMatch_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawSnapshot" ADD CONSTRAINT "RawSnapshot_etl_run_id_fkey" FOREIGN KEY ("etl_run_id") REFERENCES "ETLRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillAISummary" ADD CONSTRAINT "BillAISummary_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
