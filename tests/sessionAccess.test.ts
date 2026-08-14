import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTherapistSessions } from '../src/auth/sessionAccess.ts';
import type { Session } from '../src/types/index.ts';

const makeSession = (
  id: string,
  therapistId: string,
  date: string,
  status: Session['status'] = 'scheduled',
): Session => ({
  id,
  patientId: 'patient-1',
  patientName: 'Pacjent testowy',
  therapistId,
  therapistName: therapistId === 'therapist-current' ? 'Stanisław Babiński' : 'Waldemar Sikorski',
  date,
  startTime: id === 'own-later' ? '12:00' : '10:00',
  endTime: id === 'own-later' ? '12:35' : '10:35',
  status,
  createdAt: 1,
  updatedAt: 1,
});

test('returns only the selected therapist sessions in chronological order', () => {
  const sessions = [
    makeSession('own-later', 'therapist-current', '2026-08-20'),
    makeSession('foreign', 'therapist-foreign', '2026-08-18'),
    makeSession('own-earlier', 'therapist-current', '2026-08-18'),
  ];

  assert.deepEqual(
    selectTherapistSessions(sessions, 'therapist-current').map(session => session.id),
    ['own-earlier', 'own-later'],
  );
});

test('applies inclusive date bounds and excludes cancelled sessions by default', () => {
  const sessions = [
    makeSession('before', 'therapist-current', '2026-08-17'),
    makeSession('start', 'therapist-current', '2026-08-18'),
    makeSession('cancelled', 'therapist-current', '2026-08-19', 'cancelled'),
    makeSession('end', 'therapist-current', '2026-08-20'),
    makeSession('after', 'therapist-current', '2026-08-21'),
  ];

  assert.deepEqual(
    selectTherapistSessions(sessions, 'therapist-current', {
      startDate: '2026-08-18',
      endDate: '2026-08-20',
    }).map(session => session.id),
    ['start', 'end'],
  );
});

test('can retain cancelled sessions for the calendar history', () => {
  const sessions = [
    makeSession('cancelled', 'therapist-current', '2026-08-19', 'cancelled'),
  ];

  assert.deepEqual(
    selectTherapistSessions(sessions, 'therapist-current', { includeCancelled: true })
      .map(session => session.id),
    ['cancelled'],
  );
});
