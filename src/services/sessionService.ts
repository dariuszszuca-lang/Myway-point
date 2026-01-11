import { db } from '../firebaseConfig';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { Session, CreateSessionData, SessionStatus } from '../types';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const sessionsCollectionRef = collection(db, 'sessions');

// Get all sessions
export const getSessions = async (): Promise<Session[]> => {
  const q = query(sessionsCollectionRef, orderBy('date', 'asc'), orderBy('startTime', 'asc'));
  const data = await getDocs(q);
  return data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Session[];
};

// Get sessions for a specific date
export const getSessionsByDate = async (date: string): Promise<Session[]> => {
  const q = query(
    sessionsCollectionRef,
    where('date', '==', date),
    orderBy('startTime', 'asc')
  );
  const data = await getDocs(q);
  return data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Session[];
};

// Get sessions for a date range
export const getSessionsByDateRange = async (startDate: string, endDate: string): Promise<Session[]> => {
  const q = query(
    sessionsCollectionRef,
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc'),
    orderBy('startTime', 'asc')
  );
  const data = await getDocs(q);
  return data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Session[];
};

// Get sessions for a specific therapist
export const getSessionsByTherapist = async (therapistId: string): Promise<Session[]> => {
  const q = query(
    sessionsCollectionRef,
    where('therapistId', '==', therapistId),
    orderBy('date', 'asc')
  );
  const data = await getDocs(q);
  return data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Session[];
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
  const now = Date.now();
  const newSession = {
    ...sessionData,
    status: 'scheduled' as SessionStatus,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(sessionsCollectionRef, newSession);
  return { ...newSession, id: docRef.id };
};

// Update session
export const updateSession = async (id: string, updates: Partial<Session>): Promise<void> => {
  const sessionDoc = doc(db, 'sessions', id);
  await updateDoc(sessionDoc, {
    ...updates,
    updatedAt: Date.now(),
  });
};

// Update session status
export const updateSessionStatus = async (id: string, status: SessionStatus): Promise<void> => {
  const sessionDoc = doc(db, 'sessions', id);
  await updateDoc(sessionDoc, {
    status,
    updatedAt: Date.now(),
  });
};

// Delete session
export const deleteSession = async (id: string): Promise<void> => {
  const sessionDoc = doc(db, 'sessions', id);
  await deleteDoc(sessionDoc);
};

// Cancel session
export const cancelSession = async (id: string): Promise<void> => {
  await updateSessionStatus(id, 'cancelled');
};

// Mark session as completed
export const completeSession = async (id: string): Promise<void> => {
  await updateSessionStatus(id, 'completed');
};

// Mark session as no-show
export const markNoShow = async (id: string): Promise<void> => {
  await updateSessionStatus(id, 'no-show');
};

// Check if time slot is available
export const isTimeSlotAvailable = async (
  therapistId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeSessionId?: string
): Promise<boolean> => {
  const sessions = await getSessionsByDate(date);

  const conflicting = sessions.filter(session => {
    // Skip the session being edited
    if (excludeSessionId && session.id === excludeSessionId) return false;

    // Skip cancelled sessions
    if (session.status === 'cancelled') return false;

    // Check if same therapist
    if (session.therapistId !== therapistId) return false;

    // Check time overlap
    const sessionStart = session.startTime;
    const sessionEnd = session.endTime;

    return (
      (startTime >= sessionStart && startTime < sessionEnd) ||
      (endTime > sessionStart && endTime <= sessionEnd) ||
      (startTime <= sessionStart && endTime >= sessionEnd)
    );
  });

  return conflicting.length === 0;
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
