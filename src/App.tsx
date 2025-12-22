import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { 
  useState 
} from 'react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Settings,
  LayoutDashboard,
  Bell,
  Search,
  MoreVertical,
  Activity,
  LogOut
} from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { getAuth, signOut } from 'firebase/auth';


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
            <Route index element={<Dashboard />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="patients" element={<PatientsView />} />
            <Route path="settings" element={(
              <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <Settings size={48} className="mb-4 opacity-50" />
                <p>Panel ustawień w budowie</p>
              </div>
            )} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

// --- Main Application Layout ---
function MainLayout() {
  // This would be where you fetch real data in a real app
  const therapists = [
    { id: '1', name: 'Krystian Nagaba', role: 'Twarz marki', color: 'bg-emerald-100 text-emerald-800' },
    { id: '2', name: 'Natalia Pucz', role: 'Terapeutka', color: 'bg-indigo-100 text-indigo-800' },
    { id: '3', name: 'Waldek', role: 'Terapeuta', color: 'bg-amber-100 text-amber-800' },
  ];

  return (
    <div className="min-h-screen bg-myway-bg flex font-sans text-myway-text">
       <aside className="w-20 lg:w-72 bg-white border-r border-slate-200 flex flex-col transition-all duration-300">
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-8 border-b border-slate-100">
          <div className="bg-myway-primary p-2 rounded-xl shadow-lg shadow-teal-900/20">
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-slate-500 hover:bg-rose-50 hover:text-rose-600`}
          >
            <span className={`transition-transform duration-200 group-hover:scale-110`}><LogOut size={22}/></span>
            <span className="hidden lg:block font-medium">Wyloguj</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 px-8 flex justify-between items-center">
            {/* Header content can be dynamic based on route */}
            <div/>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Szukaj pacjenta..." 
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-myway-secondary/50 w-64 transition-all"
              />
            </div>
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
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


function NavItem({ icon, label, to }: { icon: any, label: string, to: string }) {
  const location = window.location;
  const active = location.pathname === to;
  return (
    <a 
      href={to}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        active 
          ? 'bg-myway-primary text-white shadow-lg shadow-teal-900/20' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-myway-primary'
      }`}
    >
      <span className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
      <span className="hidden lg:block font-medium">{label}</span>
    </a>
  );
}

// All other components (Dashboard, CalendarView, PatientsView, etc.)
// remain the same as before, but without the main layout structure
// as it's now handled by MainLayout. I will recreate them separately if needed.
// For now, let's keep them as placeholders to see if the structure works.

function Dashboard() { return <div className="text-2xl font-bold">Dashboard</div> }

function PatientsView() {
    // This will be replaced with Firestore data
  const mockPatients = [
    { id: 'p1', name: 'Jan Kowalski', totalSessions: 20, usedSessions: 12, nextVisit: '2025-12-22T10:00:00' },
    { id: 'p2', name: 'Anna Nowak', totalSessions: 20, usedSessions: 5, nextVisit: '2025-12-23T14:00:00' },
    { id: 'p3', name: 'Marek Wiśniewski', totalSessions: 10, usedSessions: 10, nextVisit: null },
    { id: 'p4', name: 'Katarzyna Zielona', totalSessions: 20, usedSessions: 18, nextVisit: '2025-12-21T11:30:00' },
  ];
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-slate-800 text-lg">Baza Pacjentów</h3>
        <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Export CSV</button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-myway-primary hover:bg-teal-800 rounded-lg shadow-lg shadow-teal-900/10">Dodaj Pacjenta</button>
        </div>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Pacjent</th>
            <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-1/3">Status Pakietu (20h)</th>
            <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
            <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Kolejna wizyta</th>
            <th className="p-5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {mockPatients.map(p => {
            const usagePercent = (p.usedSessions / p.totalSessions) * 100;
            const isCritical = usagePercent >= 90;
            const isWarning = usagePercent >= 75 && !isCritical;
            
            return (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                <td className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-white group-hover:shadow-sm transition-all">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-500">ID: {p.id}</p>
                    </div>
                  </div>
                </td>
                <td className="p-5">
                  <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                    <span>Wykorzystano: {p.usedSessions}</span>
                    <span>Pozostało: {p.totalSessions - p.usedSessions}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        isCritical ? 'bg-gradient-to-r from-rose-500 to-rose-400' : 
                        isWarning ? 'bg-gradient-to-r from-amber-400 to-amber-300' : 
                        'bg-gradient-to-r from-teal-500 to-emerald-400'
                      }`} 
                      style={{ width: `${usagePercent}%` }}
                    ></div>
                  </div>
                </td>
                <td className="p-5">
                  {isCritical ? (
                     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                       <Activity size={12} /> Koniec pakietu
                     </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <CheckCircle2 size={12} /> Aktywny
                    </span>
                  )}
                </td>
                <td className="p-5">
                  {p.nextVisit ? (
                    <div className="text-sm text-slate-600 font-medium bg-slate-50 inline-block px-3 py-1 rounded-lg">
                      {format(new Date(p.nextVisit), 'dd.MM, HH:mm')}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 italic">Brak zaplanowanych</span>
                  )}
                </td>
                <td className="p-5 text-right">
                  <button className="p-2 text-slate-400 hover:text-myway-primary hover:bg-slate-100 rounded-lg transition-colors">
                    <MoreVertical size={20} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CalendarView() { return <div className="text-2xl font-bold">Calendar View</div> }
