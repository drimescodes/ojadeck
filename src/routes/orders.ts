import { Hono } from "hono";
import { db } from "../db";
import { orders, customers } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { formatNaira } from "../utils/helpers";

const ordersRouter = new Hono();

// List all orders for the authenticated seller
ordersRouter.get("/", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;

    const allOrders = await db.query.orders.findMany({
        where: eq(orders.sellerId, sellerId),
        orderBy: [desc(orders.createdAt)],
    });

    // Enrich with customer info
    const enriched = await Promise.all(
        allOrders.map(async (order) => {
            const customer = await db.query.customers.findFirst({
                where: eq(customers.id, order.customerId),
            });

            return {
                id: order.id,
                customer: {
                    name: customer?.name || "Unknown",
                    phone: customer?.phone || "",
                },
                items: JSON.parse(order.items),
                totalAmount: order.totalAmount,
                totalDisplay: formatNaira(order.totalAmount),
                status: order.status,
                transactionRef: order.paymentReference,
                checkoutUrl: order.checkoutUrl,
                createdAt: order.createdAt,
                paidAt: order.paidAt,
            };
        })
    );

    return c.json(enriched);
});

// Get order stats
ordersRouter.get("/stats", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;

    const allOrders = await db.query.orders.findMany({
        where: eq(orders.sellerId, sellerId),
    });

    const totalOrders = allOrders.length;
    const paidOrders = allOrders.filter((o) => o.status === "paid");
    const pendingOrders = allOrders.filter((o) => o.status === "pending");
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    return c.json({
        totalOrders,
        paidCount: paidOrders.length,
        pendingCount: pendingOrders.length,
        totalRevenue,
        totalRevenueDisplay: formatNaira(totalRevenue),
    });
});

export default ordersRouter;
