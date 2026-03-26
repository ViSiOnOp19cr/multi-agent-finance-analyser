import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { runFinancialAgent } from "./financialAgent.js";
import { runSwotAgent } from "./swotAgent.js";
import { runCompetitorAgent } from "./competitorAgent.js";
import { runManagerAgent } from "./managerAgent.js";
import { runScoringAgent } from "./scoringAgent.js";

// Shared state across all agent nodes
const GraphState = Annotation.Root({
  startupName: Annotation<string>(),
  financialData: Annotation<object | null>({ default: () => null, reducer: (_, b) => b }),
  swotData: Annotation<object | null>({ default: () => null, reducer: (_, b) => b }),
  competitorData: Annotation<object | null>({ default: () => null, reducer: (_, b) => b }),
  scorecard: Annotation<object | null>({ default: () => null, reducer: (_, b) => b }),
  finalReport: Annotation<string | null>({ default: () => null, reducer: (_, b) => b }),
  error: Annotation<string | null>({ default: () => null, reducer: (_, b) => b }),
});

// Node: Financial Agent
async function financialNode(state: typeof GraphState.State) {
  console.log("🔍 Financial Agent running...");
  const financialData = await runFinancialAgent(state.startupName);
  return { financialData };
}

// Node: SWOT Agent
async function swotNode(state: typeof GraphState.State) {
  console.log("📊 SWOT Agent running...");
  const swotData = await runSwotAgent(state.startupName);
  return { swotData };
}

// Node: Competitor Agent
async function competitorNode(state: typeof GraphState.State) {
  console.log("⚔️ Competitor Agent running...");
  const competitorData = await runCompetitorAgent(state.startupName);
  return { competitorData };
}

// Node: Scoring Agent — produces VC investment scorecard
async function scoringNode(state: typeof GraphState.State) {
  console.log("🏆 Scoring Agent running...");
  const scorecard = await runScoringAgent(
    state.startupName,
    state.financialData || {},
    state.swotData || {},
    state.competitorData || {}
  );
  return { scorecard };
}

// Node: Manager Agent (compiles final report)
async function managerNode(state: typeof GraphState.State) {
  console.log("🧠 Manager Agent compiling report...");
  const finalReport = await runManagerAgent(
    state.startupName,
    state.financialData || {},
    state.swotData || {},
    state.competitorData || {}
  );
  return { finalReport };
}

// Build the graph: sequential pipeline
// competitor → scoring → manager → END
const graph = new StateGraph(GraphState)
  .addNode("financial", financialNode)
  .addNode("swot", swotNode)
  .addNode("competitor", competitorNode)
  .addNode("scoring", scoringNode)
  .addNode("manager", managerNode)
  .addEdge(START, "financial")
  .addEdge("financial", "swot")
  .addEdge("swot", "competitor")
  .addEdge("competitor", "scoring")
  .addEdge("scoring", "manager")
  .addEdge("manager", END);

export const analyserGraph = graph.compile();

// Main entry point: run the full pipeline for a startup
export async function runAnalysis(startupName: string): Promise<{
  financialData: object;
  swotData: object;
  competitorData: object;
  scorecard: object;
  finalReport: string;
}> {
  const result = await analyserGraph.invoke({ startupName });

  return {
    financialData: result.financialData || {},
    swotData: result.swotData || {},
    competitorData: result.competitorData || {},
    scorecard: result.scorecard || {},
    finalReport: result.finalReport || "",
  };
}
