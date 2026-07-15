-- CreateEnum
CREATE TYPE "identity_provider" AS ENUM ('WECHAT_MINI', 'WECHAT_MOBILE');

ALTER TYPE "user_status" ADD VALUE IF NOT EXISTS 'DELETED';

-- AlterUser
ALTER TABLE "users"
ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

-- CreateAuthIdentity
CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" "identity_provider" NOT NULL,
    "app_id" VARCHAR(128) NOT NULL,
    "provider_user_id" VARCHAR(128) NOT NULL,
    "union_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateRefreshSession
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "device_id" VARCHAR(128) NOT NULL,
    "device_name" VARCHAR(120),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "reuse_detected_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- ExtendStoreAndFoodRecord
ALTER TABLE "stores" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

ALTER TABLE "food_records"
ADD COLUMN "client_request_id" UUID,
ADD COLUMN "value_rating" DECIMAL(2,1),
ADD COLUMN "total_price" DECIMAL(10,2),
ADD COLUMN "meal_at" TIMESTAMPTZ(3),
ADD COLUMN "companion_count" SMALLINT,
ADD COLUMN "companions" VARCHAR(300),
ADD COLUMN "summary" VARCHAR(280),
ADD COLUMN "is_recommended" BOOLEAN,
ADD COLUMN "would_revisit" BOOLEAN,
ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

-- AddChecks
ALTER TABLE "food_records"
ADD CONSTRAINT "food_records_value_rating_check" CHECK (
    "value_rating" IS NULL OR (
        "value_rating" BETWEEN 1.0 AND 5.0
        AND "value_rating" * 2 = trunc("value_rating" * 2)
    )
),
ADD CONSTRAINT "food_records_total_price_check" CHECK (
    "total_price" IS NULL OR "total_price" >= 0
),
ADD CONSTRAINT "food_records_companion_count_check" CHECK (
    "companion_count" IS NULL OR "companion_count" BETWEEN 0 AND 99
);

-- CreateIndexes
CREATE UNIQUE INDEX "auth_identities_provider_app_user_key"
ON "auth_identities"("provider", "app_id", "provider_user_id");
CREATE INDEX "auth_identities_union_id_idx" ON "auth_identities"("union_id");
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");
CREATE INDEX "refresh_sessions_user_expires_at_idx" ON "refresh_sessions"("user_id", "expires_at");
CREATE INDEX "refresh_sessions_family_revoked_at_idx" ON "refresh_sessions"("family_id", "revoked_at");
CREATE INDEX "stores_user_deleted_updated_idx" ON "stores"("user_id", "deleted_at", "updated_at" DESC);
CREATE INDEX "food_records_user_deleted_updated_id_idx"
ON "food_records"("user_id", "deleted_at", "updated_at" DESC, "id" DESC);
CREATE INDEX "food_records_user_favorite_deleted_updated_idx"
ON "food_records"("user_id", "is_favorite", "deleted_at", "updated_at" DESC);
CREATE UNIQUE INDEX "food_records_user_client_request_id_key"
ON "food_records"("user_id", "client_request_id");
CREATE INDEX "food_records_active_updated_idx"
ON "food_records"("user_id", "updated_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

-- AddForeignKeys
ALTER TABLE "auth_identities"
ADD CONSTRAINT "auth_identities_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_sessions"
ADD CONSTRAINT "refresh_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
