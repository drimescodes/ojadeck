import { Hono } from "hono";
import { db } from "../db";
import { sellers } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateId } from "../utils/helpers";
import logger from "../utils/logger";
import jwt from "../utils/jwt";

const sellersRouter = new Hono();

// Register a new seller
sellersRouter.post("/register", async (c) => {
    try {
        const { email, password, businessName, personalPhone } = await c.req.json();

        if (!email || !password || !businessName) {
            return c.json({ error: "email, password, and businessName are required" }, 400);
        }

        // Check if email already exists
        const existing = await db.query.sellers.findFirst({
            where: eq(sellers.email, email),
        });
        if (existing) {
            return c.json({ error: "Email already registered" }, 409);
        }

        const id = generateId();
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.insert(sellers).values({
            id,
            email,
            password: hashedPassword,
            businessName,
            personalPhone: personalPhone || null,
        });

        const token = jwt.sign({ sellerId: id, email });

        logger.info({ sellerId: id, email }, "New seller registered");

        return c.json({
            seller: { id, email, businessName, personalPhone },
            token,
        });
    } catch (err: any) {
        logger.error({ err: err.message }, "Registration failed");
        return c.json({ error: "Registration failed" }, 500);
    }
});

// Login
sellersRouter.post("/login", async (c) => {
    try {
        const { email, password } = await c.req.json();

        if (!email || !password) {
            return c.json({ error: "email and password are required" }, 400);
        }

        const seller = await db.query.sellers.findFirst({
            where: eq(sellers.email, email),
        });

        if (!seller || !(await bcrypt.compare(password, seller.password))) {
            return c.json({ error: "Invalid credentials" }, 401);
        }

        const token = jwt.sign({ sellerId: seller.id, email: seller.email });

        return c.json({
            seller: {
                id: seller.id,
                email: seller.email,
                businessName: seller.businessName,
                personalPhone: seller.personalPhone,
                whatsappConnected: seller.whatsappConnected,
            },
            token,
        });
    } catch (err: any) {
        logger.error({ err: err.message }, "Login failed");
        return c.json({ error: "Login failed" }, 500);
    }
});

// Get current seller profile (authenticated)
sellersRouter.get("/me", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;

    const seller = await db.query.sellers.findFirst({
        where: eq(sellers.id, sellerId),
    });

    if (!seller) return c.json({ error: "Seller not found" }, 404);

    return c.json({
        id: seller.id,
        email: seller.email,
        businessName: seller.businessName,
        personalPhone: seller.personalPhone,
        whatsappConnected: seller.whatsappConnected,
    });
});

// Update seller profile
sellersRouter.put("/me", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;

    const { businessName, personalPhone } = await c.req.json();

    await db
        .update(sellers)
        .set({
            ...(businessName && { businessName }),
            ...(personalPhone !== undefined && { personalPhone }),
        })
        .where(eq(sellers.id, sellerId));

    return c.json({ success: true });
});

export default sellersRouter;
