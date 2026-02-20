-- CreateTable
CREATE TABLE "PartyTopicAgg" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "raw_score" DOUBLE PRECISION NOT NULL,
    "bill_count" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyTopicAgg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartyTopicAgg_party_id_idx" ON "PartyTopicAgg"("party_id");

-- CreateIndex
CREATE INDEX "PartyTopicAgg_topic_idx" ON "PartyTopicAgg"("topic");

-- CreateIndex
CREATE UNIQUE INDEX "PartyTopicAgg_party_id_topic_key" ON "PartyTopicAgg"("party_id", "topic");
