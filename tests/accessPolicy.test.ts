import test from 'node:test';
import assert from 'node:assert/strict';
import { canLoadTherapistSchedule, getRoleCapabilities } from '../src/auth/accessPolicy.ts';

test('therapist has read-only schedule access', () => {
  assert.deepEqual(getRoleCapabilities('therapist'), {
    canViewSchedule: true,
    canBookSessions: false,
    canManageSessions: false,
    canViewPatients: true,
    canManagePatients: false,
    canAccessAdminPages: false,
  });
});

test('patient can book but cannot manage sessions or admin pages', () => {
  assert.deepEqual(getRoleCapabilities('patient'), {
    canViewSchedule: true,
    canBookSessions: true,
    canManageSessions: false,
    canViewPatients: false,
    canManagePatients: false,
    canAccessAdminPages: false,
  });
});

test('admin retains all capabilities', () => {
  assert.deepEqual(getRoleCapabilities('admin'), {
    canViewSchedule: true,
    canBookSessions: true,
    canManageSessions: true,
    canViewPatients: true,
    canManagePatients: true,
    canAccessAdminPages: true,
  });
});

test('therapist schedule fails closed without a current therapist ID', () => {
  assert.equal(canLoadTherapistSchedule('therapist', null), false);
  assert.equal(canLoadTherapistSchedule('therapist', 'current-id'), true);
  assert.equal(canLoadTherapistSchedule('patient', 'current-id'), false);
});
