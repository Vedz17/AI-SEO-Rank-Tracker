import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Agar process.env.REDIS_URL nahi milega toh ye localhost par connect karne ki koshish karega
const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
    console.log(" [Redis] Connected to Upstash Cloud Successfully!");
});

redis.on("error", (err) => {
    console.error(" [Redis] Connection Error:", err.message);
});

export default redis;