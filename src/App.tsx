import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Mail,
  User,
  Settings,
  LayoutDashboard,
  CheckCircle2,
  Bell,
  Search,
  MoreVertical,
  Activity
} from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';

// Mock Data
const therapists = [
  { id: '1', name: 'Krystian Nagaba', role: 'Twarz marki', color: 'bg-emerald-100 text-emerald-800' },
  { id: '2', name: 'Natalia Pucz', role: 'Terapeutka', color: 'bg-indigo-100 text-indigo-800' },
  { id: '3', name: 'Waldek', role: 'Terapeuta', color: 'bg-amber-100 text-amber-800' },
];

const mockPatients = [
  { id: 'p1', name: 'Jan Kowalski', totalSessions: 20, usedSessions: 12, nextVisit: '2025-12-22T10:00:00' },
  { id: 'p2', name: 'Anna Nowak', totalSessions: 20, usedSessions: 5, nextVisit: '2025-12-23T14:00:00' },
  { id: 'p3', name: 'Marek Wiśniewski', totalSessions: 10, usedSessions: 10, nextVisit: null },
  { id: 'p4', name: 'Katarzyna Zielona', totalSessions: 20, usedSessions: 18, nextVisit: '2025-12-21T11:30:00' },
];

const mockSessions = [
  { id: 's1', patientId: 'p1', therapistId: '2', startTime: '2025-12-15T18:30:00', status: 'completed' },
  { id: 's2', patientId: 'p2', therapistId: '3', startTime: '2025-12-17T10:00:00', status: 'scheduled' },
  { id: 's3', patientId: 'p1', therapistId: '1', startTime: '2025-12-18T19:30:00', status: 'scheduled' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(new Date(2025, 11, 15)); // Grudzień 2025

  return (
    <div className="min-h-screen bg-myway-bg flex font-sans text-myway-text">
      {/* Elegant Sidebar */}
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
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<CalendarIcon size={22} />} 
            label="Kalendarz" 
            active={activeTab === 'calendar'} 
            onClick={() => setActiveTab('calendar')} 
          />
          <NavItem 
            icon={<Users size={22} />} 
            label="Pacjenci" 
            active={activeTab === 'patients'} 
            onClick={() => setActiveTab('patients')} 
          />
          <div className="pt-4 mt-4 border-t border-slate-100">
             <NavItem 
              icon={<Settings size={22} />} 
              label="Ustawienia" 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 bg-myway-secondary/20 text-myway-primary rounded-full flex items-center justify-center font-bold">
              KN
            </div>
            <div className="hidden lg:block overflow-hidden">
              <p className="text-sm font-bold text-slate-900 truncate">Krystian Nagaba</p>
              <p className="text-xs text-slate-500">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Top Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 px-8 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">
            {activeTab === 'dashboard' && "Panel Główny"}
            {activeTab === 'calendar' && "Harmonogram"}
            {activeTab === 'patients' && "Baza Pacjentów"}
            {activeTab === 'settings' && "Ustawienia"}
          </h2>
          
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
            <button className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full">
              <User size={20} />
            </button>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'calendar' && <CalendarView selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
          {activeTab === 'patients' && <PatientsView />}
          {activeTab === 'settings' && (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400">
              <Settings size={48} className="mb-4 opacity-50" />
              <p>Panel ustawień w budowie</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// --- Components ---

function NavItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        active 
          ? 'bg-myway-primary text-white shadow-lg shadow-teal-900/20' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-myway-primary'
      }`}
    >
      <span className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
      <span className="hidden lg:block font-medium">{label}</span>
    </button>
  );
}

function Dashboard() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Dzisiejsze Wizyty" 
          value="8" 
          trend="+2 vs wczoraj"
          trendUp={true}
          icon={<Clock className="w-6 h-6 text-white" />}
          color="bg-blue-500"
        />
        <StatCard 
          title="Aktywni Pacjenci" 
          value="42" 
          trend="+5 w tym miesiącu"
          trendUp={true}
          icon={<Users className="w-6 h-6 text-white" />}
          color="bg-emerald-500"
        />
        <StatCard 
          title="Wykorzystanie Pakietów" 
          value="68%" 
          trend="Średnio 14/20 sesji"
          trendUp={null}
          icon={<Activity className="w-6 h-6 text-white" />}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Sessions */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-soft border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Nadchodzące konsultacje</h3>
            <button className="text-sm font-medium text-myway-primary hover:underline">Zobacz wszystkie</button>
          </div>
          <div className="space-y-4">
            {mockSessions.map((session, idx) => {
              const patient = mockPatients.find(p => p.id === session.patientId);
              const therapist = therapists.find(t => t.id === session.therapistId);
              return (
                <div key={session.id} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-white hover:shadow-md transition-all rounded-xl border border-slate-100 group">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 border-white shadow-sm ${idx % 2 === 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {patient?.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 group-hover:text-myway-primary transition-colors">{patient?.name}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        <User size={14} /> {therapist?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{format(new Date(session.startTime), 'HH:mm')}</p>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      session.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {session.status === 'completed' ? 'Ukończono' : 'Zaplanowano'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions / Alerts */}
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-slate-100 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Wymagają uwagi</h3>
          <div className="space-y-4 flex-1">
             {mockPatients.filter(p => p.usedSessions >= p.totalSessions - 2).map(p => (
               <div key={p.id} className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                 <div className="p-2 bg-rose-100 rounded-lg text-rose-600 shrink-0">
                   <Activity size={18} />
                 </div>
                 <div>
                   <p className="font-bold text-rose-900 text-sm">{p.name}</p>
                   <p className="text-xs text-rose-700 mt-1">Kończy się pakiet ({p.usedSessions}/{p.totalSessions}). Skontaktuj się w sprawie przedłużenia.</p>
                 </div>
               </div>
             ))}
             <button className="w-full mt-auto py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 font-medium hover:border-myway-primary hover:text-myway-primary transition-all flex items-center justify-center gap-2">
               <Plus size={20} />
               Nowe zadanie
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ selectedDate, setSelectedDate }: { selectedDate: Date, setSelectedDate: any }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
        <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl">
          <button onClick={() => setSelectedDate(addDays(selectedDate, -7))} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-500">
            <ChevronLeft size={20} />
          </button>
          <h3 className="font-bold text-slate-800 min-w-[140px] text-center capitalize">
            {format(selectedDate, 'MMMM yyyy', { locale: pl })}
          </h3>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 7))} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-500">
            <ChevronRight size={20} />
          </button>
        </div>
        <button className="flex items-center gap-2 bg-myway-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-800 transition-colors shadow-lg shadow-teal-900/20">
          <Plus size={20} />
          Nowa Rezerwacja
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="p-4 border-b border-r border-slate-200 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-48">Pracownicy</th>
              {[0,1,2,3,4,5,6].map(d => {
                const date = addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), d);
                const isToday = isSameDay(date, new Date());
                return (
                  <th key={d} className={`p-4 border-b border-slate-200 text-center min-w-[140px] ${isToday ? 'bg-teal-50/50' : ''}`}>
                    <p className={`text-xs uppercase font-bold ${isToday ? 'text-myway-primary' : 'text-slate-400'}`}>
                      {format(date, 'EEEE', { locale: pl })}
                    </p>
                    <p className={`text-xl font-bold mt-1 ${isToday ? 'text-myway-primary' : 'text-slate-700'}`}>
                      {format(date, 'dd')}
                    </p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {therapists.map(t => (
              <tr key={t.id} className="group hover:bg-slate-50/30 transition-colors">
                <td className="p-4 border-b border-r border-slate-200 bg-white group-hover:bg-slate-50/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${t.color.replace('text-', 'bg-').split(' ')[0]} bg-opacity-20 ${t.color.split(' ')[1]}`}>
                      {t.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role}</p>
                    </div>
                  </div>
                </td>
                {[0,1,2,3,4,5,6].map(d => (
                  <td key={d} className="p-2 border-b border-slate-100 border-r border-dashed min-h-[100px] relative">
                    {/* Render mock slots based on the screenshot analysis */}
                    {t.id === '3' && d === 2 && <TimeSlot label="10:00 - 16:00" type="work" />}
                    {t.id === '1' && d === 3 && <TimeSlot label="19:30 - 21:00" type="evening" />}
                    {t.id === '3' && d === 3 && <TimeSlot label="08:00 - 13:00" type="work" />}
                    {t.id === '2' && d === 3 && <TimeSlot label="16:30 - 17:30" type="work" />}
                    {t.id === '3' && d === 4 && <TimeSlot label="08:00 - 13:00" type="work" />}
                    {t.id === '2' && d === 0 && <TimeSlot label="18:30 - 19:30" type="evening" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PatientsView() {
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

function StatCard({ title, value, trend, trendUp, icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl shadow-lg shadow-slate-200/50 ${color}`}>
          {icon}
        </div>
        {trendUp !== null && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
      <p className="text-3xl font-bold text-slate-800 mt-2 tracking-tight">{value}</p>
      {trendUp === null && <p className="text-xs text-slate-400 mt-2 font-medium">{trend}</p>}
    </div>
  );
}

function TimeSlot({ label, type }: { label: string, type: 'work' | 'evening' }) {
  const isEvening = type === 'evening';
  return (
    <div className={`
      p-2 rounded-lg text-xs font-bold shadow-sm mb-2 cursor-pointer hover:scale-105 transition-transform
      ${isEvening 
        ? 'bg-indigo-600 text-white shadow-indigo-900/20' 
        : 'bg-white border border-slate-200 text-slate-700 hover:border-myway-primary hover:text-myway-primary'
      }
    `}>
      {label}
    </div>
  );
}