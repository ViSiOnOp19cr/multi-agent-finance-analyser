import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { searchTool } from "./tools/searchTool.js";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.4,
});

const SWOT_SYSTEM_PROMPT = `You are a strategic business analyst specializing in startup evaluation.
Your job is to conduct a SWOT analysis for a startup.

Use the search tool to gather information:
- Strengths: Search for positive reviews, traction data, awards, unique technology, team quality, customer testimonials
- Weaknesses: Search for criticism, product issues, negative reviews, gaps in offering, high churn or complaints
- Opportunities: Search for market trends, growing demand in their sector, underserved segments they could target
- Threats: Search for competitor moves, regulatory risks, market saturation, economic headwinds for their sector

Return your findings as a structured JSON object:
{
  "strengths": ["point 1", "point 2", "point 3"],
  "weaknesses": ["point 1", "point 2", "point 3"],
  "opportunities": ["point 1", "point 2", "point 3"],
  "threats": ["point 1", "point 2", "point 3"],
  "summary": "2-3 sentence overall qualitative assessment"
}
Keep each point concise (1 sentence max). Aim for 3-5 points per category. Be factual and objective.`;

export async function runSwotAgent(startupName: string): Promise<object> {
  const llmWithTools = llm.bindTools([searchTool]);

  const messages = [
    new SystemMessage(SWOT_SYSTEM_PROMPT),
    new HumanMessage(
      `Conduct a SWOT analysis for: "${startupName}". Search for strengths (traction, tech, team), weaknesses (issues, gaps), opportunities (market trends), and threats (competitors, risks).`
    ),
  ];

  let response = await llmWithTools.invoke(messages);
  const allMessages: any[] = [...messages, response];

  while (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      const toolResult = await searchTool.invoke(toolCall);
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
