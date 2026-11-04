import mongoose from "mongoose";

/**
 * Lazy MongoDB connection.
 *
 * The connection is intentionally NOT established at build time (so `next build`
 * can prerender static shells without a live database). It is opened on demand
 * inside route handlers / server actions via `connectDB()`.
 */
let cached: mongoose.Mongoose | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached) return cached;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to your .env.local file.");
  }

  mongoose.set("strictQuery", false);

  cached = await mongoose.connect(uri, {
    // Keep the socket alive between serverless invocations where possible.
    serverSelectionTimeoutMS: 15000,
  });

  return cached;
}
