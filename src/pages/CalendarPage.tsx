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
import { getTherapists, getTherapistColor, ensureTherapistsExist, initializeAvailabilityForExistingTherapists } from '../services/therapistService';
import { getPatients, incrementUsedSessions, decrementUsedSessions } from '../services/patientService';
import { getAvailability, isTimeSlotAvailable } from '../services/availabilityService';
import { Session, Therapist, Patient, Availability, WORKING_HOURS, CreateSessionData } from '../types';
import { useAuth } from '../context/AuthContext';

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

// Generate time slots (every 30 minutes)
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = WORKING_HOURS.start; hour < WORKING_HOURS.end; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// Helper to add minutes to time string
const addMinutesToTime = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
};

export function CalendarPage() {
  const { isAdmin, patientData } = useAuth();

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
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
      // Ensure default therapists exist
      await ensureTherapistsExist();
      // Ensure availability exists for all therapists
      await initializeAvailabilityForExistingTherapists();

      const [sessionsData, therapistsData, patientsData, availabilityData] = await Promise.all([
        getSessionsByDateRange(weekStart, weekEnd),
        getTherapists(),
        getPatients(),
        getAvailability(),
      ]);
      setSessions(sessionsData);
      setTherapists(therapistsData);
      setPatients(patientsData);
      setAvailability(availabilityData);
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

  // Check if a therapist is available at a given time slot
  // dayOfWeek: 0 = Sunday, 1 = Monday, etc. (JS Date.getDay() format)
  const isTherapistAvailable = (date: Date, time: string, therapistId: string): boolean => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const therapistAvailability = availability.filter(a => a.therapistId === therapistId);
    const endTime = addMinutesToTime(time, WORKING_HOURS.slotDuration);
    return isTimeSlotAvailable(therapistAvailability, dayOfWeek, time, endTime);
  };

  // Check if any therapist is available at a given time slot
  const isAnyTherapistAvailable = (date: Date, time: string): boolean => {
    return therapists.some(t => isTherapistAvailable(date, time, t.id));
  };

  // Get available therapists for a specific slot
  const getAvailableTherapists = (date: Date, time: string): Therapist[] => {
    return therapists.filter(t => isTherapistAvailable(date, time, t.id));
  };

  const openNewSessionModal = (date: Date, time: string, therapistId?: string) => {
    setModalMode('create');
    setSelectedSession(null);

    // Get available therapists for this slot
    const availableTherapists = getAvailableTherapists(date, time);
    const defaultTherapist = therapistId
      ? therapists.find(t => t.id === therapistId)
      : availableTherapists[0];

    // For patients - auto-fill their data
    const sessionData: Partial<CreateSessionData> = {
      date: format(date, 'yyyy-MM-dd'),
      startTime: time,
      endTime: addMinutesToTime(time, WORKING_HOURS.slotDuration),
      therapistId: defaultTherapist?.id,
      therapistName: defaultTherapist?.name,
    };

    // If patient is logged in, auto-assign their data
    if (!isAdmin && patientData) {
      sessionData.patientId = patientData.id;
      sessionData.patientName = patientData.name;
    }

    setNewSessionData(sessionData);
    setIsModalOpen(true);
  };

  const openViewSessionModal = (session: Session) => {
    setModalMode('view');
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const handleCreateSession = async () => {
    // For patients without active account - block reservation
    if (!isAdmin && !patientData) {
      alert('Twoje konto nie jest jeszcze aktywowane. Skontaktuj się z ośrodkiem MyWay.');
      return;
    }

    if (!newSessionData.patientId || !newSessionData.therapistId || !newSessionData.date) {
      alert('Wypełnij wszystkie pola');
      return;
    }

    // Check if patient has remaining sessions
    const checkPatient = isAdmin
      ? patients.find(p => p.id === newSessionData.patientId)
      : patientData;

    if (checkPatient) {
      const remainingSessions = checkPatient.totalSessions - checkPatient.usedSessions;
      if (remainingSessions <= 0) {
        alert(isAdmin
          ? 'Ten pacjent wykorzystał już wszystkie dostępne sesje. Nie można utworzyć nowej rezerwacji.'
          : 'Wykorzystałeś wszystkie dostępne sesje. Skontaktuj się z ośrodkiem MyWay.'
        );
        return;
      }
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

  const handleStatusChange = async (sessionId: string, newStatus: Session['status']) => {
    try {
      const previousStatus = selectedSession?.status;
      const patientId = selectedSession?.patientId;

      await updateSessionStatus(sessionId, newStatus);

      // Update usedSessions count
      if (patientId) {
        // If changing TO completed (and wasn't completed before)
        if (newStatus === 'completed' && previousStatus !== 'completed') {
          await incrementUsedSessions(patientId);
        }
        // If changing FROM completed to something else
        else if (previousStatus === 'completed' && newStatus !== 'completed') {
          await decrementUsedSessions(patientId);
        }
      }

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

      {/* Therapist Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedTherapist('all')}
          className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
            selectedTherapist === 'all'
              ? 'bg-slate-800 text-white shadow-lg'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Wszyscy
        </button>
        {therapists.map((therapist, idx) => {
          const colors = getTherapistColor(idx);
          const isActive = selectedTherapist === therapist.id;
          return (
            <button
              key={therapist.id}
              onClick={() => setSelectedTherapist(therapist.id)}
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                isActive
                  ? `${colors.dot} text-white shadow-lg`
                  : `${colors.bg} ${colors.text} hover:shadow-md border ${colors.border}`
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-white' : colors.dot}`} />
              {therapist.name}
            </button>
          );
        })}
      </div>

      {/* Selected therapist info */}
      {selectedTherapist !== 'all' && (
        <div className="bg-gradient-to-r from-myway-primary to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl font-bold">
                {therapists.find(t => t.id === selectedTherapist)?.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{therapists.find(t => t.id === selectedTherapist)?.name}</h2>
                <p className="text-white/70">{therapists.find(t => t.id === selectedTherapist)?.specialization}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">
                {sessions.filter(s => s.therapistId === selectedTherapist && s.status !== 'cancelled').length}
              </p>
              <p className="text-sm text-white/70">sesji w tym tygodniu</p>
            </div>
          </div>
        </div>
      )}

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

                  // Check availability based on selected therapist
                  const isAvailable = selectedTherapist !== 'all'
                    ? isTherapistAvailable(day, time, selectedTherapist)
                    : isAnyTherapistAvailable(day, time);

                  return (
                    <div
                      key={dayIdx}
                      className={`p-1 border-r border-slate-100 last:border-r-0 min-h-[60px] relative group ${
                        isToday ? 'bg-myway-primary/5' : ''
                      } ${!isAvailable && slotSessions.length === 0 ? 'bg-slate-50/50' : ''}`}
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
                      ) : isAvailable ? (
                        <button
                          onClick={() => openNewSessionModal(day, time, selectedTherapist !== 'all' ? selectedTherapist : undefined)}
                          className={`absolute inset-1 flex items-center justify-center rounded-lg transition-all border-2 border-dashed ${
                            selectedTherapist !== 'all'
                              ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100 hover:border-emerald-400'
                              : 'border-transparent opacity-0 group-hover:opacity-100 group-hover:border-slate-200 bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className={`flex items-center gap-1 ${selectedTherapist !== 'all' ? 'text-emerald-600' : 'text-slate-400'}`}>
                            <Plus size={14} />
                            <span className="text-xs font-medium">
                              {selectedTherapist !== 'all' ? 'Wolne' : ''}
                            </span>
                          </div>
                        </button>
                      ) : (
                        <div className="absolute inset-1 flex items-center justify-center">
                          <span className="text-[10px] text-slate-300">—</span>
                        </div>
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
                {modalMode === 'create' ? 'Zapisz pacjenta na wizytę' : 'Szczegóły sesji'}
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
                  {/* Therapist info - if selected */}
                  {selectedTherapist !== 'all' && newSessionData.therapistId && (
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-myway-primary to-teal-600 rounded-xl text-white">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl font-bold">
                        {newSessionData.therapistName?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold">{newSessionData.therapistName}</p>
                        <p className="text-sm text-white/70">
                          {therapists.find(t => t.id === newSessionData.therapistId)?.specialization}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Date & Time display */}
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                    <Calendar size={20} className="text-myway-primary" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        {newSessionData.date && format(parseISO(newSessionData.date), 'EEEE, d MMMM yyyy', { locale: pl })}
                      </p>
                      <p className="text-sm text-slate-500">
                        Godzina: {newSessionData.startTime} - {newSessionData.endTime}
                      </p>
                    </div>
                  </div>

                  {/* Therapist select - only if "all" view */}
                  {selectedTherapist === 'all' && newSessionData.date && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Terapeuta (dostępni w tym terminie)</label>
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
                        {getAvailableTherapists(parseISO(newSessionData.date), newSessionData.startTime || '09:00').map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Patient select - different view for admin vs patient */}
                  {isAdmin ? (
                    // ADMIN: pokazuje dropdown z listą pacjentów
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Wybierz pacjenta</label>
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-myway-primary/20 text-base"
                      >
                        <option value="">-- Wybierz pacjenta --</option>
                        {patients.map(p => {
                          const remaining = p.totalSessions - p.usedSessions;
                          return (
                            <option key={p.id} value={p.id} disabled={remaining <= 0}>
                              {p.name} ({remaining} sesji pozostało){remaining <= 0 ? ' - BRAK SESJI' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {patients.length === 0 && (
                        <p className="text-xs text-amber-600 mt-2">
                          Brak pacjentów. Dodaj pacjenta w zakładce "Pacjenci".
                        </p>
                      )}
                      {/* Warning for selected patient with low sessions */}
                      {newSessionData.patientId && (() => {
                        const selectedPatient = patients.find(p => p.id === newSessionData.patientId);
                        if (selectedPatient) {
                          const remaining = selectedPatient.totalSessions - selectedPatient.usedSessions;
                          if (remaining === 0) {
                            return (
                              <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                                <AlertCircle size={16} className="text-rose-600" />
                                <p className="text-xs text-rose-700 font-medium">
                                  Ten pacjent wykorzystał wszystkie sesje. Rezerwacja niemożliwa.
                                </p>
                              </div>
                            );
                          } else if (remaining <= 3) {
                            return (
                              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                                <AlertCircle size={16} className="text-amber-600" />
                                <p className="text-xs text-amber-700">
                                  Uwaga: Pacjent ma tylko {remaining} {remaining === 1 ? 'sesję' : 'sesje'} pozostałe.
                                </p>
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    // PACJENT: pokazuje jego dane (bez możliwości zmiany)
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Rezerwacja dla</label>
                      {patientData ? (
                        <>
                          <div className="flex items-center gap-3 p-4 bg-teal-50 rounded-xl border border-teal-200">
                            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
                              <User size={18} className="text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-700">{patientData.name}</p>
                              <p className="text-sm text-teal-700">
                                Pozostało {patientData.totalSessions - patientData.usedSessions} z {patientData.totalSessions} sesji
                              </p>
                            </div>
                          </div>
                          {/* Warning if low/no sessions */}
                          {(() => {
                            const remaining = patientData.totalSessions - patientData.usedSessions;
                            if (remaining === 0) {
                              return (
                                <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                                  <AlertCircle size={16} className="text-rose-600" />
                                  <p className="text-xs text-rose-700 font-medium">
                                    Wykorzystałeś wszystkie sesje. Skontaktuj się z ośrodkiem.
                                  </p>
                                </div>
                              );
                            } else if (remaining <= 3) {
                              return (
                                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                                  <AlertCircle size={16} className="text-amber-600" />
                                  <p className="text-xs text-amber-700">
                                    Pozostało tylko {remaining} {remaining === 1 ? 'sesja' : 'sesje'}.
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </>
                      ) : (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                          <div className="flex items-center gap-2 text-amber-700">
                            <AlertCircle size={18} />
                            <p className="text-sm font-medium">Twoje konto nie jest jeszcze aktywowane</p>
                          </div>
                          <p className="text-xs text-amber-600 mt-2">
                            Skontaktuj się z ośrodkiem MyWay, aby aktywować dostęp do rezerwacji.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

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
                    className="flex-1 py-3 px-4 bg-myway-primary text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20"
                  >
                    Zapisz na wizytę
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
