import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/fabric",
  { max: 3, idle_timeout: 30 }
);

export const adminDb = drizzle(client);
