import { useState, useEffect, useMemo } from 'react';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  User,
  Calendar,
  Check,
  AlertCircle
} from 'lucide-react';
import { getSessionsByDateRange, createSession, updateSessionStatus, deleteSession } from '../services/sessionService';
import { getTherapists, getTherapistColor } from '../services/therapistService';
import { getPatients } from '../services/patientService';
import { Session, Therapist, Patient, WORKING_HOURS, CreateSessionData } from '../types';

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];
const FULL_DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

// Generate time slots
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = WORKING_HOURS.start; hour < WORKING_HOURS.end; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export function CalendarPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTherapist, setSelectedTherapist] = useState<string | 'all'>('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'view'>('create');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [newSessionData, setNewSessionData] = useState<Partial<CreateSessionData>>({});

  // Week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const weekStart = format(currentWeekStart, 'yyyy-MM-dd');
  const weekEnd = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

  useEffect(() => {
    loadData();
  }, [weekStart, weekEnd]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsData, therapistsData, patientsData] = await Promise.all([
        getSessionsByDateRange(weekStart, weekEnd),
        getTherapists(),
        getPatients(),
      ]);
      setSessions(sessionsData);
      setTherapists(therapistsData);
      setPatients(patientsData);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    }
    setLoading(false);
  };

  const prevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const nextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getSessionsForSlot = (date: Date, time: string, therapistId?: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return sessions.filter(s => {
      if (s.date !== dateStr) return false;
      if (s.startTime !== time) return false;
      if (s.status === 'cancelled') return false;
      if (therapistId && s.therapistId !== therapistId) return false;
      if (selectedTherapist !== 'all' && s.therapistId !== selectedTherapist) return false;
      return true;
    });
  };

  const openNewSessionModal = (date: Date, time: string, therapistId?: string) => {
    setModalMode('create');
    setSelectedSession(null);
    setNewSessionData({
      date: format(date, 'yyyy-MM-dd'),
      startTime: time,
      endTime: `${(parseInt(time.split(':')[0]) + 1).toString().padStart(2, '0')}:00`,
      therapistId: therapistId || therapists[0]?.id,
      therapistName: therapistId
        ? therapists.find(t => t.id === therapistId)?.name
        : therapists[0]?.name,
    });
    setIsModalOpen(true);
  };

  const openViewSessionModal = (session: Session) => {
    setModalMode('view');
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const handleCreateSession = async () => {
    if (!newSessionData.patientId || !newSessionData.therapistId || !newSessionData.date) {
      alert('Wypełnij wszystkie pola');
      return;
    }

    try {
      await createSession(newSessionData as CreateSessionData);
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Błąd podczas tworzenia sesji');
    }
  };

  const handleStatusChange = async (sessionId: string, status: Session['status']) => {
    try {
      await updateSessionStatus(sessionId, status);
      loadData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error updating session:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę sesję?')) return;
    try {
      await deleteSession(sessionId);
      loadData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const getTherapistIndex = (id: string) => therapists.findIndex(t => t.id === id);

  const filteredTherapists = selectedTherapist === 'all'
    ? therapists
    : therapists.filter(t => t.id === selectedTherapist);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kalendarz</h1>
          <p className="text-slate-500">
            {format(currentWeekStart, 'd MMMM', { locale: pl })} - {format(addDays(currentWeekStart, 6), 'd MMMM yyyy', { locale: pl })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Therapist filter */}
          <select
            value={selectedTherapist}
            onChange={(e) => setSelectedTherapist(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-myway-primary/20"
          >
            <option value="all">Wszyscy terapeuci</option>
            {therapists.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Navigation */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={prevWeek}
              className="p-2.5 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft size={20} className="text-slate-600" />
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors border-x border-slate-200"
            >
              Dziś
            </button>
            <button
              onClick={nextWeek}
              className="p-2.5 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight size={20} className="text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Therapist legend */}
      <div className="flex flex-wrap gap-3">
        {therapists.map((therapist, idx) => {
          const colors = getTherapistColor(idx);
          return (
            <div
              key={therapist.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
            >
              <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
              {therapist.name}
            </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="w-8 h-8 border-4 border-myway-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
          {/* Days header */}
          <div className="grid grid-cols-8 border-b border-slate-200">
            <div className="p-4 bg-slate-50 border-r border-slate-200">
              <Clock size={18} className="text-slate-400" />
            </div>
            {weekDays.map((day, idx) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={idx}
                  className={`p-4 text-center border-r border-slate-200 last:border-r-0 ${
                    isToday ? 'bg-myway-primary/5' : 'bg-slate-50'
                  }`}
                >
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{DAYS[idx]}</p>
                  <p className={`text-lg font-bold mt-1 ${isToday ? 'text-myway-primary' : 'text-slate-800'}`}>
                    {format(day, 'd')}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time slots */}
          <div className="max-h-[600px] overflow-y-auto">
            {TIME_SLOTS.map((time) => (
              <div key={time} className="grid grid-cols-8 border-b border-slate-100 last:border-b-0">
                {/* Time label */}
                <div className="p-3 border-r border-slate-100 text-sm font-medium text-slate-500 bg-slate-50/50">
                  {time}
                </div>

                {/* Day cells */}
                {weekDays.map((day, dayIdx) => {
                  const isToday = isSameDay(day, new Date());
                  const slotSessions = getSessionsForSlot(day, time);

                  return (
                    <div
                      key={dayIdx}
                      className={`p-1 border-r border-slate-100 last:border-r-0 min-h-[60px] relative group ${
                        isToday ? 'bg-myway-primary/5' : ''
                      }`}
                    >
                      {slotSessions.length > 0 ? (
                        <div className="space-y-1">
                          {slotSessions.map(session => {
                            const therapistIdx = getTherapistIndex(session.therapistId);
                            const colors = getTherapistColor(therapistIdx);
                            return (
                              <button
                                key={session.id}
                                onClick={() => openViewSessionModal(session)}
                                className={`w-full p-2 rounded-lg text-left text-xs ${colors.bg} ${colors.text} border ${colors.border} hover:shadow-sm transition-all`}
                              >
                                <p className="font-medium truncate">{session.patientName}</p>
                                <p className="text-[10px] opacity-70 truncate">{session.therapistName}</p>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <button
                          onClick={() => openNewSessionModal(day, time)}
                          className="absolute inset-1 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 bg-slate-100 hover:bg-slate-200 transition-all"
                        >
                          <Plus size={16} className="text-slate-400" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {modalMode === 'create' ? 'Nowa sesja' : 'Szczegóły sesji'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Modal content */}
            <div className="p-6 space-y-4">
              {modalMode === 'create' ? (
                <>
                  {/* Date & Time display */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <Calendar size={18} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">
                      {newSessionData.date && format(parseISO(newSessionData.date), 'EEEE, d MMMM yyyy', { locale: pl })}
                    </span>
                    <span className="text-sm text-slate-500">
                      {newSessionData.startTime} - {newSessionData.endTime}
                    </span>
                  </div>

                  {/* Therapist select */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Terapeuta</label>
                    <select
                      value={newSessionData.therapistId || ''}
                      onChange={(e) => {
                        const therapist = therapists.find(t => t.id === e.target.value);
                        setNewSessionData(prev => ({
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

                  {/* Patient select */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Pacjent</label>
                    <select
                      value={newSessionData.patientId || ''}
                      onChange={(e) => {
                        const patient = patients.find(p => p.id === e.target.value);
                        setNewSessionData(prev => ({
                          ...prev,
                          patientId: e.target.value,
                          patientName: patient?.name,
                        }));
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-myway-primary/20"
                    >
                      <option value="">Wybierz pacjenta...</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Notatki (opcjonalne)</label>
                    <textarea
                      value={newSessionData.notes || ''}
                      onChange={(e) => setNewSessionData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-myway-primary/20 resize-none"
                      placeholder="Dodatkowe informacje..."
                    />
                  </div>
                </>
              ) : selectedSession && (
                <>
                  {/* Session info */}
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
                  </div>

                  {/* Status actions */}
                  <div className="pt-4 border-t border-slate-100">
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
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 p-6 border-t border-slate-100">
              {modalMode === 'create' ? (
                <>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleCreateSession}
                    className="flex-1 py-3 px-4 bg-myway-primary text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
                  >
                    Utwórz sesję
                  </button>
                </>
              ) : selectedSession && (
                <>
                  <button
                    onClick={() => handleDeleteSession(selectedSession.id)}
                    className="flex-1 py-3 px-4 bg-rose-50 text-rose-600 rounded-xl font-medium hover:bg-rose-100 transition-colors"
                  >
                    Usuń
                  </button>
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
