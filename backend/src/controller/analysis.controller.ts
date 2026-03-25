import { Request, Response } from "express";
import pool from "../db.js";
import { runAnalysis } from "../agents/graph.js";

// POST /api/analysis — trigger the multi-agent pipeline
export const createAnalysis = async (req: Request, res: Response) => {
  try {
    const { startupName, description } = req.body;
    const userId = (req as any).userId; // set by auth middleware

    if (!startupName || startupName.trim() === "") {
      return res.status(400).json({ error: "startupName is required" });
    }

    // Create DB record with 'processing' status immediately
    const insertResult = await pool.query(
      `INSERT INTO "Analysis" (id, "userId", "startupName", description, status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'processing', NOW(), NOW())
       RETURNING id`,
      [userId, startupName.trim(), description || null]
    );
    const analysisId = insertResult.rows[0].id;

    // Respond immediately with analysisId so frontend can poll
    res.status(202).json({
      message: "Analysis started",
      analysisId,
      status: "processing",
    });

    // Run the agent pipeline in background (non-blocking)
    runAnalysis(startupName.trim())
      .then(async ({ financialData, swotData, competitorData, finalReport }) => {
        await pool.query(
          `UPDATE "Analysis"
           SET "financialData" = $1, "swotData" = $2, "competitorData" = $3,
               "finalReport" = $4, status = 'completed', "updatedAt" = NOW()
           WHERE id = $5`,
          [
            JSON.stringify(financialData),
            JSON.stringify(swotData),
            JSON.stringify(competitorData),
            finalReport,
            analysisId,
          ]
        );
        console.log(`✅ Analysis ${analysisId} completed`);
      })
      .catch(async (err) => {
        console.error(`❌ Analysis ${analysisId} failed:`, err);
        await pool.query(
          `UPDATE "Analysis" SET status = 'failed', "updatedAt" = NOW() WHERE id = $1`,
          [analysisId]
        );
      });
  } catch (error) {
    console.error("createAnalysis error:", error);
    res.status(500).json({ error: "Failed to start analysis" });
  }
};

// GET /api/analysis — get all analyses for logged-in user
export const getUserAnalyses = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const result = await pool.query(
      `SELECT id, "startupName", description, status, "createdAt", "updatedAt"
       FROM "Analysis" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId]
    );
    res.json({ analyses: result.rows });
  } catch (error) {
    console.error("getUserAnalyses error:", error);
    res.status(500).json({ error: "Failed to fetch analyses" });
  }
};

// GET /api/analysis/:id — get a specific analysis (full detail)
export const getAnalysisById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM "Analysis" WHERE id = $1 AND "userId" = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    res.json({ analysis: result.rows[0] });
  } catch (error) {
    console.error("getAnalysisById error:", error);
    res.status(500).json({ error: "Failed to fetch analysis" });
  }
};
