import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import rankRouter from "./routes/rankRoutes.js";
import analysisRouter from "./routes/analysisRoutes.js";
import { startRankTrackingCron } from "./cron/rankTrackingCron.js";
import redis from "./config/redis.js";

// Initialize Database Connection
connectDB();

const app = express();

// 🔥 FIXED CORS SETUP FOR PRODUCTION DEPLOYMENT
app.use(cors({
    origin: [
        "http://localhost:5173", // Local testing ke liye
        "https://ai-seo-rank-pilot.vercel.app" // Tumhari exact Vercel Deployment URL
    ],
    credentials: true, // Cookies/Headers tokens properly pass karne ke liye
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Base Health Check Route
app.get("/", (req, res) => res.send("Server is running"));

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/rank", rankRouter);
app.use("/api/analysis", analysisRouter);

// Start automation cron jobs
startRankTrackingCron();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));