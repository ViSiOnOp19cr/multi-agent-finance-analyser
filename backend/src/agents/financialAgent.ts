import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { searchTool } from "./tools/searchTool.js";
import { crunchbaseTool } from "./tools/crunchbaseTool.js";

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.3,
});

const FINANCIAL_SYSTEM_PROMPT = `You are a financial research analyst specializing in startup investments.
Your job is to research and extract financial information AND founding team details about startups.

You have TWO tools available:
1. startup_financial_lookup — Use this FIRST. It searches multiple web sources (TechCrunch, PitchBook, AngelList, etc.) to get financial data about the startup including funding rounds, investors, valuation, and revenue estimates.
2. tavily_search — Use this to SUPPLEMENT with additional details like recent news, key quotes from investors, specific financial metrics, or any data gaps from the first search. ALSO use this to search for founder/co-founder backgrounds, previous startups, education, and LinkedIn profiles.

Always call startup_financial_lookup first with the startup name. Then use tavily_search to fill any remaining gaps AND to research the founding team.

IMPORTANT: For every fact you include, record which URL or publication it came from in the sources array.

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
  "founders": [
    {
      "name": "Founder Name",
      "role": "CEO / CTO / Co-founder etc.",
      "background": "Brief bio — education, previous companies, key achievements",
      "previousStartups": "List of previous startups they founded or co-founded, or N/A",
      "relevantExperience": "Why their background makes them qualified to build this startup"
    }
  ],
  "sources": [
    { "title": "Article or site name", "url": "https://..." }
  ],
  "summary": string
}
If data is not available, use "N/A". Be concise and factual. Always populate the sources array.`;

export async function runFinancialAgent(startupName: string): Promise<object> {
  const tools = [crunchbaseTool, searchTool];
  const llmWithTools = llm.bindTools(tools);

  const messages = [
    new SystemMessage(FINANCIAL_SYSTEM_PROMPT),
    new HumanMessage(
      `Research the financial details and founding team of this startup: "${startupName}".
      First, use startup_financial_lookup to get structured funding/investor data from web sources.
      Then use tavily_search to find: revenue estimates, recent news, AND the founders/co-founders — their names, roles, backgrounds, previous startups, education, and why they're qualified to build this company.
      Record the source URL for every key fact you find.`
    ),
  ];

  let response = await llmWithTools.invoke(messages);
  const allMessages: any[] = [...messages, response];

  while (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      let toolResult: unknown;
      if (toolCall.name === "startup_financial_lookup") {
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
