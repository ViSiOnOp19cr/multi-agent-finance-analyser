import { useState } from 'react';
import api from '../lib/api';
import { X, Rocket, Send } from 'lucide-react';

export default function NewAnalysisModal({ onClose, onCreated }) {
  const [startupName, setStartupName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startupName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/analysis', {
        startupName: startupName.trim(),
        description: description.trim() || undefined,
      });
      onCreated(res.data.analysisId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start analysis');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Rocket size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            New Analysis
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Startup Name *
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Stripe, Notion, Figma..."
              value={startupName}
              onChange={(e) => setStartupName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Description (optional)
            </label>
            <textarea
              className="input"
              placeholder="Brief context about the startup or specific focus areas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !startupName.trim()}
            style={{ width: '100%', padding: 12 }}
          >
            {loading ? (
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            ) : (
              <>
                <Send size={16} />
                Start Analysis
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
