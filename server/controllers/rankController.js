import KeywordTracking from "../models/keywordTracking.js";
import { keywordTracking } from "../services/keywordTrackingSevice.js";
import redis from "../config/redis.js"; // <-- Redis connection utility imported safely

// Helper function to invalidate cache when data changes
const clearUserCache = async (userId) => {
    try {
        await redis.del(`keywords:${userId}`);
        console.log(`🧹 [Redis] Cache cleared for user: ${userId}`);
    } catch (err) {
        console.error("❌ Redis Cache Invalidation Error:", err.message);
    }
};

// Add a keyword to track (INVALIDATES CACHE)
export const addKeyword = async (req, res) => {
    try {
        const { keyword, url } = req.body;

        if (!keyword || !url) return res.status(400).json({ success: false, message: "Keyword and URL are required" });

        // Extract domain from URL
        let domain;
        try {
            const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
            domain = urlObj.hostname.replace("www.", "");
        } catch {
            return res.status(400).json({ success: false, message: "Invalid URL format" });
        }

        // Check if already tracking this keyword+domain
        const existing = await KeywordTracking.findOne({ userId: req.userId, keyword: keyword.toLowerCase().trim(), domain });

        if (existing) {
            return res.status(400).json({ success: false, message: "Already tracking this keyword for this domain" });
        }

        // Create tracking entry
        const tracking = await KeywordTracking.create({
            userId: req.userId,
            keyword: keyword.toLowerCase().trim(),
            url: url.startsWith("http") ? url : `https://${url}`,
            domain,
            status: "checking",
        });

        // 🧹 Clear Redis cache so new keyword shows up on dashboard refresh
        await clearUserCache(req.userId);

        res.status(201).json({ success: true, message: "Keyword tracking started", tracking });
        keywordTracking(tracking);
    } catch (error) {
        console.error("Add keyword error:", error.message);
        if (error.code === 11000) return res.status(400).json({ success: false, message: "Already tracking this keyword" });
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Get all tracked keywords for user (WITH REDIS CACHE-ASIDE)
export const getKeywords = async (req, res) => {
    try {
        const cacheKey = `keywords:${req.userId}`;

        // 1. Try fetching from Redis Cache
        const cachedKeywords = await redis.get(cacheKey);
        if (cachedKeywords) {
            console.log("⚡ [Redis] Cache Hit! Dashboard fetched instantly.");
            return res.json({ 
                success: true, 
                source: 'cache', // 🔥 Injected explicitly for frontend UI state tracking
                keywords: JSON.parse(cachedKeywords) 
            });
        }

        console.log("🐢 [MongoDB] Cache Miss! Fetching data from Database...");
        const keywords = await KeywordTracking.find({ userId: req.userId }).sort({ createdAt: -1 }).select("-rankHistory");

        // 2. Cache the retrieved data in Redis for 1 Hour (3600 seconds)
        await redis.set(cacheKey, JSON.stringify(keywords), "EX", 3600);

        res.json({ 
            success: true, 
            source: 'database', // 🔥 Injected explicitly for frontend UI state tracking
            keywords 
        });
    } catch (error) {
        console.error("Get keywords error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Get single keyword with full history (Kept original to avoid breaks)
export const getKeyword = async (req, res) => {
    try {
        const tracking = await KeywordTracking.findOne({ _id: req.params.id, userId: req.userId });
        if (!tracking) return res.status(404).json({ success: false, message: "Keyword tracking not found" });
        res.json({ success: true, tracking });
    } catch (error) {
        console.error("Get keyword error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Manually refresh a keyword ranking (Updates asynchronously, invalidation happens inside the process or via cron)
export const refreshKeyword = async (req, res) => {
    try {
        const tracking = await KeywordTracking.findOne({ _id: req.params.id, userId: req.userId });
        if (!tracking) return res.status(404).json({ success: false, message: "Keyword tracking not found" });
        tracking.status = "checking";
        await tracking.save();
        
        // Clear cache so UI shows the "checking" status right away
        await clearUserCache(req.userId);

        res.json({ success: true, message: "Rank check started" });
        keywordTracking(tracking);
    } catch (error) {
        console.error("Refresh keyword error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Delete keyword tracking (INVALIDATES CACHE)
export const deleteKeyword = async (req, res) => {
    try {
        const tracking = await KeywordTracking.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!tracking) return res.status(404).json({ success: false, message: "Keyword tracking not found" });

        // 🧹 Clear user cache since an item is deleted
        await clearUserCache(req.userId);

        res.json({ success: true, message: "Keyword tracking deleted" });
    } catch (error) {
        console.error("Delete keyword error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Toggle tracking active/inactive (INVALIDATES CACHE)
export const toggleTracking = async (req, res) => {
    try {
        const tracking = await KeywordTracking.findOne({ _id: req.params.id, userId: req.userId });
        if (!tracking) return res.status(404).json({ success: false, message: "Keyword tracking not found" });

        tracking.active = !tracking.active;
        await tracking.save();

        // 🧹 Clear user cache since configuration state changed
        await clearUserCache(req.userId);

        res.json({ success: true, tracking });
    } catch (error) {
        console.error("Toggle tracking error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};