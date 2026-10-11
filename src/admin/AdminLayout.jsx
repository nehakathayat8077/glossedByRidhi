import { createContext, useContext, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
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
  { label: 'Nail designs', path: '/admin/designs', icon: Gem },
  { label: 'Services', path: '/admin/services', icon: Sparkles },
  { label: 'Products', path: '/admin/products', icon: Package },
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
            <a className="admin-brand" href="/">GlossedBy<em>Ridhi</em></a>
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
            <a href="/" className="admin-nav-link"><ChevronLeft size={18} /> View website</a>
            <button className="admin-nav-link" onClick={() => supabase.auth.signOut()}>
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
            <a href="/" className="admin-topbar-site">Visit website <span>↗</span></a>
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
