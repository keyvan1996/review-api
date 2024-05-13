import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  index,
  timestamp
} from "drizzle-orm/pg-core";

export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id"),
    ratingValue: doublePrecision("rating_value"),
    ratingText: text("rating_text"),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => {
    return {
      nameIdx: index("product_idx").on(table.productId)
    };
  }
);
