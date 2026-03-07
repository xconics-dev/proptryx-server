import { Hono } from "hono";

const health = new Hono();

health.get("/", (c) =>
  c.json({
    success: true,
    service: "auth",
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

export default health;
