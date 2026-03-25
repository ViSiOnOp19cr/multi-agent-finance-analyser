import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { searchTool } from "./tools/searchTool.js";
import { crunchbaseTool } from "./tools/crunchbaseTool.js";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.3,
});

const FINANCIAL_SYSTEM_PROMPT = `You are a financial research analyst specializing in startup investments.
Your job is to research and extract financial information about startups.

You have TWO tools available:
1. crunchbase_lookup — Use this FIRST. It fetches structured financial data directly from Crunchbase (funding rounds, investors, stage, revenue range, categories).
2. tavily_search — Use this to SUPPLEMENT Crunchbase data with additional details like revenue estimates, key quotes from investors, recent news, and any financial info not returned by Crunchbase.

Always call crunchbase_lookup first using the startup's Crunchbase permalink (lowercase name with hyphens, e.g. "stripe", "open-ai", "razorpay"). Then use tavily_search to fill any gaps.

Return your findings as a structured JSON object with these exact keys:
{
  "totalFunding": string,
  "latestRound": string,
  "latestRoundDate": string,
  "keyInvestors": string[],
  "estimatedRevenue": string,
  "valuation": string,
  "businessModel": string,
  "stage": string,
  "categories": string,
  "foundedYear": string,
  "hq": string,
  "summary": string
}
If data is not available, use "N/A". Be concise and factual.`;

export async function runFinancialAgent(startupName: string): Promise<object> {
  const tools = [crunchbaseTool, searchTool];
  const llmWithTools = llm.bindTools(tools);

  const messages = [
    new SystemMessage(FINANCIAL_SYSTEM_PROMPT),
    new HumanMessage(
      `Research the financial details of this startup: "${startupName}".
      First, look it up on Crunchbase to get structured funding/investor data.
      Then supplement with web search for revenue estimates and anything Crunchbase doesn't cover.`
    ),
  ];

  let response = await llmWithTools.invoke(messages);
  const allMessages: any[] = [...messages, response];

  while (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      let toolResult: unknown;
      if (toolCall.name === "crunchbase_lookup") {
        toolResult = await crunchbaseTool.invoke(toolCall as any);
      } else {
        toolResult = await searchTool.invoke(toolCall as any);
      }
      allMessages.push({
        role: "tool",
        content: JSON.stringify(toolResult),
        tool_call_id: toolCall.id,
      });
    }
    response = await llmWithTools.invoke(allMessages);
    allMessages.push(response);
  }

  const content = response.content as string;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return { summary: content, error: "Could not parse structured output" };
}
