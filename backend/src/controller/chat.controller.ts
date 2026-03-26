import { Request, Response } from "express";
import pool from "../db.js";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Exa } from "exa-js";

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.6,
});

// ── Exa AI tool ───────────────────────────────────────────────────────────────
const exa = new Exa(process.env.EXA_API_KEY);

const exaSearchTool = tool(
  async ({ query, numResults = 10 }) => {
    try {
      const result = await exa.searchAndContents(query, {
        numResults,
        type: "neural",
        useAutoprompt: true,
        summary: { query },
      });
      if (!result.results || result.results.length === 0)
        return JSON.stringify({ message: "No results found." });
      return JSON.stringify(
        result.results.map((r, i) => ({
          rank: i + 1,
          title: r.title || "Untitled",
          url: r.url,
          summary: (r as any).summary || "",
        })),
        null,
        2
      );
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "exa_startup_search",
    description:
      "Searches the web using Exa AI's neural search to discover startups, funding news, investors, or market data. Use for questions like 'find funded startups in X', 'top VCs investing in Y', 'recent Series A rounds in Z sector'. Do NOT use for general knowledge questions.",
    schema: z.object({
      query: z.string().describe("Specific search query for startup/funding discovery"),
      numResults: z.number().optional().describe("Number of results (default 10, max 20)"),
    }),
  }
);

const CHAT_SYSTEM_PROMPT = `You are an expert startup and investment analyst AI assistant powered by Exa AI search.
You help investors understand startups, discover deals, and make better investment decisions.

You have access to exa_startup_search — use it whenever the user asks to:
- Find, list, or discover startups in a sector
- Find recent funding rounds or deals
- Discover investors or VCs active in a space
- Any query requiring real, up-to-date web data

Scope: STRICTLY startup and investment topics.
Keep responses concise, data-driven, and actionable.`;

// ── DB migration ──────────────────────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS "Conversation" (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId"     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "analysisId" TEXT REFERENCES "Analysis"(id) ON DELETE SET NULL,
    title        TEXT NOT NULL DEFAULT 'New Chat',
    "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMP NOT NULL DEFAULT NOW()
  )
`).then(() =>
  pool.query(`ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "conversationId" TEXT REFERENCES "Conversation"(id) ON DELETE CASCADE`)
).catch(() => {});

// ── GET /api/chat/conversations ───────────────────────────────────────────────
export const getConversations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const result = await pool.query(
      `SELECT c.id, c.title, c."analysisId", c."createdAt", c."updatedAt",
              (SELECT content FROM "ChatMessage" WHERE "conversationId" = c.id ORDER BY "createdAt" DESC LIMIT 1) AS "lastMessage"
       FROM "Conversation" c
       WHERE c."userId" = $1
       ORDER BY c."updatedAt" DESC`,
      [userId]
    );
    res.json({ conversations: result.rows });
  } catch (error) {
    console.error("getConversations error:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

// ── POST /api/chat/conversations ──────────────────────────────────────────────
export const createConversation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { title = "New Chat", analysisId } = req.body;
    const result = await pool.query(
      `INSERT INTO "Conversation" (id, "userId", "analysisId", title, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [userId, analysisId || null, title]
    );
    res.json({ conversation: result.rows[0] });
  } catch (error) {
    console.error("createConversation error:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
};

// ── DELETE /api/chat/conversations/:id ────────────────────────────────────────
export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    await pool.query(
      `DELETE FROM "Conversation" WHERE id = $1 AND "userId" = $2`,
      [id, userId]
    );
    res.json({ message: "Conversation deleted" });
  } catch (error) {
    console.error("deleteConversation error:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
};

// ── POST /api/chat ─────────────────────────────────────────────────────────────
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { message, conversationId, analysisId } = req.body;
    const userId = (req as any).userId;

    if (!message || message.trim() === "")
      return res.status(400).json({ error: "message is required" });

    // Resolve or create conversation
    let convId = conversationId;
    if (!convId) {
      // Auto-create conversation with title from first message
      const title = message.trim().slice(0, 60);
      const convResult = await pool.query(
        `INSERT INTO "Conversation" (id, "userId", "analysisId", title, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW()) RETURNING id`,
        [userId, analysisId || null, title]
      );
      convId = convResult.rows[0].id;
    } else {
      // Touch updatedAt
      await pool.query(
        `UPDATE "Conversation" SET "updatedAt" = NOW() WHERE id = $1 AND "userId" = $2`,
        [convId, userId]
      );
    }

    // Build context from analysis if linked
    let contextPrompt = CHAT_SYSTEM_PROMPT;
    const linkedAnalysisId = analysisId || (await pool.query(
      `SELECT "analysisId" FROM "Conversation" WHERE id = $1`, [convId]
    )).rows[0]?.analysisId;

    if (linkedAnalysisId) {
      const analysisResult = await pool.query(
        `SELECT "startupName", "finalReport", "financialData", "swotData", "competitorData", scorecard
         FROM "Analysis" WHERE id = $1 AND "userId" = $2`,
        [linkedAnalysisId, userId]
      );
      if (analysisResult.rows.length > 0) {
        const a = analysisResult.rows[0];
        contextPrompt += `\n\n---\nCURRENT ANALYSIS CONTEXT:\nStartup: ${a.startupName}\nReport: ${a.finalReport || "Not yet completed"}\nFinancial: ${JSON.stringify(a.financialData || {})}\nSWOT: ${JSON.stringify(a.swotData || {})}\nCompetitors: ${JSON.stringify(a.competitorData || {})}\nScorecard: ${JSON.stringify(a.scorecard || {})}\n---`;
      }
    }

    // Fetch last 12 messages from this conversation
    const historyResult = await pool.query(
      `SELECT role, content FROM "ChatMessage"
       WHERE "conversationId" = $1 ORDER BY "createdAt" DESC LIMIT 12`,
      [convId]
    );
    const history = historyResult.rows.reverse();

    const messages: any[] = [
      new SystemMessage(contextPrompt),
      ...history.map((m) =>
        m.role === "user" ? new HumanMessage(m.content) : { role: "assistant" as const, content: m.content }
      ),
      new HumanMessage(message),
    ];

    const llmWithTools = llm.bindTools([exaSearchTool]);
    let response = await llmWithTools.invoke(messages);
    const allMessages = [...messages, response];

    while (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        console.log(`🔍 Exa search: "${toolCall.args.query}"`);
        const toolResult = await exaSearchTool.invoke(toolCall as any);
        allMessages.push(new ToolMessage({
          content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
          tool_call_id: toolCall.id!,
        }));
      }
      response = await llmWithTools.invoke(allMessages);
      allMessages.push(response);
    }

    const assistantReply = response.content as string;

    await pool.query(
      `INSERT INTO "ChatMessage" (id, "userId", "analysisId", "conversationId", role, content, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'user', $4, NOW()),
              (gen_random_uuid()::text, $1, $2, $3, 'assistant', $5, NOW())`,
      [userId, linkedAnalysisId || null, convId, message, assistantReply]
    );

    res.json({ reply: assistantReply, conversationId: convId });
  } catch (error) {
    console.error("sendMessage error:", error);
    res.status(500).json({ error: "Chat failed" });
  }
};

// ── GET /api/chat/history ─────────────────────────────────────────────────────
export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { conversationId } = req.query;
    if (!conversationId)
      return res.status(400).json({ error: "conversationId is required" });

    const result = await pool.query(
      `SELECT id, role, content, "createdAt" FROM "ChatMessage"
       WHERE "userId" = $1 AND "conversationId" = $2
       ORDER BY "createdAt" ASC`,
      [userId, conversationId]
    );
    res.json({ messages: result.rows });
  } catch (error) {
    console.error("getChatHistory error:", error);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
};

// ── DELETE /api/chat/history ──────────────────────────────────────────────────
export const clearChatHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { conversationId } = req.query;
    await pool.query(
      `DELETE FROM "ChatMessage" WHERE "userId" = $1 AND ($2::text IS NULL OR "conversationId" = $2)`,
      [userId, conversationId || null]
    );
    res.json({ message: "Chat history cleared" });
  } catch (error) {
    console.error("clearChatHistory error:", error);
    res.status(500).json({ error: "Failed to clear chat history" });
  }
};
