import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─── Sellers ─────────────────────────────────────────────
export const sellers = sqliteTable("sellers", {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(), // bcrypt hash
    businessName: text("business_name").notNull(),
    personalPhone: text("personal_phone"), // for notifications
    aiTone: text("ai_tone"),
    aiBusinessContext: text("ai_business_context"),
    aiInstructions: text("ai_instructions"),
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
    imageUrl: text("image_url"),
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
    status: text("status", { enum: ["pending", "paid", "failed", "cancelled"] })
        .notNull()
        .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    paidAt: integer("paid_at", { mode: "timestamp" }),
});

// ─── Merchant Wallet Ledger ─────────────────────────────
export const ledgerEntries = sqliteTable("ledger_entries", {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
        .notNull()
        .references(() => sellers.id, { onDelete: "cascade" }),
    type: text("type", {
        enum: ["order_paid", "payout_requested", "payout_failed", "payout_fee", "payout_fee_adjustment", "manual_adjustment"],
    }).notNull(),
    amount: integer("amount").notNull(), // signed kobo: credits positive, debits negative
    reference: text("reference").notNull().unique(),
    status: text("status", { enum: ["posted", "void"] }).notNull().default("posted"),
    metadata: text("metadata"), // JSON string
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Payout Accounts ────────────────────────────────────
export const payoutAccounts = sqliteTable("payout_accounts", {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
        .notNull()
        .references(() => sellers.id, { onDelete: "cascade" }),
    bankCode: text("bank_code").notNull(),
    bankName: text("bank_name").notNull(),
    accountNumber: text("account_number").notNull(),
    accountName: text("account_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Payouts ─────────────────────────────────────────────
export const payouts = sqliteTable("payouts", {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
        .notNull()
        .references(() => sellers.id, { onDelete: "cascade" }),
    payoutAccountId: text("payout_account_id").references(() => payoutAccounts.id),
    amount: integer("amount").notNull(), // kobo
    status: text("status", {
        enum: ["pending_confirmation", "processing", "success", "failed"],
    }).notNull().default("pending_confirmation"),
    merchantTxRef: text("merchant_tx_ref").notNull().unique(),
    bankCode: text("bank_code").notNull(),
    bankName: text("bank_name").notNull(),
    accountNumber: text("account_number").notNull(),
    accountName: text("account_name").notNull(),
    nombaTransferId: text("nomba_transfer_id"),
    nombaStatus: text("nomba_status"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
});
