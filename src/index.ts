import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { Hono } from "hono";
import { ratings } from "./db/schema";
import { avg, eq, count } from "drizzle-orm";
import { profanities } from "profanities";

export type Env = {
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Env }>();

// GET endpoint to retrieve ratings for a specific product ID with pagination
app.get("/ratings/:product_id", async (c) => {
  try {
    const productId = parseInt(c.req.param("product_id"));
    const page = parseInt(c.req.query("page") as string) || 1; // Default page number is 1
    let pageSize = parseInt(c.req.query("pageSize") as string) || 10; // Default page size is 10
    // Check if pageSize is greater than 50
    if (pageSize > 50) {
      return c.json({ error: "Page size cannot exceed 50", status: 400 });
    }
    const offset = (page - 1) * pageSize;

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // Query ratings for the specified product_id with pagination
    const ratingsQuery = await db
      .select()
      .from(ratings)
      .where(eq(ratings.productId, productId))
      .limit(pageSize)
      .offset(offset);

    // Calculate the average rating for the specified product_id
    const avgRatingResult = await db
      .select({ value: avg(ratings.ratingValue) })
      .from(ratings)
      .where(eq(ratings.productId, productId));
    // Extract the average rating from the result
    const avgRating = avgRatingResult[0]?.value || 0;
    // Perform count using a separate query
    const totalRatingsQuery = await db
      .select({ count: count() })
      .from(ratings)
      .where(eq(ratings.productId, productId));
    console.log(totalRatingsQuery);
    const totalRatings = totalRatingsQuery[0]?.count || 0;

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalRatings / pageSize);

    return c.json({
      ratings: ratingsQuery,
      averageRating: avgRating,
      pagination: {
        totalRatings,
        totalPages,
        currentPage: page,
        pageSize,
      },
    });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    return c.json({ error: "Internal Server Error", status: 500 });
  }
});

// POST endpoint to add ratings for a specific product ID
app.post("/ratings/:product_id", async (c) => {
  try {
    const productId = parseInt(c.req.param("product_id"));
    // Parse the request body as JSON
    const ratingData = await c.req.json();
    // Validate ratingValue
    const ratingValue = parseFloat(ratingData.rating_value);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return c.json({
        error: "Rating value must be a number between 1 and 5",
        status: 400,
      });
    }
    // Check for profanities in rating text
    // const hasProfanity = ratingData.rating_text
    //   .split(" ")
    //   .some((word: string) => profanities.includes(word.toLowerCase()));
    // if (hasProfanity) {
    //   return c.json({
    //     error: "Rating contains inappropriate language",
    //     status: 400,
    //   });
    // }
    // Construct the rating object
    const rating = {
      productId,
      ratingValue,
      ratingText: ratingData.rating_text,
    };
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    // Insert rating data into the ratings table without checking product ID existence
    await db.insert(ratings).values(rating).execute();
    return c.json({ message: "Successfully added rating" });
  } catch (error) {
    console.error("Error adding rating:", error);
    return c.json({ error: "Internal Server Error", status: 500 });
  }
});

// GET endpoint to retrieve average rating and total number of reviews for specific product IDs
app.get("/ratings/:product_ids/average-rating", async (c) => {
  try {
    const productIdsParam = c.req.param("product_ids");
    if (!productIdsParam) {
      return c.json({ error: "No product IDs provided", status: 400 });
    }
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // Calculate average rating and total reviews for each product_id
    const avgRatings: Record<
      number,
      { averageRating: number; totalReviews: number }
    > = {};

    for (const productIdParam of productIdsParam.split(",")) {
      const productId = parseInt(productIdParam);
      if (isNaN(productId)) {
        console.error("Invalid product ID:", productIdParam);
        continue; // Skip to the next iteration if productId is NaN
      }

      const avgRatingResult = await db
        .select({ value: avg(ratings.ratingValue) })
        .from(ratings)
        .where(eq(ratings.productId, productId));

      const totalReviewsResult = await db
        .select({ value: count() })
        .from(ratings)
        .where(eq(ratings.productId, productId));

      // Extract the average rating and total reviews from the result
      const averageRating = Number(avgRatingResult[0]?.value) || 0;
      const totalReviews = Number(totalReviewsResult[0]?.value) || 0;

      avgRatings[productId] = { averageRating, totalReviews };
    }

    return c.json({ averageRatings: avgRatings });
  } catch (error) {
    console.error("Error fetching average ratings:", error);
    return c.json({ error: "Internal Server Error", status: 500 });
  }
});

export default app;
