import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.2,
});

const SCORING_SYSTEM_PROMPT = `You are a senior VC analyst scoring a startup across 6 investment dimensions.
You will receive structured research data from financial, SWOT, and competitor agents.

Score each dimension from 1 to 10 using these VC-standard criteria:

1. teamStrength — Are the founders experienced? Repeat entrepreneurs? Domain experts? Strong networks?
2. marketSize — Is the total addressable market large enough (>$1B ideally)? Is it growing?
3. traction — Does the startup show real user/revenue growth? Any paying customers? ARR growth?
4. competitiveMoat — Does the startup have a defensible advantage? Network effects? IP? Switching costs?
5. businessModel — Is the revenue model clear, scalable, and capital-efficient?
6. founderFit — Do the founders have direct domain experience that makes them uniquely qualified to win?

Scoring guide:
- 9-10: Exceptional, top-tier evidence
- 7-8: Strong, above average
- 5-6: Average, some evidence but gaps
- 3-4: Below average, significant concerns
- 1-2: Major red flag

Calculate overall as the weighted average:
- teamStrength: 25%
- founderFit: 20%
- traction: 20%
- marketSize: 15%
- competitiveMoat: 10%
- businessModel: 10%

Verdict based on overall:
- >= 7.5: "Bullish"
- >= 5.5: "Neutral"
- < 5.5: "Bearish"

Return ONLY a JSON object with this exact structure:
{
  "teamStrength":     { "score": number, "rationale": "1-2 sentence justification" },
  "marketSize":       { "score": number, "rationale": "1-2 sentence justification" },
  "traction":         { "score": number, "rationale": "1-2 sentence justification" },
  "competitiveMoat":  { "score": number, "rationale": "1-2 sentence justification" },
  "businessModel":    { "score": number, "rationale": "1-2 sentence justification" },
  "founderFit":       { "score": number, "rationale": "1-2 sentence justification" },
  "overall":          { "score": number, "verdict": "Bullish|Neutral|Bearish", "summary": "2-3 sentence overall take" }
}`;

export async function runScoringAgent(
  startupName: string,
  financialData: object,
  swotData: object,
  competitorData: object
): Promise<object> {
  const dataContext = `
STARTUP: ${startupName}

FINANCIAL & TEAM DATA:
${JSON.stringify(financialData, null, 2)}

SWOT DATA:
${JSON.stringify(swotData, null, 2)}

COMPETITOR DATA:
${JSON.stringify(competitorData, null, 2)}
`;

  const messages = [
    new SystemMessage(SCORING_SYSTEM_PROMPT),
    new HumanMessage(
      `Score the investment potential of "${startupName}" using the data below:\n${dataContext}`
    ),
  ];

  const response = await llm.invoke(messages);
  const content = response.content as string;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return { error: "Could not parse scorecard" };
}
