import type { Session } from '../types';

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
