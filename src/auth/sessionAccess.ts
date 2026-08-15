import type { Patient, Session } from '../types';

export interface SessionRange {
  startDate?: string;
  endDate?: string;
  includeCancelled?: boolean;
}

export const selectTherapistSessions = (
  sessions: Session[],
  therapistId: string,
  range: SessionRange = {},
): Session[] => sessions
  .filter(session => session.therapistId === therapistId)
  .filter(session => range.includeCancelled || session.status !== 'cancelled')
  .filter(session => !range.startDate || session.date >= range.startDate)
  .filter(session => !range.endDate || session.date <= range.endDate)
  .sort((left, right) =>
    (left.date + ' ' + left.startTime).localeCompare(right.date + ' ' + right.startTime)
  );

export interface SessionContact {
  email?: string;
  phone?: string;
}

const normalizedContactValue = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

export const getSessionContact = (
  session: Pick<Session, 'patientEmail' | 'patientPhone'>,
  patient?: Pick<Patient, 'email' | 'phone'>,
): SessionContact | null => {
  const email = normalizedContactValue(patient?.email) ?? normalizedContactValue(session.patientEmail);
  const phone = normalizedContactValue(patient?.phone) ?? normalizedContactValue(session.patientPhone);

  return email || phone ? { email, phone } : null;
};
