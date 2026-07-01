import { Hono } from "hono";
import { db } from "../db";
import { products } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "../utils/helpers";

const productsRouter = new Hono();

// List all products for the authenticated seller
productsRouter.get("/", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;

    const items = await db.query.products.findMany({
        where: eq(products.sellerId, sellerId),
        orderBy: (products, { desc }) => [desc(products.createdAt)],
    });

    return c.json(
        items.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            inStock: p.inStock,
        }))
    );
});

// Add a product
productsRouter.post("/", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const { name, description, price, inStock } = await c.req.json();

    if (!name || price === undefined) {
        return c.json({ error: "name and price are required" }, 400);
    }

    const id = generateId();
    await db.insert(products).values({
        id,
        sellerId,
        name,
        description: description || null,
        price: Math.round(Number(price)),
        inStock: inStock !== false,
    });

    return c.json({ id, name, description, price, inStock: inStock !== false }, 201);
});

// Update a product
productsRouter.put("/:id", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const productId = c.req.param("id");
    const updates = await c.req.json();

    const existing = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.sellerId, sellerId)),
    });

    if (!existing) return c.json({ error: "Product not found" }, 404);

    await db
        .update(products)
        .set({
            ...(updates.name && { name: updates.name }),
            ...(updates.description !== undefined && { description: updates.description }),
            ...(updates.price !== undefined && { price: Math.round(Number(updates.price)) }),
            ...(updates.inStock !== undefined && { inStock: updates.inStock }),
        })
        .where(eq(products.id, productId));

    return c.json({ success: true });
});

// Delete a product
productsRouter.delete("/:id", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const productId = c.req.param("id");

    const existing = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.sellerId, sellerId)),
    });

    if (!existing) return c.json({ error: "Product not found" }, 404);

    await db.delete(products).where(eq(products.id, productId));

    return c.json({ success: true });
});

export default productsRouter;
