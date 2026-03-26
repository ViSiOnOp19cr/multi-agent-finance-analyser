import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../lib/api';
import {
  ArrowLeft,
  Download,
  MessageSquare,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import './AnalysisDetail.css';

// ── Scorecard component ────────────────────────────────────────
const SCORE_DIMENSIONS = [
  { key: 'teamStrength',    label: 'Team Strength',      weight: '25%' },
  { key: 'founderFit',      label: 'Founder Fit',         weight: '20%' },
  { key: 'traction',        label: 'Traction',            weight: '20%' },
  { key: 'marketSize',      label: 'Market Size',         weight: '15%' },
  { key: 'competitiveMoat', label: 'Competitive Moat',    weight: '10%' },
  { key: 'businessModel',   label: 'Business Model',      weight: '10%' },
];

function scoreColor(score) {
  if (score >= 7.5) return '#22c55e'; // green
  if (score >= 5.5) return '#f59e0b'; // amber
  return '#ef4444';                   // red
}

function Scorecard({ scorecard }) {
  const [tooltip, setTooltip] = useState(null);
  if (!scorecard || scorecard.error) return null;

  const overall = scorecard.overall || {};
  const verdict = overall.verdict || 'N/A';
  const verdictIcon =
    verdict === 'Bullish' ? <TrendingUp size={20} /> :
    verdict === 'Bearish' ? <TrendingDown size={20} /> :
    <Minus size={20} />;
  const verdictClass =
    verdict === 'Bullish' ? 'verdict-bullish' :
    verdict === 'Bearish' ? 'verdict-bearish' : 'verdict-neutral';

  return (
    <div className="scorecard">
      {/* Header */}
      <div className="scorecard-header">
        <div className="scorecard-title">
          <span>Investment Scorecard</span>
          <span className="scorecard-subtitle">VC-Standard Evaluation</span>
        </div>
        <div className={`scorecard-verdict ${verdictClass}`}>
          {verdictIcon}
          <span>{verdict}</span>
          <span className="scorecard-overall">{overall.score?.toFixed(1)}/10</span>
        </div>
      </div>

      {/* Score bars */}
      <div className="scorecard-dims">
        {SCORE_DIMENSIONS.map(({ key, label, weight }) => {
          const dim = scorecard[key] || {};
          const score = dim.score ?? 0;
          const color = scoreColor(score);
          return (
            <div
              key={key}
              className="scorecard-dim"
              onMouseEnter={() => setTooltip(key)}
              onMouseLeave={() => setTooltip(null)}
            >
              <div className="scorecard-dim-header">
                <span className="scorecard-dim-label">{label}</span>
                <span className="scorecard-dim-meta">
                  <span className="scorecard-weight">weight {weight}</span>
                  <span className="scorecard-score" style={{ color }}>{score}/10</span>
                </span>
              </div>
              <div className="scorecard-bar-track">
                <div
                  className="scorecard-bar-fill"
                  style={{ width: `${score * 10}%`, background: color }}
                />
              </div>
              {tooltip === key && dim.rationale && (
                <div className="scorecard-tooltip">{dim.rationale}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall summary */}
      {overall.summary && (
        <div className="scorecard-summary">
          <p>{overall.summary}</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function AnalysisDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalysis = async () => {
    try {
      const res = await api.get(`/analysis/${id}`);
      setAnalysis(res.data.analysis);
    } catch (err) {
      console.error('Failed to fetch analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalysis(); }, [id]);

  useEffect(() => {
    if (!analysis || analysis.status !== 'processing') return;
    const interval = setInterval(fetchAnalysis, 5000);
    return () => clearInterval(interval);
  }, [analysis?.status]);

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="page-container">
        <p>Analysis not found.</p>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const renderProcessing = () => (
    <div className="analysis-processing">
      <div className="analysis-processing-animation">
        <Loader2 size={48} className="status-icon-spin" />
      </div>
      <h2>Analyzing {analysis.startupName}...</h2>
      <p>Our AI agents are researching financials, competitors, and market data. This typically takes 1-3 minutes.</p>
      <div className="analysis-processing-steps">
        {['Financial Agent', 'SWOT Agent', 'Competitor Agent', 'Scoring Agent', 'Manager — Final Report'].map((step, i) => (
          <div key={i} className="processing-step active">
            <div className="processing-step-dot" />
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFailed = () => (
    <div className="analysis-processing" style={{ gap: 16 }}>
      <AlertTriangle size={48} style={{ color: 'var(--danger)', opacity: 0.7 }} />
      <h2>Analysis Failed</h2>
      <p>Something went wrong while analyzing {analysis.startupName}. Please try again.</p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
    </div>
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="detail-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="detail-header-info">
          <div className="detail-header-top">
            <h1>{analysis.startupName}</h1>
            <span className={`badge badge-${analysis.status}`}>{analysis.status}</span>
          </div>
          {analysis.description && <p className="detail-description">{analysis.description}</p>}
        </div>
        <div className="detail-header-actions">
          {analysis.pdfUrl && (
            <a href={analysis.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <Download size={16} /> Download PDF
            </a>
          )}
          {analysis.status === 'completed' && (
            <button className="btn btn-primary" onClick={() => navigate(`/chat?analysisId=${analysis.id}`)}>
              <MessageSquare size={16} /> Chat about this
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {analysis.status === 'processing' && renderProcessing()}
      {analysis.status === 'failed' && renderFailed()}
      {analysis.status === 'completed' && (
        <div className="detail-tab-content">
          {analysis.finalReport ? (() => {
            // Split the markdown at the Sources section
            const sourcesMatch = analysis.finalReport.match(/^(## Sources)/m);
            if (sourcesMatch) {
              const splitIdx = analysis.finalReport.indexOf(sourcesMatch[0]);
              const beforeSources = analysis.finalReport.slice(0, splitIdx);
              const fromSources = analysis.finalReport.slice(splitIdx);
              return (
                <>
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{beforeSources}</ReactMarkdown>
                  </div>
                  {analysis.scorecard && (
                    <div className="scorecard-section">
                      <h2 className="scorecard-section-title">Investment Scorecard</h2>
                      <Scorecard scorecard={analysis.scorecard} />
                    </div>
                  )}
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{fromSources}</ReactMarkdown>
                  </div>
                </>
              );
            }
            // No Sources section found — show report then scorecard at bottom
            return (
              <>
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.finalReport}</ReactMarkdown>
                </div>
                {analysis.scorecard && (
                  <div className="scorecard-section">
                    <h2 className="scorecard-section-title">Investment Scorecard</h2>
                    <Scorecard scorecard={analysis.scorecard} />
                  </div>
                )}
              </>
            );
          })() : (
            <p style={{ color: 'var(--text-secondary)' }}>Report not yet available.</p>
          )}
        </div>
      )}
    </div>
  );
}
