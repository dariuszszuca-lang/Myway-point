import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Calendar,
  Users,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Activity,
  X,
  User,
  Check,
  Mail,
  Phone
} from 'lucide-react';
import { parseISO } from 'date-fns';
import { getTodaySessions, getDashboardStats, updateSession, updateSessionStatus, deleteSession } from '../services/sessionService';
import { getPatients, incrementUsedSessions, decrementUsedSessions } from '../services/patientService';
import { getTherapists, getTherapistColor } from '../services/therapistService';
import { Session, Therapist, Patient, WORKING_HOURS } from '../types';
import { useAuth } from '../context/AuthContext';

// Helper to add minutes to time string
const addMinutesToTime = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
};

// Generate time slots
const generateTimeSlots = () => {
  const slots: string[] = [];
  const startMinutes = WORKING_HOURS.start * 60;
  const endMinutes = WORKING_HOURS.end * 60;
  let current = startMinutes;
  while (current < endMinutes) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    current += WORKING_HOURS.slotDuration;
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export function DashboardPage() {
  const { isAdmin } = useAuth();

  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState({
    todaySessions: 0,
    todayCompleted: 0,
    weekSessions: 0,
    monthCompleted: 0,
  });
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [editData, setEditData] = useState<Partial<Session>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sessionsData, therapistsData, patientsData, statsData] = await Promise.all([
        getTodaySessions(),
        getTherapists(),
        getPatients(),
        getDashboardStats(),
      ]);

      setTodaySessions(sessionsData.filter(s => s.status !== 'cancelled'));
      setTherapists(therapistsData);
      setPatients(patientsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
    setLoading(false);
  };

  const openViewModal = (session: Session) => {
    setModalMode('view');
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const openEditModal = (session: Session) => {
    setModalMode('edit');
    setSelectedSession(session);
    setEditData({
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      therapistId: session.therapistId,
      therapistName: session.therapistName,
      patientId: session.patientId,
      patientName: session.patientName,
      notes: session.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleEditSession = async () => {
    if (!selectedSession || !editData.patientId || !editData.therapistId || !editData.date) return;
    try {
      await updateSession(selectedSession.id, {
        date: editData.date,
        startTime: editData.startTime,
        endTime: editData.endTime,
        therapistId: editData.therapistId,
        therapistName: editData.therapistName,
        patientId: editData.patientId,
        patientName: editData.patientName,
        notes: editData.notes,
      });
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error updating session:', error);
      alert('Błąd podczas aktualizacji sesji');
    }
  };

  const handleStatusChange = async (sessionId: string, newStatus: Session['status']) => {
    try {
      const previousStatus = selectedSession?.status;
      const patientId = selectedSession?.patientId;
      await updateSessionStatus(sessionId, newStatus);
      if (isAdmin && patientId) {
        if (newStatus === 'completed' && previousStatus !== 'completed') {
          await incrementUsedSessions(patientId);
        } else if (previousStatus === 'completed' && newStatus !== 'completed') {
          await decrementUsedSessions(patientId);
        }
      }
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error updating session:', error);
      alert('Błąd podczas aktualizacji sesji');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę sesję?')) return;
    try {
      await deleteSession(sessionId);
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const today = new Date();
  const formattedDate = format(today, "EEEE, d MMMM yyyy", { locale: pl });

  const getTherapistIndex = (id: string) => therapists.findIndex(t => t.id === id);

  const getStatusBadge = (status: Session['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={12} /> Zakończona
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
            <Clock size={12} /> Zaplanowana
          </span>
        );
      case 'no-show':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
            <AlertCircle size={12} /> Nieobecność
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-myway-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 capitalize">{formattedDate}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/calendar"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors"
          >
            <Calendar size={18} />
            Kalendarz
          </Link>
          <Link
            to="/calendar?action=new"
            className="flex items-center gap-2 px-4 py-2.5 bg-myway-primary text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20"
          >
            <Plus size={18} />
            Nowa sesja
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Calendar className="w-6 h-6" />}
          label="Dzisiejsze sesje"
          value={stats.todaySessions}
          subtext={`${stats.todayCompleted} zakończone`}
          color="teal"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Ten tydzień"
          value={stats.weekSessions}
          subtext="zaplanowane sesje"
          color="blue"
        />
        <StatCard
          icon={<Users className="w-6 h-6" />}
          label="Pacjenci"
          value={patients.length}
          subtext="w bazie"
          color="violet"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Ten miesiąc"
          value={stats.monthCompleted}
          subtext="ukończonych sesji"
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Sessions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800">Dzisiejsze sesje</h2>
              <p className="text-sm text-slate-500">{todaySessions.length} sesji zaplanowanych</p>
            </div>
            <Link
              to="/calendar"
              className="text-sm text-myway-primary font-medium hover:underline flex items-center gap-1"
            >
              Zobacz wszystkie <ArrowRight size={14} />
            </Link>
          </div>

          {todaySessions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <Calendar className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 mb-4">Brak sesji na dziś</p>
              <Link
                to="/calendar?action=new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-myway-primary text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                <Plus size={16} />
                Zaplanuj sesję
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {todaySessions.map((session) => {
                const therapistIndex = getTherapistIndex(session.therapistId);
                const colors = getTherapistColor(therapistIndex);

                return (
                  <button
                    key={session.id}
                    onClick={() => openViewModal(session)}
                    className="w-full p-4 hover:bg-slate-50 transition-colors flex items-center gap-4 text-left cursor-pointer"
                  >
                    {/* Time */}
                    <div className="w-20 text-center">
                      <p className="text-lg font-bold text-slate-800">{session.startTime}</p>
                      <p className="text-xs text-slate-400">{session.endTime}</p>
                    </div>

                    {/* Therapist indicator */}
                    <div className={`w-1 h-12 rounded-full ${colors.dot}`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{session.patientName}</p>
                      <p className="text-sm text-slate-500">{session.therapistName}</p>
                    </div>

                    {/* Status */}
                    <div>{getStatusBadge(session.status)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Therapists Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">Terapeuci</h2>
            <p className="text-sm text-slate-500">{therapists.length} aktywnych</p>
          </div>

          <div className="p-4 space-y-3">
            {therapists.map((therapist, idx) => {
              const colors = getTherapistColor(idx);
              const todayCount = todaySessions.filter(s => s.therapistId === therapist.id).length;

              return (
                <div
                  key={therapist.id}
                  className={`p-4 rounded-xl border ${colors.border} ${colors.bg} transition-all hover:shadow-sm`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${colors.dot} flex items-center justify-center text-white font-bold`}>
                      {therapist.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${colors.text} truncate`}>{therapist.name}</p>
                      <p className="text-xs text-slate-500">{therapist.specialization}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${colors.text}`}>{todayCount}</p>
                      <p className="text-xs text-slate-500">dziś</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-100">
            <Link
              to="/settings"
              className="block w-full py-2.5 text-center text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Zarządzaj terapeutami
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Patients needing attention */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-2xl font-bold text-amber-600">
              {patients.filter(p => p.usedSessions >= p.totalSessions).length}
            </span>
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">Kończące pakiet</h3>
          <p className="text-sm text-slate-500">Pacjenci wymagający odnowienia</p>
        </div>

        {/* Active patients */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Activity className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-2xl font-bold text-emerald-600">
              {patients.filter(p => p.usedSessions < p.totalSessions).length}
            </span>
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">Aktywni pacjenci</h3>
          <p className="text-sm text-slate-500">Z aktywnymi pakietami</p>
        </div>

        {/* Quick action */}
        <Link
          to="/patients"
          className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white hover:from-slate-700 hover:to-slate-800 transition-all group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-semibold mb-1">Baza pacjentów</h3>
          <p className="text-sm text-white/60">Zarządzaj danymi pacjentów</p>
        </Link>
      </div>

      {/* Session Modal */}
      {isModalOpen && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {modalMode === 'edit' ? 'Edytuj sesję' : 'Szczegóły sesji'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {modalMode === 'edit' ? (
                <>
                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
                    <input
                      type="date"
                      value={editData.date || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-myway-primary/20"
                    />
                  </div>
                  {/* Time */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Godzina</label>
                    <select
                      value={editData.startTime || ''}
                      onChange={(e) => {
                        const startTime = e.target.value;
                        setEditData(prev => ({
                          ...prev,
                          startTime,
                          endTime: addMinutesToTime(startTime, WORKING_HOURS.slotDuration),
                        }));
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-myway-primary/20"
                    >
                      {TIME_SLOTS.map(slot => (
                        <option key={slot} value={slot}>{slot} - {addMinutesToTime(slot, WORKING_HOURS.slotDuration)}</option>
                      ))}
                    </select>
                  </div>
                  {/* Therapist */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Terapeuta</label>
                    <select
                      value={editData.therapistId || ''}
                      onChange={(e) => {
                        const therapist = therapists.find(t => t.id === e.target.value);
                        setEditData(prev => ({
                          ...prev,
                          therapistId: e.target.value,
                          therapistName: therapist?.name,
                        }));
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-myway-primary/20"
                    >
                      {therapists.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Patient */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Pacjent</label>
                    <select
                      value={editData.patientId || ''}
                      onChange={(e) => {
                        const patient = patients.find(p => p.id === e.target.value);
                        setEditData(prev => ({
                          ...prev,
                          patientId: e.target.value,
                          patientName: patient?.name,
                        }));
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-myway-primary/20"
                    >
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Notatki</label>
                    <textarea
                      value={editData.notes || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-myway-primary/20 resize-none"
                      placeholder="Dodatkowe informacje..."
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* View mode */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <Calendar size={18} className="text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">
                        {format(parseISO(selectedSession.date), 'EEEE, d MMMM yyyy', { locale: pl })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <Clock size={18} className="text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">
                        {selectedSession.startTime} - {selectedSession.endTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <User size={18} className="text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{selectedSession.patientName}</p>
                        <p className="text-xs text-slate-500">{selectedSession.therapistName}</p>
                      </div>
                    </div>
                    {/* Contact info */}
                    {isAdmin && (() => {
                      const sessionPatient = patients.find(p => p.id === selectedSession.patientId);
                      if (!sessionPatient?.email && !sessionPatient?.phone) return null;
                      return (
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-1.5">
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Dane kontaktowe</p>
                          {sessionPatient?.email && (
                            <a href={`mailto:${sessionPatient.email}`} className="flex items-center gap-2 text-sm text-blue-700 hover:underline">
                              <Mail size={14} />{sessionPatient.email}
                            </a>
                          )}
                          {sessionPatient?.phone && (
                            <a href={`tel:${sessionPatient.phone}`} className="flex items-center gap-2 text-sm text-blue-700 hover:underline">
                              <Phone size={14} />{sessionPatient.phone}
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Admin actions */}
                  {isAdmin && (
                    <>
                      <div className="pt-4 border-t border-slate-100">
                        <button
                          onClick={() => openEditModal(selectedSession)}
                          className="w-full flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-medium"
                        >
                          <Calendar size={16} />
                          Edytuj sesję
                        </button>
                      </div>
                      <div className="pt-2">
                        <p className="text-sm font-medium text-slate-700 mb-3">Zmień status:</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleStatusChange(selectedSession.id, 'completed')}
                            className="flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                          >
                            <Check size={16} />
                            Zakończona
                          </button>
                          <button
                            onClick={() => handleStatusChange(selectedSession.id, 'no-show')}
                            className="flex items-center justify-center gap-2 p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"
                          >
                            <AlertCircle size={16} />
                            Nieobecność
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-slate-100">
              {modalMode === 'edit' ? (
                <>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleEditSession}
                    className="flex-1 py-3 px-4 bg-myway-primary text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20"
                  >
                    Zapisz zmiany
                  </button>
                </>
              ) : (
                <>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteSession(selectedSession.id)}
                      className="flex-1 py-3 px-4 bg-rose-50 text-rose-600 rounded-xl font-medium hover:bg-rose-100 transition-colors"
                    >
                      Usuń
                    </button>
                  )}
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                  >
                    Zamknij
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtext: string;
  color: 'teal' | 'blue' | 'violet' | 'emerald';
}) {
  const colorClasses = {
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  const iconClasses = {
    teal: 'bg-teal-100 text-teal-600',
    blue: 'bg-blue-100 text-blue-600',
    violet: 'bg-violet-100 text-violet-600',
    emerald: 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className={`rounded-2xl border p-6 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconClasses[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-800 mb-1">{value}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="text-xs text-slate-500 mt-1">{subtext}</p>
    </div>
  );
}
