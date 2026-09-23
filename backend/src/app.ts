import express from "express";
import cors from "cors";

import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/authRoutes.js";
import blinkRoutes from "./routes/blinkRoutes.js";
import detectionRoutes from "./routes/detectionRoutes.js";
import appUsageRoutes from "./routes/appUsageRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import passport from "./config/passport.js";
const app = express();

app.use(cors());
app.use(express.json());
app.use(passport.initialize());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Backend is running",
  });
});


app.use("/api", userRoutes);
app.use("/api/auth", authRoutes);

app.use("/api/detection", blinkRoutes);

app.use("/api/detection", detectionRoutes);

app.use(
  "/api/app-usage",
  appUsageRoutes
);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/history", historyRoutes);

export default app;
