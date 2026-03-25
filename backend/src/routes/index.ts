import express from 'express';
import { register, login } from '../controller/auth.controller.js';
import { createAnalysis, getUserAnalyses, getAnalysisById } from '../controller/analysis.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Health check
router.get("/", (req, res) => {
  res.json({ status: "ok", message: "Multi-Agent Startup Analyser API" });
});

// Auth routes
router.post("/api/auth/register", register);
router.post("/api/auth/login", login);

// Analysis routes (protected)
router.post("/api/analysis", authenticate, createAnalysis);
router.get("/api/analysis", authenticate, getUserAnalyses);
router.get("/api/analysis/:id", authenticate, getAnalysisById);

export default router;