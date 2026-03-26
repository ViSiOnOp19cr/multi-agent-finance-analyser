import express from 'express';
import path from 'path';
import { register, login } from '../controller/auth.controller.js';
import { createAnalysis, getUserAnalyses, getAnalysisById, deleteAnalysis } from '../controller/analysis.controller.js';
import { sendMessage, getChatHistory, clearChatHistory, getConversations, createConversation, deleteConversation } from '../controller/chat.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// ─── Health ──────────────────────────────────────────────────────────────────
router.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Multi-Agent Startup Analyser API" });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post("/api/auth/register", register);
router.post("/api/auth/login", login);

// ─── Analysis (protected) ─────────────────────────────────────────────────────
router.post("/api/analysis", authenticate, createAnalysis);
router.get("/api/analysis", authenticate, getUserAnalyses);
router.get("/api/analysis/:id", authenticate, getAnalysisById);
router.delete("/api/analysis/:id", authenticate, deleteAnalysis);

// ─── Chat (protected) ─────────────────────────────────────────────────────────
router.get("/api/chat/conversations", authenticate, getConversations);
router.post("/api/chat/conversations", authenticate, createConversation);
router.delete("/api/chat/conversations/:id", authenticate, deleteConversation);
router.post("/api/chat", authenticate, sendMessage);
router.get("/api/chat/history", authenticate, getChatHistory);
router.delete("/api/chat/history", authenticate, clearChatHistory);

// ─── PDF Static Files ─────────────────────────────────────────────────────────
// Serve the generated PDFs for download
router.use("/pdfs", express.static(path.resolve("pdfs")));

export default router;