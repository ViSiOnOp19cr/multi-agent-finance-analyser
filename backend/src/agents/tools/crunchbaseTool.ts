import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";

// Tavily-powered startup financial research tool
// Replaces Crunchbase API with multi-source web search across TechCrunch,
// PitchBook, AngelList, LinkedIn, and other public sources.

const tavily = new TavilySearch({
  maxResults: 5,
  tavilyApiKey: process.env.TAVILY_API_KEY,
});

async function searchStartupFinancials(
  startupName: string
): Promise<Record<string, any>> {
  // Run multiple targeted searches in parallel for comprehensive data
  const [fundingResults, companyResults, revenueResults] = await Promise.all([
    tavily.invoke({
      query: `${startupName} startup total funding rounds investors valuation series`,
    }),
    tavily.invoke({
      query: `${startupName} company founded headquarters employees business model`,
    }),
    tavily.invoke({
      query: `${startupName} startup revenue ARR annual revenue estimates`,
    }),
  ]);

  return {
    funding_info: fundingResults,
    company_info: companyResults,
    revenue_info: revenueResults,
  };
}

// LangChain tool definition — agents call this by passing the startup name
// NOTE: export name kept as `crunchbaseTool` for backward compatibility with agent imports
export const crunchbaseTool = tool(
  async ({ startupName }) => {
    try {
      const data = await searchStartupFinancials(startupName);
      return JSON.stringify(data, null, 2);
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "startup_financial_lookup",
    description:
      "Researches startup financial data by searching multiple web sources (TechCrunch, PitchBook, AngelList, etc.). Returns funding rounds, investors, revenue estimates, valuation, business model, and company details. Input is the startup name, e.g. 'Stripe', 'OpenAI', 'Razorpay'.",
    schema: z.object({
      startupName: z
        .string()
        .describe(
          "The name of the startup to research, e.g. 'Stripe', 'OpenAI', 'Razorpay'"
        ),
    }),
  }
);
