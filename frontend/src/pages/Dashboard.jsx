import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import NewAnalysisModal from '../components/NewAnalysisModal';
import {
  Plus,
  TrendingUp,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const fetchAnalyses = async () => {
    try {
      const res = await api.get('/analysis');
      setAnalyses(res.data.analyses);
    } catch (err) {
      console.error('Failed to fetch analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyses();
  }, []);

  // Poll for processing analyses
  useEffect(() => {
    const hasProcessing = analyses.some((a) => a.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(fetchAnalyses, 5000);
    return () => clearInterval(interval);
  }, [analyses]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this analysis?')) return;
    try {
      await api.delete(`/analysis/${id}`);
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleCreated = (analysisId) => {
    setShowModal(false);
    navigate(`/analysis/${analysisId}`);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing':
        return <Loader2 size={14} className="status-icon-spin" />;
      case 'completed':
        return <CheckCircle2 size={14} />;
      case 'failed':
        return <XCircle size={14} />;
      default:
        return <Clock size={14} />;
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredAnalyses = analyses.filter((a) =>
    a.startupName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">
            Analyse startups with AI-powered multi-agent research
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          New Analysis
        </button>
      </div>

      {analyses.length > 0 && (
        <div className="dashboard-search">
          <Search size={16} className="dashboard-search-icon" />
          <input
            type="text"
            className="input dashboard-search-input"
            placeholder="Search analyses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {filteredAnalyses.length === 0 && !loading ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty-icon">
            <TrendingUp size={48} />
          </div>
          <h2>No analyses yet</h2>
          <p>Start by analyzing a startup to get AI-powered insights</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} />
            Create your first analysis
          </button>
        </div>
      ) : (
        <div className="analysis-grid">
          {filteredAnalyses.map((analysis) => (
            <div
              key={analysis.id}
              className="card card-clickable analysis-card"
              onClick={() => navigate(`/analysis/${analysis.id}`)}
            >
              <div className="analysis-card-header">
                <h3 className="analysis-card-name">{analysis.startupName}</h3>
                <span className={`badge badge-${analysis.status}`}>
                  {getStatusIcon(analysis.status)}
                  {analysis.status}
                </span>
              </div>

              {analysis.description && (
                <p className="analysis-card-desc">{analysis.description}</p>
              )}

              <div className="analysis-card-footer">
                <span className="analysis-card-date">
                  <Clock size={12} />
                  {formatDate(analysis.createdAt)}
                </span>
                <div className="analysis-card-actions">
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/analysis/${analysis.id}`);
                    }}
                    title="View Details"
                  >
                    <ExternalLink size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={(e) => handleDelete(e, analysis.id)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <NewAnalysisModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
