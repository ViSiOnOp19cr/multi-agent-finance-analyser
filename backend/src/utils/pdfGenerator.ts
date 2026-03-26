import puppeteer from "puppeteer";
import { marked } from "marked";
import path from "path";
import fs from "fs/promises";

// Directory where PDFs will be stored
const PDF_DIR = path.resolve("pdfs");

// Ensure PDF directory exists
async function ensurePdfDir() {
  try {
    await fs.mkdir(PDF_DIR, { recursive: true });
  } catch {}
}

// Convert markdown report to a styled PDF, return the file path
export async function generatePdf(
  analysisId: string,
  startupName: string,
  markdownReport: string
): Promise<string> {
  await ensurePdfDir();

  const filename = `analysis_${analysisId}.pdf`;
  const outputPath = path.join(PDF_DIR, filename);

  // Convert markdown to HTML
  const htmlBody = await marked(markdownReport);

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      color: #111111;
      line-height: 1.75;
      padding: 48px 56px;
      background: #ffffff;
    }

    /* ── Header ─────────────────────────────────────── */
    .report-header {
      border-bottom: 3px solid #111111;
      padding-bottom: 24px;
      margin-bottom: 36px;
    }
    .report-header-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .report-header-logo-icon {
      font-size: 18px;
    }
    .report-header-logo-text {
      font-size: 11px;
      font-weight: 600;
      color: #555555;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .report-header h1 {
      font-size: 26px;
      font-weight: 800;
      color: #111111 !important;
      margin-bottom: 6px;
      line-height: 1.25;
    }
    .report-header .meta {
      font-size: 11.5px;
      color: #777777;
    }

    /* ── Report title (from markdown h1) ────────────── */
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #111111;
      margin: 32px 0 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid #111111;
    }

    /* ── Section headings ───────────────────────────── */
    h2 {
      font-size: 13px;
      font-weight: 700;
      color: #111111;
      background: #f5f5f5;
      padding: 8px 14px;
      border-left: 4px solid #111111;
      margin: 28px 0 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    h3 {
      font-size: 13px;
      font-weight: 600;
      color: #111111;
      margin: 18px 0 8px;
      border-bottom: 1px solid #dddddd;
      padding-bottom: 4px;
    }

    h4 {
      font-size: 12.5px;
      font-weight: 600;
      color: #333333;
      margin: 12px 0 6px;
    }

    p { margin: 8px 0; color: #222222; }

    ul, ol { margin: 8px 0 8px 22px; }
    li { margin: 5px 0; color: #222222; }

    strong { font-weight: 700; color: #111111; }
    em { color: #444444; font-style: italic; }

    a { color: #111111; text-decoration: underline; }

    /* ── Tables ─────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 12px;
      border: 1px solid #cccccc;
    }
    th {
      background: #111111;
      color: #ffffff;
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    td {
      padding: 9px 14px;
      border-bottom: 1px solid #dddddd;
      color: #222222;
    }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f9f9f9; }

    /* ── Code ───────────────────────────────────────── */
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11.5px;
      color: #111111;
      border: 1px solid #dddddd;
    }

    /* ── Blockquotes ────────────────────────────────── */
    blockquote {
      border-left: 3px solid #111111;
      padding: 8px 16px;
      margin: 14px 0;
      background: #f9f9f9;
      font-style: italic;
      color: #444444;
    }

    hr {
      border: none;
      border-top: 1px solid #cccccc;
      margin: 28px 0;
    }

    /* ── Footer ─────────────────────────────────────── */
    .report-footer {
      margin-top: 52px;
      padding-top: 14px;
      border-top: 1px solid #cccccc;
      font-size: 10px;
      color: #888888;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="report-header-logo">
      <div class="report-header-logo-icon">📊</div>
      <span class="report-header-logo-text">FinAnalyser · Multi-Agent Startup Analyser</span>
    </div>
    <h1>${startupName} — Investment Analysis</h1>
    <div class="meta">Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>

  ${htmlBody}

  <div class="report-footer">
    This report was generated automatically by the Multi-Agent Startup Analyser. All data is sourced from public web sources including TechCrunch, PitchBook, and other databases. Not financial advice.
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
      printBackground: true,
    });
  } finally {
    await browser.close();
  }

  return `/pdfs/${filename}`;
}
