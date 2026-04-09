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
  AlertCircle,
  Mail,
  Phone
} from 'lucide-react';
import { getSessionsByDateRange, createSession, updateSession, updateSessionStatus, deleteSession, getPatientSessionsInWeek, isTimeSlotAvailable } from '../services/sessionService';
import { getTherapists, getTherapistColor, ensureTherapistsExist, initializeAvailabilityForExistingTherapists } from '../services/therapistService';
import { getPatients, incrementUsedSessions, decrementUsedSessions } from '../services/patientService';
import { getAvailability, isTimeSlotAvailableWithOverrides } from '../services/availabilityService';
import { getOverrides, addOverride, updateOverride, deleteOverride } from '../services/overrideService';
import { Session, Therapist, Patient, Availability, AvailabilityOverride, WORKING_HOURS, CreateSessionData } from '../types';
import { useAuth } from '../context/AuthContext';

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

// Generate time slots dynamically based on slotDuration
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

// Helper to add minutes to time string
const addMinutesToTime = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
};

export function CalendarPage() {
  const { isAdmin, patientData, appUser } = useAuth();

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTherapist, setSelectedTherapist] = useState<string | 'all'>('all');

  // Override modal state
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideTherapistId, setOverrideTherapistId] = useState('');
  const [overrideType, setOverrideType] = useState<'unavailable' | 'custom'>('unavailable');
  const [overrideStartTime, setOverrideStartTime] = useState('09:00');
  const [overrideEndTime, setOverrideEndTime] = useState('17:00');
  const [overrideReason, setOverrideReason] = useState('');
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'view' | 'edit'>('create');
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
      // Admin-only: ensure default therapists and availability exist
      if (isAdmin) {
        await ensureTherapistsExist();
        await initializeAvailabilityForExistingTherapists();
      }

      // Load data - different queries for admin vs patient
      const [therapistsData, availabilityData] = await Promise.all([
        getTherapists(),
        getAvailability(),
      ]);

      // Overrides — osobno z try/catch żeby nie blokować reszty danych
      let overridesData: AvailabilityOverride[] = [];
      try {
        overridesData = await getOverrides();
      } catch (e) {
        console.warn('Nie udało się pobrać overrides (kolekcja może nie istnieć):', e);
      }

      // Sessions and patients - admin gets all, patient gets filtered
      let sessionsData: Session[] = [];
      let patientsData: Patient[] = [];

      if (isAdmin) {
        [sessionsData, patientsData] = await Promise.all([
          getSessionsByDateRange(weekStart, weekEnd),
          getPatients(),
        ]);
      } else if (patientData) {
        // Patient sees only their own sessions
        sessionsData = (await getSessionsByDateRange(weekStart, weekEnd))
          .filter(s => s.patientId === patientData.id);
        patientsData = [patientData]; // Only themselves
      }

      setSessions(sessionsData);
      setTherapists(therapistsData);
      setPatients(patientsData);
      setAvailability(availabilityData);
      setOverrides(overridesData);
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

  // Check if a therapist is available at a given time slot (with overrides)
  const isTherapistAvailable = (date: Date, time: string, therapistId: string): boolean => {
    const dayOfWeek = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');
    const endTime = addMinutesToTime(time, WORKING_HOURS.slotDuration);
    return isTimeSlotAvailableWithOverrides(availability, overrides, therapistId, dateStr, dayOfWeek, time, endTime);
  };

  // Check if any therapist is available at a given time slot
  const isAnyTherapistAvailable = (date: Date, time: string): boolean => {
    return therapists.some(t => isTherapistAvailable(date, time, t.id));
  };

  // Get available therapists for a specific slot
  const getAvailableTherapists = (date: Date, time: string): Therapist[] => {
    return therapists.filter(t => isTherapistAvailable(date, time, t.id));
  };

  // === OVERRIDE FUNCTIONS ===
  const openOverrideModal = (date: Date, therapistId: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = overrides.find(o => o.therapistId === therapistId && o.date === dateStr);

    setOverrideDate(dateStr);
    setOverrideTherapistId(therapistId);

    if (existing) {
      setOverrideType(existing.type);
      setOverrideStartTime(existing.startTime || '09:00');
      setOverrideEndTime(existing.endTime || '17:00');
      setOverrideReason(existing.reason || '');
      setEditingOverrideId(existing.id);
    } else {
      setOverrideType('unavailable');
      setOverrideStartTime('09:00');
      setOverrideEndTime('17:00');
      setOverrideReason('');
      setEditingOverrideId(null);
    }

    setIsOverrideModalOpen(true);
  };

  const saveOverride = async () => {
    const data: Record<string, any> = {
      therapistId: overrideTherapistId,
      date: overrideDate,
      type: overrideType as 'unavailable' | 'custom',
    };

    if (overrideType === 'custom') {
      data.startTime = overrideStartTime;
      data.endTime = overrideEndTime;
    }

    if (overrideReason) {
      data.reason = overrideReason;
    }

    try {
      if (editingOverrideId) {
        await updateOverride(editingOverrideId, data);
      } else {
        await addOverride(data as any);
      }

      setIsOverrideModalOpen(false);
      await loadData();
    } catch (error) {
      console.error('Błąd zapisu zmiany dostępności:', error);
      alert('Nie udało się zapisać zmiany. Spróbuj ponownie.');
    }
  };

  const removeOverride = async () => {
    if (editingOverrideId) {
      await deleteOverride(editingOverrideId);
      setIsOverrideModalOpen(false);
      await loadData();
    }
  };

  // Helper: check if a date has an override for a therapist
  const getOverrideForDay = (date: Date, therapistId: string): AvailabilityOverride | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return overrides.find(o => o.therapistId === therapistId && o.date === dateStr);
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

  const openEditSessionModal = (session: Session) => {
    setModalMode('edit');
    setSelectedSession(session);
    setNewSessionData({
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
    if (!selectedSession || !newSessionData.patientId || !newSessionData.therapistId || !newSessionData.date) {
      alert('Wypełnij wszystkie pola');
      return;
    }

    // Block past dates
    const editDate = parseISO(newSessionData.date);
    const todayEdit = new Date();
    todayEdit.setHours(0, 0, 0, 0);
    if (editDate.getTime() < todayEdit.getTime()) {
      alert('Nie można ustawić sesji na datę w przeszłości.');
      return;
    }

    // Check if therapist already has a session at this time (prevent double-booking)
    try {
      const slotAvailable = await isTimeSlotAvailable(
        newSessionData.therapistId!,
        newSessionData.date!,
        newSessionData.startTime!,
        newSessionData.endTime!,
        selectedSession.id
      );
      if (!slotAvailable) {
        alert('Ten terapeuta ma już zarezerwowaną sesję o tej godzinie. Wybierz inny termin.');
        return;
      }
    } catch (error) {
      console.error('Error checking time slot availability:', error);
    }

    try {
      await updateSession(selectedSession.id, {
        date: newSessionData.date,
        startTime: newSessionData.startTime,
        endTime: newSessionData.endTime,
        therapistId: newSessionData.therapistId,
        therapistName: newSessionData.therapistName,
        patientId: newSessionData.patientId,
        patientName: newSessionData.patientName,
        notes: newSessionData.notes,
      });
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error updating session:', error);
      alert('Błąd podczas aktualizacji sesji');
    }
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

    // Block past dates for everyone
    const sessionDate = parseISO(newSessionData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = sessionDate.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      alert('Nie można tworzyć sesji na daty w przeszłości.');
      return;
    }

    // Check minimum 3 days in advance (only for patients, admin can bypass)
    if (!isAdmin && diffDays < 3) {
      alert('Rezerwacja możliwa minimum 3 dni przed terminem. Wybierz późniejszy termin lub zadzwoń: 731 395 295.');
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

    // Check weekly limit: max 1 session per patient per week
    try {
      const weekCount = await getPatientSessionsInWeek(
        newSessionData.patientId,
        newSessionData.date
      );
      if (weekCount >= 1) {
        alert(isAdmin
          ? 'Ten pacjent ma już zarezerwowaną sesję w tym tygodniu. Limit: 1 sesja na tydzień.'
          : 'Masz już zarezerwowaną sesję w tym tygodniu. Możesz zarezerwować maksymalnie 1 sesję tygodniowo.'
        );
        return;
      }
    } catch (error) {
      console.error('Error checking weekly limit:', error);
    }

    // Check if therapist already has a session at this time (prevent double-booking)
    try {
      const slotAvailable = await isTimeSlotAvailable(
        newSessionData.therapistId!,
        newSessionData.date!,
        newSessionData.startTime!,
        newSessionData.endTime!
      );
      if (!slotAvailable) {
        alert('Ten terapeuta ma już zarezerwowaną sesję o tej godzinie. Wybierz inny termin.');
        return;
      }
    } catch (error) {
      console.error('Error checking time slot availability:', error);
    }

    try {
      await createSession(newSessionData as CreateSessionData);
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error creating session:', error);
      if (error?.code === 'permission-denied') {
        alert('Brak uprawnień do rezerwacji. Skontaktuj się z ośrodkiem MyWay pod numerem 731 395 295.');
      } else if (error?.code === 'unavailable') {
        alert('Serwer jest chwilowo niedostępny. Spróbuj ponownie za chwilę.');
      } else {
        alert('Nie udało się zapisać wizyty. Spróbuj ponownie lub zadzwoń: 731 395 295.');
      }
    }
  };

  const handleStatusChange = async (sessionId: string, newStatus: Session['status']) => {
    try {
      const previousStatus = selectedSession?.status;
      const patientId = selectedSession?.patientId;

      await updateSessionStatus(sessionId, newStatus);

      // Update usedSessions count - only admin can modify patient records
      if (isAdmin && patientId) {
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
      alert('Błąd podczas aktualizacji sesji');
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
                  {isAdmin && selectedTherapist !== 'all' && (
                    <button
                      onClick={() => openOverrideModal(day, selectedTherapist)}
                      className="text-[10px] text-slate-400 hover:text-teal-600 mt-1 transition"
                      title="Zmień dostępność tego dnia"
                    >
                      edytuj dzień
                    </button>
                  )}
                  {isAdmin && (
                    <div className="flex gap-1 justify-center mt-1">
                      {therapists.map(t => {
                        const override = getOverrideForDay(day, t.id);
                        return override ? (
                          <button
                            key={t.id}
                            onClick={() => openOverrideModal(day, t.id)}
                            title={`${t.name}: ${override.type === 'unavailable' ? 'Niedostępny' : 'Zmienione godziny'}${override.reason ? ` (${override.reason})` : ''}`}
                            className={`w-3 h-3 rounded-full border ${
                              override.type === 'unavailable'
                                ? 'bg-red-400 border-red-500'
                                : 'bg-blue-400 border-blue-500'
                            }`}
                          />
                        ) : null;
                      })}
                    </div>
                  )}
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

                  // Block past dates - no creating sessions in the past
                  const todayStart = new Date();
                  todayStart.setHours(0, 0, 0, 0);
                  const isPast = day.getTime() < todayStart.getTime();

                  // Check availability based on selected therapist
                  const isAvailable = !isPast && (selectedTherapist !== 'all'
                    ? isTherapistAvailable(day, time, selectedTherapist)
                    : isAnyTherapistAvailable(day, time));

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
                {modalMode === 'create' ? 'Zapisz pacjenta na wizytę' : modalMode === 'edit' ? 'Edytuj sesję' : 'Szczegóły sesji'}
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
              {(modalMode === 'create' || modalMode === 'edit') ? (
                <>
                  {/* Therapist info - if selected (only in create mode with therapist filter) */}
                  {modalMode === 'create' && selectedTherapist !== 'all' && newSessionData.therapistId && (
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

                  {/* Date & Time - editable in edit mode, display in create mode */}
                  {modalMode === 'edit' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
                        <input
                          type="date"
                          value={newSessionData.date || ''}
                          onChange={(e) => setNewSessionData(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-myway-primary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Godzina rozpoczęcia</label>
                        <select
                          value={newSessionData.startTime || ''}
                          onChange={(e) => {
                            const startTime = e.target.value;
                            setNewSessionData(prev => ({
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
                    </div>
                  ) : (
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
                  )}

                  {/* Therapist select - in edit mode always, in create mode only if "all" view */}
                  {(modalMode === 'edit' || (selectedTherapist === 'all' && newSessionData.date)) && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {modalMode === 'edit' ? 'Terapeuta' : 'Terapeuta (dostępni w tym terminie)'}
                      </label>
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
                        {modalMode === 'edit'
                          ? therapists.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))
                          : getAvailableTherapists(parseISO(newSessionData.date!), newSessionData.startTime || '09:00').map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))
                        }
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
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                              <User size={18} className="text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-700">
                                {appUser?.displayName || 'Nieznany użytkownik'}
                              </p>
                              <p className="text-xs text-amber-600">Konto nieaktywne</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-amber-700 bg-amber-100 p-2 rounded-lg">
                            <AlertCircle size={16} />
                            <p className="text-xs font-medium">
                              Skontaktuj się z ośrodkiem MyWay, aby aktywować dostęp do rezerwacji.
                            </p>
                          </div>
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
                    {/* Patient contact info */}
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

                  {/* Admin actions: Edit + Status */}
                  {isAdmin && (
                    <>
                      <div className="pt-4 border-t border-slate-100">
                        <button
                          onClick={() => openEditSessionModal(selectedSession)}
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
              ) : modalMode === 'edit' ? (
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
              ) : selectedSession && (
                <>
                  {isAdmin ? (
                    <button
                      onClick={() => handleDeleteSession(selectedSession.id)}
                      className="flex-1 py-3 px-4 bg-rose-50 text-rose-600 rounded-xl font-medium hover:bg-rose-100 transition-colors"
                    >
                      Usuń
                    </button>
                  ) : selectedSession.status === 'scheduled' && (
                    <button
                      onClick={() => {
                        if (confirm('Czy na pewno chcesz odwołać tę wizytę?')) {
                          handleStatusChange(selectedSession.id, 'cancelled');
                        }
                      }}
                      className="flex-1 py-3 px-4 bg-rose-50 text-rose-600 rounded-xl font-medium hover:bg-rose-100 transition-colors"
                    >
                      Odwołaj wizytę
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

      {/* OVERRIDE MODAL */}
      {isOverrideModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                Zmień dostępność — {overrideDate}
              </h3>
              <button onClick={() => setIsOverrideModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="text-sm text-gray-500 mb-4">
              {therapists.find(t => t.id === overrideTherapistId)?.name}
            </div>

            {/* Typ override */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Typ zmiany</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setOverrideType('unavailable')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition ${
                    overrideType === 'unavailable'
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Niedostępny
                </button>
                <button
                  onClick={() => setOverrideType('custom')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition ${
                    overrideType === 'custom'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Inne godziny
                </button>
              </div>
            </div>

            {/* Godziny (tylko dla custom) */}
            {overrideType === 'custom' && (
              <div className="mb-4 flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Od</label>
                  <input
                    type="time"
                    value={overrideStartTime}
                    onChange={(e) => setOverrideStartTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Do</label>
                  <input
                    type="time"
                    value={overrideEndTime}
                    onChange={(e) => setOverrideEndTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Powód */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Powód (opcjonalnie)</label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="np. Urlop, Święto, Przesunięte godziny"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={saveOverride}
                className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition"
              >
                {editingOverrideId ? 'Zapisz zmiany' : 'Dodaj zmianę'}
              </button>
              {editingOverrideId && (
                <button
                  onClick={removeOverride}
                  className="px-4 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                >
                  Przywróć domyślne
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
