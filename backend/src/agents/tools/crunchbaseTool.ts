import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Crunchbase Basic API v4
// Docs: https://data.crunchbase.com/docs/using-the-api
const CRUNCHBASE_BASE_URL = "https://api.crunchbase.com/api/v4";

// Fields available on the free Basic API tier
const ORGANIZATION_FIELDS = [
  "short_description",
  "long_description",
  "founded_on",
  "num_employees_enum",
  "revenue_range",
  "funding_total",
  "funding_stage",
  "last_funding_type",
  "last_funding_at",
  "num_funding_rounds",
  "categories",
  "category_groups",
  "headquarters_location",
  "website_url",
  "linkedin",
  "status",
  "operating_status",
  "ipo_status",
].join(",");

const FUNDING_ROUNDS_FIELDS = [
  "announced_on",
  "investment_type",
  "money_raised",
  "num_investors",
  "lead_investor_identifiers",
].join(",");

async function fetchCrunchbaseOrg(
  permalink: string
): Promise<Record<string, any>> {
  const apiKey = process.env.CRUNCHBASE_API_KEY;
  if (!apiKey) throw new Error("CRUNCHBASE_API_KEY not set");

  // 1. Fetch organization overview
  const orgUrl = `${CRUNCHBASE_BASE_URL}/entities/organizations/${permalink}?user_key=${apiKey}&field_ids=${ORGANIZATION_FIELDS}&card_ids=funding_rounds`;
  const orgRes = await fetch(orgUrl);

  if (!orgRes.ok) {
    const err = await orgRes.text();
    throw new Error(`Crunchbase API error (${orgRes.status}): ${err}`);
  }

  const orgData = await orgRes.json() as any;
  const props = orgData?.properties || {};
  const fundingRoundsCard: any[] = orgData?.cards?.funding_rounds || [];


  // Extract funding rounds
  const fundingRounds = fundingRoundsCard.slice(0, 5).map((round: any) => ({
    date: round.announced_on?.value || "N/A",
    type: round.investment_type || "N/A",
    amount: round.money_raised
      ? `${round.money_raised.value_usd ? "$" + (round.money_raised.value_usd / 1_000_000).toFixed(1) + "M" : round.money_raised.value + " " + round.money_raised.currency}`
      : "N/A",
    numInvestors: round.num_investors || 0,
    leadInvestors:
      round.lead_investor_identifiers
        ?.map((i: any) => i.value)
        .join(", ") || "N/A",
  }));

  return {
    name: props.identifier?.value || permalink,
    description: props.short_description || props.long_description || "N/A",
    foundedOn: props.founded_on?.value || "N/A",
    employeeCount: props.num_employees_enum || "N/A",
    revenueRange: props.revenue_range || "N/A",
    totalFunding: props.funding_total?.value_usd
      ? "$" + (props.funding_total.value_usd / 1_000_000).toFixed(1) + "M"
      : "N/A",
    fundingStage: props.funding_stage || "N/A",
    lastFundingType: props.last_funding_type || "N/A",
    lastFundingDate: props.last_funding_at?.value || "N/A",
    numFundingRounds: props.num_funding_rounds || 0,
    categories:
      props.categories?.map((c: any) => c.value).join(", ") || "N/A",
    categoryGroups:
      props.category_groups?.map((c: any) => c.value).join(", ") || "N/A",
    hq: props.headquarters_location?.value || "N/A",
    website: props.website_url || "N/A",
    operatingStatus: props.operating_status || "N/A",
    ipoStatus: props.ipo_status || "N/A",
    fundingRounds,
  };
}

// LangChain tool definition — agents call this by passing the startup's Crunchbase permalink
export const crunchbaseTool = tool(
  async ({ permalink }) => {
    try {
      const data = await fetchCrunchbaseOrg(permalink);
      return JSON.stringify(data, null, 2);
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "crunchbase_lookup",
    description:
      "Fetches startup financial data from Crunchbase API: total funding, funding rounds, investors, revenue range, funding stage, categories, and headquarters. Input is the Crunchbase permalink (slug) of the organization, e.g. 'stripe', 'openai', 'razorpay'. If you are unsure of the permalink, use the startup name in lowercase with hyphens replacing spaces.",
    schema: z.object({
      permalink: z
        .string()
        .describe(
          "The Crunchbase organization permalink/slug, e.g. 'stripe', 'open-ai', 'razorpay'"
        ),
    }),
  }
);
