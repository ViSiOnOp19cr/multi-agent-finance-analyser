import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { searchTool } from "./tools/searchTool.js";
import { crunchbaseTool } from "./tools/crunchbaseTool.js";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.3,
});

const COMPETITOR_SYSTEM_PROMPT = `You are a competitive intelligence analyst specializing in startup markets.
Your job is to map the competitive landscape for a given startup.

You have TWO tools available:
1. crunchbase_lookup — Use this to fetch structured data (funding, stage, categories) for the startup AND its competitors. Look up each competitor individually using their Crunchbase permalink.
2. tavily_search — Use this first to identify which category/sector the startup is in, and to find the names of top 3-5 direct competitors if you don't already know them.

Steps:
1. Use tavily_search to identify the startup's industry category and top competitors.
2. Use crunchbase_lookup on the target startup and on each competitor to get structured funding/stage data.
3. Supplement with tavily_search for any competitor data not found on Crunchbase.

Return your findings as a structured JSON object:
{
  "category": "industry category name",
  "marketOverview": "1-2 sentence overview of the market",
  "competitors": [
    {
      "name": "Competitor Name",
      "totalFunding": "amount or N/A",
      "stage": "funding stage",
      "keyDifferentiator": "what makes them unique",
      "strengths": "their main strengths vs target startup"
    }
  ],
  "competitivePosition": "how the target startup positions against these competitors",
  "summary": "2-3 sentence competitive landscape summary"
}
Be specific. Use N/A if data not found.`;

export async function runCompetitorAgent(startupName: string): Promise<object> {
  const tools = [crunchbaseTool, searchTool];
  const llmWithTools = llm.bindTools(tools);

  const messages = [
    new SystemMessage(COMPETITOR_SYSTEM_PROMPT),
    new HumanMessage(
      `Map the competitive landscape for: "${startupName}".
      Use web search to identify their sector and top competitors, then use Crunchbase to get structured funding data for each competitor.`
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
