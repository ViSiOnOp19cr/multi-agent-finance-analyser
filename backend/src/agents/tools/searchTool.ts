import { TavilySearch } from "@langchain/tavily";

// Shared Tavily search tool — used by all agents
export const searchTool = new TavilySearch({
  maxResults: 5,
  tavilyApiKey: process.env.TAVILY_API_KEY,
});
