import { db } from '../firebaseConfig';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  writeBatch,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { BookedSlot, Session, CreateSessionData, SessionStatus } from '../types';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const sessionsCollectionRef = collection(db, 'sessions');
const bookedSlotsCollectionRef = collection(db, 'booked_slots');

const buildBookedSlot = (
  sessionId: string,
  session: Pick<Session, 'therapistId' | 'date' | 'startTime' | 'endTime' | 'status' | 'updatedAt'>
): Omit<BookedSlot, 'id'> => ({
  sessionId,
  therapistId: session.therapistId,
  date: session.date,
  startTime: session.startTime,
  endTime: session.endTime,
  status: session.status,
  updatedAt: session.updatedAt,
});

const mapSessionDoc = (sessionDoc: { id: string; data: () => unknown }): Session => ({
  ...(sessionDoc.data() as Omit<Session, 'id'>),
  id: sessionDoc.id,
});

const mapBookedSlotDoc = (slotDoc: { id: string; data: () => unknown }): BookedSlot => ({
  ...(slotDoc.data() as Omit<BookedSlot, 'id'>),
  id: slotDoc.id,
});

// Get all sessions
export const getSessions = async (): Promise<Session[]> => {
  const q = query(sessionsCollectionRef, orderBy('date', 'asc'), orderBy('startTime', 'asc'));
  const data = await getDocs(q);
  return data.docs.map(mapSessionDoc);
};

// Get sessions for a specific date
export const getSessionsByDate = async (date: string): Promise<Session[]> => {
  const q = query(
    sessionsCollectionRef,
    where('date', '==', date),
    orderBy('startTime', 'asc')
  );
  const data = await getDocs(q);
  return data.docs.map(mapSessionDoc);
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
  return data.docs.map(mapSessionDoc);
};

// Get sessions for a specific therapist
export const getSessionsByTherapist = async (therapistId: string): Promise<Session[]> => {
  const q = query(
    sessionsCollectionRef,
    where('therapistId', '==', therapistId),
    orderBy('date', 'asc')
  );
  const data = await getDocs(q);
  return data.docs.map(mapSessionDoc);
};

export const getPatientSessionsByDateRange = async (
  patientId: string,
  startDate: string,
  endDate: string
): Promise<Session[]> => {
  const q = query(sessionsCollectionRef, where('patientId', '==', patientId));
  const data = await getDocs(q);
  return data.docs
    .map(mapSessionDoc)
    .filter(session => session.date >= startDate && session.date <= endDate)
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
};

export const getBookedSlotsByDate = async (date: string): Promise<BookedSlot[]> => {
  const q = query(bookedSlotsCollectionRef, where('date', '==', date));
  const data = await getDocs(q);
  return data.docs.map(mapBookedSlotDoc);
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

  const sessionRef = doc(sessionsCollectionRef);
  const slotRef = doc(db, 'booked_slots', sessionRef.id);
  const batch = writeBatch(db);

  batch.set(sessionRef, newSession);
  batch.set(slotRef, buildBookedSlot(sessionRef.id, newSession));
  await batch.commit();

  return { ...newSession, id: sessionRef.id };
};

// Update session
export const updateSession = async (id: string, updates: Partial<Session>): Promise<void> => {
  const sessionDoc = doc(db, 'sessions', id);
  const sessionSnap = await getDoc(sessionDoc);
  if (!sessionSnap.exists()) {
    throw new Error('Session not found');
  }

  const existingSession = { ...sessionSnap.data(), id } as Session;
  const now = Date.now();
  const updatedSession = {
    ...existingSession,
    ...updates,
    updatedAt: now,
  };

  const slotDoc = doc(db, 'booked_slots', id);
  const batch = writeBatch(db);

  batch.update(sessionDoc, {
    ...updates,
    updatedAt: now,
  });
  batch.set(slotDoc, buildBookedSlot(id, updatedSession), { merge: true });
  await batch.commit();
};

// Update session status
export const updateSessionStatus = async (id: string, status: SessionStatus): Promise<void> => {
  const sessionDoc = doc(db, 'sessions', id);
  const sessionSnap = await getDoc(sessionDoc);
  if (!sessionSnap.exists()) {
    throw new Error('Session not found');
  }

  const existingSession = { ...sessionSnap.data(), id } as Session;
  const updatedSession = {
    ...existingSession,
    status,
    updatedAt: Date.now(),
  };

  const slotDoc = doc(db, 'booked_slots', id);
  const batch = writeBatch(db);

  batch.update(sessionDoc, {
    status: updatedSession.status,
    updatedAt: updatedSession.updatedAt,
  });
  batch.set(slotDoc, buildBookedSlot(id, updatedSession), { merge: true });
  await batch.commit();
};

// Delete session
export const deleteSession = async (id: string): Promise<void> => {
  const sessionDoc = doc(db, 'sessions', id);
  const slotDoc = doc(db, 'booked_slots', id);
  const batch = writeBatch(db);

  batch.delete(sessionDoc);
  batch.delete(slotDoc);
  await batch.commit();
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
