import { Hono } from "hono";
import { db } from "../db";
import { products } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "../utils/helpers";
import { mkdir } from "node:fs/promises";

const productsRouter = new Hono();
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
]);

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
            imageUrl: p.imageUrl,
            inStock: p.inStock,
        }))
    );
});

// Add a product
productsRouter.post("/", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const { name, description, price, inStock, imageUrl } = await c.req.json();

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
        imageUrl: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
        inStock: inStock !== false,
    });

    return c.json({ id, name, description, price, imageUrl: imageUrl || null, inStock: inStock !== false }, 201);
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
            ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl || null }),
            ...(updates.inStock !== undefined && { inStock: updates.inStock }),
        })
        .where(eq(products.id, productId));

    return c.json({ success: true });
});

// Upload or replace a product image
productsRouter.post("/:id/image", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const productId = c.req.param("id");

    const existing = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.sellerId, sellerId)),
    });

    if (!existing) return c.json({ error: "Product not found" }, 404);

    const body = await c.req.parseBody();
    const image = body.image;

    if (!(image instanceof File)) {
        return c.json({ error: "image file is required" }, 400);
    }

    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
        return c.json({ error: "image must be jpg, png, or webp" }, 400);
    }

    if (image.size > MAX_IMAGE_BYTES) {
        return c.json({ error: "image must be 3MB or smaller" }, 400);
    }

    const extension = ALLOWED_IMAGE_TYPES.get(image.type);
    const relativeDir = `uploads/products/${sellerId}`;
    const relativePath = `${relativeDir}/${productId}.${extension}`;

    await mkdir(relativeDir, { recursive: true });
    await Bun.write(relativePath, image);

    const imageUrl = `/${relativePath}`;
    await db
        .update(products)
        .set({ imageUrl })
        .where(eq(products.id, productId));

    return c.json({ imageUrl });
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
