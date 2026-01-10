import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CalendarPage } from './pages/CalendarPage';
import { PatientsPage } from './pages/PatientsPage';
import { TherapistsPage } from './pages/TherapistsPage';
import {
  Calendar as CalendarIcon,
  Users,
  Settings,
  LayoutDashboard,
  Bell,
  Search,
  Activity,
  LogOut
} from 'lucide-react';
import { signOut, getAuth } from 'firebase/auth';

// --- Protected Route ---
function ProtectedRoute() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" />;
  }
  return <MainLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute />}>
            <Route index element={<DashboardPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="settings" element={<TherapistsPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

// --- Main Application Layout ---
function MainLayout() {
  return (
    <div className="min-h-screen bg-myway-bg flex font-sans text-myway-text">
      <aside className="w-20 lg:w-72 bg-white border-r border-slate-200 flex flex-col transition-all duration-300">
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-8 border-b border-slate-100">
          <div className="bg-gradient-to-br from-myway-primary to-teal-600 p-2.5 rounded-xl shadow-lg shadow-teal-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="hidden lg:block ml-4 text-xl font-bold tracking-tight text-slate-800">MyWay Point</h1>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          <NavItem
            icon={<LayoutDashboard size={22} />}
            label="Dashboard"
            to="/"
          />
          <NavItem
            icon={<CalendarIcon size={22} />}
            label="Kalendarz"
            to="/calendar"
          />
          <NavItem
            icon={<Users size={22} />}
            label="Pacjenci"
            to="/patients"
          />
          <div className="pt-4 mt-4 border-t border-slate-100">
            <NavItem
              icon={<Settings size={22} />}
              label="Ustawienia"
              to="/settings"
            />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => signOut(getAuth())}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          >
            <span className="transition-transform duration-200 group-hover:scale-110"><LogOut size={22} /></span>
            <span className="hidden lg:block font-medium">Wyloguj</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 px-8 flex justify-between items-center">
          <div />
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Szukaj pacjenta..."
                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-myway-primary/20 w-64 transition-all"
              />
            </div>
            <button className="relative p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link
      to={to}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        active
          ? 'bg-gradient-to-r from-myway-primary to-teal-600 text-white shadow-lg shadow-teal-500/20'
          : 'text-slate-500 hover:bg-slate-50 hover:text-myway-primary'
      }`}
    >
      <span className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
      <span className="hidden lg:block font-medium">{label}</span>
    </Link>
  );
}
