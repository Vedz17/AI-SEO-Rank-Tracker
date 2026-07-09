# 🚀 Rank Pilot : AI-Powered SEO Rank Tracker

Rank Pilot is a full-stack, high-performance SEO analytics platform. It automates keyword rank tracking, performs deep website audits using AI, and delivers insights through a minimalist, dark-themed dashboard. 

Built with scalability in mind, it utilizes a Cache-Aside architecture with Redis to ensure lightning-fast data delivery and optimized database querying.

## ✨ Key Features

*   **🧠 AI SEO Audits:** Integrates **Browserbase** for deep DOM scraping and **Gemini AI** to generate actionable insights on Meta tags, Content hierarchy, Links, and Image optimizations.
*   **⚡ Sub-Millisecond Caching:** Implements a robust Redis caching layer. Repeated dashboard visits or historical report fetches are served instantly via cache hits, drastically reducing MongoDB load.
*   **🕰️ Automated Rank Tracking:** Uses **Node-Cron** to run background jobs every morning at 6:00 AM, automatically fetching the latest search engine rankings for tracked keywords.
*   **📊 Smart Invalidation:** The caching engine is self-healing. Cron jobs automatically wipe stale Redis data after a successful database update, ensuring users always see real-time data upon their next login.
*   **🎯 Premium UI/UX:** Features a sleek, high-contrast dark mode interface with real-time UI toasts tracking cache performance (Hit vs. Miss).

## 🛠️ Tech Stack

**Frontend (Client)**
*   React.js / Vite
*   React Router DOM (Protected Routing)
*   React-Hot-Toast (Performance/Cache Alerts)
*   Lucide React (Iconography)

**Backend (Server)**
*   Node.js & Express.js
*   MongoDB (Mongoose ODM)
*   Redis (Performance & Caching)
*   Node-Cron (Task Scheduling)

**Integrations**
*   Gemini AI API (Analytical Engine)
*   Browserbase (Headless Scraping)

## 📂 Repository Structure

This project is structured as a monorepo for seamless development and deployment.

```text
AI-SEO-Rank-Tracker/
├── client/          # React frontend application
└── server/          # Node.js/Express backend API & Cron Jobs
🚀 Getting Started
Follow these steps to run the project locally.

1. Clone the repository
Bash
git clone [https://github.com/Vedz17/AI-SEO-Rank-Tracker.git](https://github.com/Vedz17/AI-SEO-Rank-Tracker.git)
cd AI-SEO-Rank-Tracker
2. Setup the Backend
Bash
cd server
npm install
Create a .env file in the server directory and add your keys:

Code snippet
PORT=5000
MONGO_URI=your_mongodb_connection_string
REDIS_URL=your_redis_connection_string
GEMINI_API_KEY=your_gemini_api_key
BROWSERBASE_API_KEY=your_browserbase_api_key
JWT_SECRET=your_jwt_secret
Start the backend server:

Bash
npm run dev
3. Setup the Frontend
Open a new terminal window:

Bash
cd client
npm install
Create a .env file in the client directory:

Code snippet
VITE_API_URL=http://localhost:5000
Start the frontend development server:

Bash
npm run dev
📈 System Architecture Highlight: Cache-Aside Pattern
To ensure the dashboard loads instantly for daily users, the application uses a Cache-Aside pattern:

Read: The system first checks Redis. If data exists (Cache Hit), it is served instantly.

Miss: If missing (Cache Miss), data is fetched from MongoDB, sent to the client, and concurrently saved to Redis for subsequent requests.

Write/Update: Background Cron jobs update MongoDB with fresh SEO rankings daily and explicitly invalidate (delete) the stale Redis keys to maintain data integrity.
