import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─── Sellers ─────────────────────────────────────────────
export const sellers = sqliteTable("sellers", {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(), // bcrypt hash
    businessName: text("business_name").notNull(),
    personalPhone: text("personal_phone"), // for notifications
    whatsappConnected: integer("whatsapp_connected", { mode: "boolean" }).default(false),
    autoReplyEnabled: integer("auto_reply_enabled", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Products (Catalogue) ────────────────────────────────
export const products = sqliteTable("products", {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
        .notNull()
        .references(() => sellers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    price: integer("price").notNull(), // in kobo (100 = ₦1)
    inStock: integer("in_stock", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Customers ───────────────────────────────────────────
export const customers = sqliteTable("customers", {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
        .notNull()
        .references(() => sellers.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Conversations ───────────────────────────────────────
export const conversations = sqliteTable("conversations", {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
        .notNull()
        .references(() => customers.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
        .notNull()
        .references(() => sellers.id, { onDelete: "cascade" }),
    state: text("state", {
        enum: ["idle", "awaiting_order", "awaiting_payment", "completed", "escalated"],
    })
        .notNull()
        .default("idle"),
    currentOrderSummary: text("current_order_summary"), // JSON string
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Messages ────────────────────────────────────────────
export const messages = sqliteTable("messages", {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
        .notNull()
        .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["customer", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Orders ──────────────────────────────────────────────
export const orders = sqliteTable("orders", {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").references(() => conversations.id),
    sellerId: text("seller_id")
        .notNull()
        .references(() => sellers.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
        .notNull()
        .references(() => customers.id, { onDelete: "cascade" }),
    items: text("items").notNull(), // JSON string: [{name, qty, price}]
    totalAmount: integer("total_amount").notNull(), // kobo
    paymentReference: text("payment_reference").unique(),
    checkoutUrl: text("checkout_url"),
    status: text("status", { enum: ["pending", "paid", "failed"] })
        .notNull()
        .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    paidAt: integer("paid_at", { mode: "timestamp" }),
});
