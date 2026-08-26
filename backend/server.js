import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import authRoutes from "./authRoutes.js";
import db from "./db.js";
import { emailStatus } from "./emailService.js";

const app = express();
const port = Number(process.env.API_PORT || 8787);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.get("/api/health", (_req, res) => {
	try {
		db.prepare("SELECT 1").get();
		res.json({ status: "ok", service: "RecoverAI API", database: "connected", timestamp: new Date().toISOString(), email: emailStatus() });
	} catch (error) {
		console.error("Health check failed:", error);
		res.status(503).json({ status: "error", service: "RecoverAI API", database: "disconnected", timestamp: new Date().toISOString() });
	}
});
app.use("/api/auth", authRoutes);
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.listen(port, () => console.log(`RecoverAI API listening on http://localhost:${port}`));
