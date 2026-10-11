import { createContext, useContext, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Gem,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import AdminOverview from './AdminOverview';
import AdminManagement from './AdminManagement';
import AdminOperations from './AdminOperations';

const NoticeContext = createContext(() => {});
export const useAdminNotice = () => useContext(NoticeContext);

const navItems = [
  { label: 'Overview', path: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Appointments', path: '/admin/appointments', icon: CalendarDays },
  { label: 'Orders', path: '/admin/orders', icon: ClipboardList },
  { label: 'Products', path: '/admin/products', icon: Package },
  { label: 'Services', path: '/admin/services', icon: Sparkles },
  { label: 'Nail designs', path: '/admin/designs', icon: Gem },
  { label: 'Business settings', path: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3200);
  };
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) notify(`Could not sign out: ${error.message}`);
    } catch (error) {
      notify(`Could not sign out: ${error.message || 'Please try again.'}`);
    }
  };

  const currentPage = navItems.find((item) =>
    item.end ? location.pathname === item.path : location.pathname.startsWith(item.path),
  );

  return (
    <NoticeContext.Provider value={notify}>
      <div className="admin-shell">
        {sidebarOpen && (
          <button
            className="admin-sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={`admin-sidebar${sidebarOpen ? ' is-open' : ''}`}>
          <div className="admin-sidebar-brand">
            <Link className="admin-brand" to="/">GlossedBy<em>Ridhi</em></Link>
            <button className="admin-mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">
              <X size={19} />
            </button>
          </div>
          <span className="admin-sidebar-caption">STUDIO MANAGEMENT</span>
          <nav className="admin-nav">
            {navItems.map(({ label, path, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
              >
                <Icon size={18} strokeWidth={1.8} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="admin-sidebar-bottom">
            <Link to="/" className="admin-nav-link"><ChevronLeft size={18} /> View website</Link>
            <button className="admin-nav-link" onClick={handleSignOut}>
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <button className="admin-mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              <Menu size={21} />
            </button>
            <div>
              <span className="admin-eyebrow">GLOSSEDBYRIDHI · ADMIN</span>
              <h1>{currentPage?.label || 'Studio management'}</h1>
            </div>
            <Link to="/" className="admin-topbar-site">Visit website <span>↗</span></Link>
          </header>

          <main className="admin-content">
            <Routes>
              <Route index element={<AdminOverview />} />
              <Route path="appointments" element={<AdminOperations type="appointments" />} />
              <Route path="orders" element={<AdminOperations type="orders" />} />
              <Route path="designs" element={<AdminManagement type="designs" />} />
              <Route path="services" element={<AdminManagement type="services" />} />
              <Route path="products" element={<AdminManagement type="products" />} />
              <Route path="settings" element={<AdminOperations type="settings" />} />
              <Route path="*" element={<AdminOverview />} />
            </Routes>
          </main>
        </div>
        {notice && <div className="admin-toast" role="status">{notice}</div>}
      </div>
    </NoticeContext.Provider>
  );
}
