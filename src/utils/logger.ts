import pino from "pino";

const logger = pino({
    transport:
        process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
    level: process.env.LOG_LEVEL || "info",
});

export default logger;
