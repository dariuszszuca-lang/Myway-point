import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTherapistNameForEmail,
  resolveTherapistIdForEmail,
} from '../src/auth/staffAccess.ts';

test('recognizes Stanisław therapist account case-insensitively', () => {
  assert.equal(
    getTherapistNameForEmail('STANISLAW.BABINSKI@GMAIL.COM'),
    'Stanisław Babiński',
  );
});

test('resolves the current active therapist ID by name instead of a hardcoded ID', () => {
  const therapists = [
    { id: 'old-id', name: 'Waldemar Sikorski', active: true },
    { id: 'current-id', name: 'Stanisław Babiński', active: true },
  ];

  assert.equal(
    resolveTherapistIdForEmail('stanislaw.babinski@gmail.com', therapists),
    'current-id',
  );
});

test('refuses an ambiguous or inactive therapist match', () => {
  const duplicate = [
    { id: 'first', name: 'Stanisław Babiński', active: true },
    { id: 'second', name: 'Stanisław Babiński', active: true },
  ];
  const inactive = [
    { id: 'inactive', name: 'Stanisław Babiński', active: false },
  ];

  assert.equal(resolveTherapistIdForEmail('stanislaw.babinski@gmail.com', duplicate), null);
  assert.equal(resolveTherapistIdForEmail('stanislaw.babinski@gmail.com', inactive), null);
});
