import { sqlite } from "./index";
import logger from "../utils/logger";

/**
 * Run database migrations using raw SQL
 */
export function migrate(): void {
  logger.info("Running database migrations...");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sellers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      business_name TEXT NOT NULL,
      personal_phone TEXT,
      ai_tone TEXT,
      ai_business_context TEXT,
      ai_instructions TEXT,
      whatsapp_connected INTEGER DEFAULT 0,
      auto_reply_enabled INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      image_url TEXT,
      in_stock INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,
      name TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT 'idle',
      current_order_summary TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES conversations(id),
      seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      items TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      payment_reference TEXT UNIQUE,
      checkout_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER DEFAULT (unixepoch()),
      paid_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
    CREATE INDEX IF NOT EXISTS idx_customers_seller_phone ON customers(seller_id, phone);
    CREATE INDEX IF NOT EXISTS idx_conversations_customer_seller ON conversations(customer_id, seller_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
  `);

  const sellerColumns = sqlite
    .prepare(`PRAGMA table_info(sellers)`)
    .all() as { name: string }[];

  if (!sellerColumns.some((column) => column.name === "auto_reply_enabled")) {
    sqlite.exec(`ALTER TABLE sellers ADD COLUMN auto_reply_enabled INTEGER DEFAULT 1;`);
    logger.info("Added sellers.auto_reply_enabled column");
  }

  if (!sellerColumns.some((column) => column.name === "ai_tone")) {
    sqlite.exec(`ALTER TABLE sellers ADD COLUMN ai_tone TEXT;`);
    logger.info("Added sellers.ai_tone column");
  }

  if (!sellerColumns.some((column) => column.name === "ai_business_context")) {
    sqlite.exec(`ALTER TABLE sellers ADD COLUMN ai_business_context TEXT;`);
    logger.info("Added sellers.ai_business_context column");
  }

  if (!sellerColumns.some((column) => column.name === "ai_instructions")) {
    sqlite.exec(`ALTER TABLE sellers ADD COLUMN ai_instructions TEXT;`);
    logger.info("Added sellers.ai_instructions column");
  }

  const productColumns = sqlite
    .prepare(`PRAGMA table_info(products)`)
    .all() as { name: string }[];

  if (!productColumns.some((column) => column.name === "image_url")) {
    sqlite.exec(`ALTER TABLE products ADD COLUMN image_url TEXT;`);
    logger.info("Added products.image_url column");
  }

  const orderColumns = sqlite
    .prepare(`PRAGMA table_info(orders)`)
    .all() as { name: string }[];

  if (orderColumns.some((column) => column.name === "squad_transaction_ref") && !orderColumns.some((column) => column.name === "payment_reference")) {
    sqlite.exec(`ALTER TABLE orders RENAME COLUMN squad_transaction_ref TO payment_reference;`);
    logger.info("Renamed orders.squad_transaction_ref to orders.payment_reference");
  }

  if (orderColumns.some((column) => column.name === "squad_checkout_url") && !orderColumns.some((column) => column.name === "checkout_url")) {
    sqlite.exec(`ALTER TABLE orders RENAME COLUMN squad_checkout_url TO checkout_url;`);
    logger.info("Renamed orders.squad_checkout_url to orders.checkout_url");
  }

  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_orders_txn_ref ON orders(payment_reference);`);

  logger.info("Database migrations complete");
}
