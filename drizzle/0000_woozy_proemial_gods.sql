CREATE TABLE IF NOT EXISTS "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"rating_value" double precision,
	"created_at" timestamp,
	"rating_text" text
);
