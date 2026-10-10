import { api, wybierz } from '../aws/api';
import { BookedSlot, Session, CreateSessionData, SessionStatus } from '../types';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

// Dane wizyt i zajętych terminów idą przez API rezerwacji na AWS.
// Zasady rezerwacji (3 dni, limit sesji, 1 wizyta w tygodniu, zajęty termin) sprawdza także serwer.

const POLA_WIZYTY = ['patientId', 'patientName', 'patientEmail', 'patientPhone', 'therapistId', 'therapistName', 'date', 'startTime', 'endTime', 'notes'];

const zakres = (od?: string, doDnia?: string) => {
  const q = new URLSearchParams();
  if (od) q.set('od', od);
  if (doDnia) q.set('do', doDnia);
  const tekst = q.toString();
  return tekst ? `?${tekst}` : '';
};

// Get all sessions
export const getSessions = async (): Promise<Session[]> => {
  return (await api<{ sesje: Session[] }>('GET', '/sesje')).sesje;
};

// Get sessions for a specific date
export const getSessionsByDate = async (date: string): Promise<Session[]> => {
  return (await api<{ sesje: Session[] }>('GET', `/sesje${zakres(date, date)}`)).sesje;
};

// Get sessions for a date range
export const getSessionsByDateRange = async (startDate: string, endDate: string): Promise<Session[]> => {
  return (await api<{ sesje: Session[] }>('GET', `/sesje${zakres(startDate, endDate)}`)).sesje;
};

// Get sessions for a specific therapist
// (terapeuta dostaje z serwera wyłącznie swoje wizyty; administrator może wskazać terapeutę)
export const getSessionsByTherapist = async (therapistId: string): Promise<Session[]> => {
  const sesje = (await api<{ sesje: Session[] }>('GET', `/sesje?terapeuta=${encodeURIComponent(therapistId)}`)).sesje;
  return sesje.filter(session => session.therapistId === therapistId);
};

export const getPatientSessionsByDateRange = async (
  patientId: string,
  startDate: string,
  endDate: string
): Promise<Session[]> => {
  const sesje = await getSessionsByDateRange(startDate, endDate);
  return sesje.filter(session => session.patientId === patientId);
};

export const getBookedSlotsByDate = async (date: string): Promise<BookedSlot[]> => {
  return (await api<{ terminy: BookedSlot[] }>('GET', `/terminy?data=${date}`)).terminy;
};

// Get today's sessions
export const getTodaySessions = async (): Promise<Session[]> => {
  const today = format(new Date(), 'yyyy-MM-dd');
  return getSessionsByDate(today);
};

// Get this week's sessions
export const getWeekSessions = async (): Promise<Session[]> => {
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return getSessionsByDateRange(weekStart, weekEnd);
};

// Get this month's sessions
export const getMonthSessions = async (): Promise<Session[]> => {
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
  return getSessionsByDateRange(monthStart, monthEnd);
};

// Create a new session
export const createSession = async (sessionData: CreateSessionData): Promise<Session> => {
  return (await api<{ sesja: Session }>('POST', '/sesje', wybierz(sessionData, POLA_WIZYTY))).sesja;
};

// Update session
export const updateSession = async (id: string, updates: Partial<Session>): Promise<void> => {
  await api('PUT', `/sesje/${id}`, wybierz(updates, POLA_WIZYTY));
};

// Update session status
export const updateSessionStatus = async (id: string, status: SessionStatus): Promise<void> => {
  await api('PUT', `/sesje/${id}/status`, { status });
};

// Delete session
export const deleteSession = async (id: string): Promise<void> => {
  await api('DELETE', `/sesje/${id}`);
};

// Cancel session
export const cancelSession = async (id: string): Promise<void> => {
  await updateSessionStatus(id, 'cancelled');
};

// Check if time slot is available
export const isTimeSlotAvailable = async (
  therapistId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeSessionId?: string
): Promise<boolean> => {
  const slots = await getBookedSlotsByDate(date);

  const conflicting = slots.filter(slot => {
    // Skip the session being edited
    if (excludeSessionId && slot.sessionId === excludeSessionId) return false;

    // Skip cancelled sessions
    if (slot.status === 'cancelled') return false;

    // Check if same therapist
    if (slot.therapistId !== therapistId) return false;

    // Check time overlap
    const sessionStart = slot.startTime;
    const sessionEnd = slot.endTime;

    return (
      (startTime >= sessionStart && startTime < sessionEnd) ||
      (endTime > sessionStart && endTime <= sessionEnd) ||
      (startTime <= sessionStart && endTime >= sessionEnd)
    );
  });

  return conflicting.length === 0;
};

// Check if patient already has a session this week (limit: 1/week)
export const getPatientSessionsInWeek = async (patientId: string, date: string): Promise<number> => {
  const targetDate = parseISO(date);
  const weekStartDate = startOfWeek(targetDate, { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(targetDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStartDate, 'yyyy-MM-dd');
  const weekEndStr = format(weekEndDate, 'yyyy-MM-dd');

  const sessions = await getPatientSessionsByDateRange(patientId, weekStartStr, weekEndStr);
  return sessions.filter(s => s.status !== 'cancelled').length;
};

// Get dashboard stats
export const getDashboardStats = async () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todaySessions = await getSessionsByDate(today);
  const weekSessions = await getWeekSessions();
  const monthSessions = await getMonthSessions();

  return {
    todaySessions: todaySessions.filter(s => s.status !== 'cancelled').length,
    todayCompleted: todaySessions.filter(s => s.status === 'completed').length,
    weekSessions: weekSessions.filter(s => s.status !== 'cancelled').length,
    monthCompleted: monthSessions.filter(s => s.status === 'completed').length,
  };
};
