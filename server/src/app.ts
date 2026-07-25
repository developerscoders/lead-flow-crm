import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.js";
import publicRoutes from "./routes/public.js";
import leadsRoutes from "./routes/leads.js";
import usersRoutes from "./routes/users.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { apiLimiter } from "./middleware/rateLimit.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false, // frontend is a separate SPA build; CSP configured at the host level
    })
  );
  console.log(process.env.CLIENT_ORIGIN);
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(apiLimiter);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/leads", leadsRoutes);
  app.use("/api/users", usersRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
