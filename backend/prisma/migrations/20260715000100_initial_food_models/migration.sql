-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- EnableExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "store_source" AS ENUM ('TENCENT_POI', 'MANUAL');

-- CreateEnum
CREATE TYPE "coordinate_type" AS ENUM ('GCJ02');

-- CreateEnum
CREATE TYPE "record_status" AS ENUM ('WANT_TO_GO', 'VISITED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "dish_type" AS ENUM ('RECOMMENDED', 'AVOIDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nickname" VARCHAR(80),
    "avatar_object_key" VARCHAR(512),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    "locale" VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source" "store_source" NOT NULL,
    "map_poi_id" VARCHAR(128),
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100),
    "phone" VARCHAR(50),
    "address" VARCHAR(300),
    "province" VARCHAR(60),
    "city" VARCHAR(60),
    "district" VARCHAR(60),
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "coordinate_type" "coordinate_type" NOT NULL DEFAULT 'GCJ02',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "status" "record_status" NOT NULL,
    "overall_rating" DECIMAL(2,1),
    "taste_rating" DECIMAL(2,1),
    "environment_rating" DECIMAL(2,1),
    "service_rating" DECIMAL(2,1),
    "per_capita_price" DECIMAL(10,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'CNY',
    "visited_at" DATE,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "normalized_name" VARCHAR(20) NOT NULL,
    "color" VARCHAR(7),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_record_tags" (
    "user_id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_record_tags_pkey" PRIMARY KEY ("record_id","tag_id")
);

-- CreateTable
CREATE TABLE "record_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" VARCHAR(128),
    "sort_order" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "type" "dish_type" NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "normalized_name" VARCHAR(50) NOT NULL,
    "sort_order" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dish_items_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "stores"
ADD CONSTRAINT "stores_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "stores_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180),
ADD CONSTRAINT "stores_source_map_poi_id_check" CHECK (
    "source" = 'MANUAL'
    OR (
        "source" = 'TENCENT_POI'
        AND "map_poi_id" IS NOT NULL
        AND btrim("map_poi_id") <> ''
    )
);

ALTER TABLE "food_records"
ADD CONSTRAINT "food_records_overall_rating_check" CHECK (
    "overall_rating" IS NULL
    OR (
        "overall_rating" BETWEEN 1.0 AND 5.0
        AND "overall_rating" * 2 = trunc("overall_rating" * 2)
    )
),
ADD CONSTRAINT "food_records_taste_rating_check" CHECK (
    "taste_rating" IS NULL
    OR (
        "taste_rating" BETWEEN 1.0 AND 5.0
        AND "taste_rating" * 2 = trunc("taste_rating" * 2)
    )
),
ADD CONSTRAINT "food_records_environment_rating_check" CHECK (
    "environment_rating" IS NULL
    OR (
        "environment_rating" BETWEEN 1.0 AND 5.0
        AND "environment_rating" * 2 = trunc("environment_rating" * 2)
    )
),
ADD CONSTRAINT "food_records_service_rating_check" CHECK (
    "service_rating" IS NULL
    OR (
        "service_rating" BETWEEN 1.0 AND 5.0
        AND "service_rating" * 2 = trunc("service_rating" * 2)
    )
),
ADD CONSTRAINT "food_records_per_capita_price_check" CHECK (
    "per_capita_price" IS NULL OR "per_capita_price" >= 0
),
ADD CONSTRAINT "food_records_currency_check" CHECK ("currency" = 'CNY'),
ADD CONSTRAINT "food_records_version_check" CHECK ("version" > 0);

ALTER TABLE "tags"
ADD CONSTRAINT "tags_color_check" CHECK (
    "color" IS NULL OR "color" ~ '^#[0-9A-Fa-f]{6}$'
);

ALTER TABLE "record_images"
ADD CONSTRAINT "record_images_size_bytes_check" CHECK (
    "size_bytes" BETWEEN 1 AND 10485760
),
ADD CONSTRAINT "record_images_width_check" CHECK (
    "width" IS NULL OR "width" > 0
),
ADD CONSTRAINT "record_images_height_check" CHECK (
    "height" IS NULL OR "height" > 0
),
ADD CONSTRAINT "record_images_sort_order_check" CHECK (
    "sort_order" BETWEEN 0 AND 8
);

ALTER TABLE "dish_items"
ADD CONSTRAINT "dish_items_sort_order_check" CHECK ("sort_order" >= 0);

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "stores_user_id_city_idx" ON "stores"("user_id", "city");

-- CreateIndex
CREATE INDEX "stores_user_id_latitude_idx" ON "stores"("user_id", "latitude");

-- CreateIndex
CREATE INDEX "stores_user_id_longitude_idx" ON "stores"("user_id", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "stores_user_id_id_key" ON "stores"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "stores_user_id_map_poi_id_key" ON "stores"("user_id", "map_poi_id");

-- CreateIndex
CREATE INDEX "food_records_user_status_updated_id_idx" ON "food_records"("user_id", "status", "updated_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "food_records_user_visited_at_idx" ON "food_records"("user_id", "visited_at" DESC);

-- CreateIndex
CREATE INDEX "food_records_user_overall_rating_idx" ON "food_records"("user_id", "overall_rating" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "food_records_user_id_id_key" ON "food_records"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "food_records_user_id_store_id_key" ON "food_records"("user_id", "store_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_user_id_id_key" ON "tags"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_user_id_normalized_name_key" ON "tags"("user_id", "normalized_name");

-- CreateIndex
CREATE INDEX "food_record_tags_user_id_record_id_idx" ON "food_record_tags"("user_id", "record_id");

-- CreateIndex
CREATE INDEX "food_record_tags_user_id_tag_id_record_id_idx" ON "food_record_tags"("user_id", "tag_id", "record_id");

-- CreateIndex
CREATE UNIQUE INDEX "record_images_object_key_key" ON "record_images"("object_key");

-- CreateIndex
CREATE INDEX "record_images_user_id_record_id_idx" ON "record_images"("user_id", "record_id");

-- CreateIndex
CREATE UNIQUE INDEX "record_images_record_id_sort_order_key" ON "record_images"("record_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "dish_items_user_record_type_name_key" ON "dish_items"("user_id", "record_id", "type", "normalized_name");

-- CreateSearchIndex
CREATE INDEX "stores_name_trgm_idx" ON "stores" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "stores_address_trgm_idx" ON "stores" USING GIN ("address" gin_trgm_ops);

CREATE INDEX "food_records_notes_trgm_idx" ON "food_records" USING GIN ("notes" gin_trgm_ops);

CREATE INDEX "tags_name_trgm_idx" ON "tags" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "dish_items_name_trgm_idx" ON "dish_items" USING GIN ("name" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_records" ADD CONSTRAINT "food_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_records" ADD CONSTRAINT "food_records_user_id_store_id_fkey" FOREIGN KEY ("user_id", "store_id") REFERENCES "stores"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_record_tags" ADD CONSTRAINT "food_record_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_record_tags" ADD CONSTRAINT "food_record_tags_user_id_record_id_fkey" FOREIGN KEY ("user_id", "record_id") REFERENCES "food_records"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_record_tags" ADD CONSTRAINT "food_record_tags_user_id_tag_id_fkey" FOREIGN KEY ("user_id", "tag_id") REFERENCES "tags"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_images" ADD CONSTRAINT "record_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_images" ADD CONSTRAINT "record_images_user_id_record_id_fkey" FOREIGN KEY ("user_id", "record_id") REFERENCES "food_records"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_items" ADD CONSTRAINT "dish_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_items" ADD CONSTRAINT "dish_items_user_id_record_id_fkey" FOREIGN KEY ("user_id", "record_id") REFERENCES "food_records"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
