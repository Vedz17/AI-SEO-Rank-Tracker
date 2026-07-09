import Analysis from "../models/Analysis.js";
import { analyzeSeoData } from "../services/geminiService.js";
import { scrapeUrl } from "../services/scraperService.js";
import redis from "../config/redis.js"; // <-- Redis connection client imported safely

// Helper function to dynamically invalidate dynamic analysis keys for a user
const clearAnalysisCache = async (userId) => {
    try {
        // Fetch paginated list keys AND single report keys
        const listKeys = await redis.keys(`analyses:${userId}:*`);
        const singleKeys = await redis.keys(`analysis:${userId}:*`);
        
        const allKeys = [...listKeys, ...singleKeys];
        
        if (allKeys.length > 0) {
            await redis.del(allKeys);
            console.log(`🧹 [Redis] All Analysis cache cleared for user: ${userId}`);
        }
    } catch (err) {
        console.error("❌ Redis Analysis Invalidation Error:", err.message);
    }
};

// Analyze a URL (INVALIDATES CACHE UPON BACKGROUND SUCCESS)
export const analyzeUrl = async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) return res.status(400).json({ success: false, message: "URL is required" });

        // Validate URL format
        let validUrl;
        try {
            validUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
        } catch (error) {
            return res.status(400).json({ success: false, message: "Invalid URL format" });
        }

        // Create analysis record with pending status
        const analysis = await Analysis.create({ userId: req.userId, url: validUrl.href, status: "processing" });

        // Send immediate response with analysis ID
        res.json({ success: true, message: "Analysis started", analysisId: analysis._id });

        // Run scraping and analysis in background
        try {
            // Step 1: Scrape the URL with BrowserBase
            const scrapeResult = await scrapeUrl(validUrl.href);

            if (!scrapeResult.success) {
                analysis.status = "failed";
                await analysis.save();
                return;
            }

            // Step 2: Analyze with Gemini AI
            const aiResult = await analyzeSeoData(scrapeResult.data);

            if (!aiResult.success) {
                analysis.status = "failed";
                await analysis.save();
                return;
            }

            // Step 3: Save results
            analysis.overallScore = aiResult.data.overallScore || 0;
            analysis.categories = aiResult.data.categories || {};
            analysis.metaData = scrapeResult.data.metaData || {};
            analysis.headings = scrapeResult.data.headings || {};
            analysis.links = scrapeResult.data.links || {};
            analysis.images = scrapeResult.data.images || {};
            analysis.keywords = aiResult.data.keywords || [];
            analysis.issues = aiResult.data.issues || [];
            analysis.loadTime = scrapeResult.data.loadTime || 0;
            analysis.pageSize = scrapeResult.data.pageSize || 0;
            analysis.wordCount = scrapeResult.data.wordCount || 0;
            analysis.status = "completed";

            await analysis.save();

            // ⚡ Success! Background process complete, wipe historical cache so the new item shows up
            await clearAnalysisCache(req.userId);

        } catch (bgError) {
            console.error("Background analysis error:", bgError.message);
            try {
                analysis.status = "failed";
                await analysis.save();
            } catch (saveError) {}
            console.error("Failed to save failed status:", saveError.message);
        }
    } catch (error) {
        console.error("Analyze URL error:", error.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "Server error" });
        }
    }
};

// Get analysis by ID (WITH REDIS CACHE FOR UI REPORT ALERTS)
export const getAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        const cacheKey = `analysis:${req.userId}:${id}`;

        // 1. Check Redis for single analysis report
        const cachedAnalysis = await redis.get(cacheKey);
        if (cachedAnalysis) {
            console.log(`⚡ [Redis] Single Analysis Cache Hit for ID: ${id}`);
            return res.json({ 
                success: true, 
                source: 'cache', // 🔥 Tells the frontend to trigger Cache Hit toast
                analysis: JSON.parse(cachedAnalysis) 
            });
        }

        // 2. Cache Miss - Fetch from MongoDB
        console.log(`🐢 [MongoDB] Single Analysis Cache Miss for ID: ${id}`);
        const analysis = await Analysis.findOne({ _id: id, userId: req.userId });

        if (!analysis) return res.status(404).json({ success: false, message: "Analysis not found" });

        // 3. Save to Redis (Cache for 24 hours since historical reports don't change)
        await redis.set(cacheKey, JSON.stringify(analysis), "EX", 86400);

        res.json({ 
            success: true, 
            source: 'database', // 🔥 Tells the frontend to trigger Cache Miss toast
            analysis 
        });
    } catch (error) {
        console.error("Get analysis error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Get all analyses for user (WITH DYNAMIC PAGINATED REDIS CACHE)
export const getAnalyses = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Dynamic key based on pagination states to avoid colliding data across pages
        const cacheKey = `analyses:${req.userId}:page:${page}:limit:${limit}`;

        // 1. Check if specific dynamic page exists inside Redis
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            console.log("⚡ [Redis] Analysis History Cache Hit! Served instantly.");
            const parsed = JSON.parse(cachedData);
            return res.json({ 
                success: true, 
                source: 'cache', 
                analyses: parsed.analyses,
                pagination: parsed.pagination
            });
        }

        console.log("🐢 [MongoDB] Analysis History Cache Miss! Loading logs...");
        const analyses = await Analysis.find({ userId: req.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-issues -keywords");

        const total = await Analysis.countDocuments({ userId: req.userId });

        const responseData = { analyses, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };

        // 2. Cache it inside Redis with a TTL of 30 minutes (1800 seconds)
        await redis.set(cacheKey, JSON.stringify(responseData), "EX", 1800);

        res.json({ 
            success: true, 
            source: 'database', 
            ...responseData 
        });
    } catch (error) {
        console.error("Get analyses error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Delete analysis (INVALIDATES CACHE)
export const deleteAnalysis = async (req, res) => {
    try {
        await Analysis.findByIdAndDelete({ _id: req.params.id, userId: req.userId });

        // 🧹 Wipe dynamic paginated caches so layouts update instantly
        await clearAnalysisCache(req.userId);

        res.json({ success: true, message: "Analysis deleted" });
    } catch (error) {
        console.error("Delete analysis error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};