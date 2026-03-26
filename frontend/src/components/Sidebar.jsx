import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  MessageSquare,
  LogOut,
  Sparkles,
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Sparkles size={20} />
          </div>
          <span className="sidebar-brand-text">FinAnalyser</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <MessageSquare size={18} />
            <span>Chat</span>
          </NavLink>
        </nav>
      </div>

      {/* User section */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name || 'User'}</span>
            <span className="sidebar-user-email">{user?.email || ''}</span>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
