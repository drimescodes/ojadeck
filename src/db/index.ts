import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import path from "path";
import { mkdirSync } from "fs";
import logger from "../utils/logger";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");

// Ensure data directory exists
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

logger.info({ path: DB_PATH }, "Database connected");

export const db = drizzle(sqlite, { schema });
export { sqlite };
