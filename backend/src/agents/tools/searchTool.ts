import { TavilySearch } from "@langchain/tavily";


export const searchTool = new TavilySearch({
  maxResults: 5,
  tavilyApiKey: process.env.TAVILY_API_KEY,
});
