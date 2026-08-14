import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

let testEnv;

const session = (therapistId, patientId) => ({
  patientId,
  patientName: 'Pacjent testowy',
  therapistId,
  therapistName: therapistId === 'therapist-current' ? 'Stanisław Babiński' : 'Waldemar Sikorski',
  date: '2026-08-20',
  startTime: '10:00',
  endTime: '10:35',
  status: 'scheduled',
  createdAt: 1,
  updatedAt: 1,
});

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-myway-point',
    firestore: {
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'therapists/therapist-current'), {
      name: 'Stanisław Babiński',
      specialization: 'Specjalista terapii uzależnień',
      color: '#0f766e',
      active: true,
    });
    await setDoc(doc(db, 'therapists/therapist-foreign'), {
      name: 'Waldemar Sikorski',
      specialization: 'Terapeuta uzależnień',
      color: '#ea580c',
      active: true,
    });
    await setDoc(doc(db, 'users/therapist-user'), {
      email: 'stanislaw.babinski@gmail.com',
      displayName: 'Stanisław Babiński',
      role: 'therapist',
      patientId: null,
      therapistId: 'therapist-current',
      createdAt: 1,
    });
    await setDoc(doc(db, 'users/migration-user'), {
      email: 'stanislaw.babinski@gmail.com',
      displayName: 'Stanisław Babiński',
      role: 'patient',
      patientId: null,
      createdAt: 1,
    });
    await setDoc(doc(db, 'users/other-user'), {
      email: 'other@example.com',
      displayName: 'Inny użytkownik',
      role: 'patient',
      patientId: null,
      createdAt: 1,
    });
    await setDoc(doc(db, 'sessions/own-session'), session('therapist-current', 'patient-1'));
    await setDoc(doc(db, 'sessions/foreign-session'), session('therapist-foreign', 'patient-2'));
    await setDoc(doc(db, 'patients/patient-1'), {
      name: 'Pacjent testowy',
      email: 'patient@example.com',
      totalSessions: 10,
      usedSessions: 1,
      sessionsHistory: [],
      createdAt: 1,
    });
  });
});

after(async () => {
  await testEnv.cleanup();
});

test('known therapist can migrate their own user document', async () => {
  const db = testEnv.authenticatedContext('migration-user', {
    email: 'stanislaw.babinski@gmail.com',
  }).firestore();

  await assertSucceeds(setDoc(doc(db, 'users/migration-user'), {
    role: 'therapist',
    therapistId: 'therapist-current',
  }, { merge: true }));
});

test('unknown account cannot promote itself to therapist', async () => {
  const db = testEnv.authenticatedContext('other-user', {
    email: 'other@example.com',
  }).firestore();

  await assertFails(setDoc(doc(db, 'users/other-user'), {
    role: 'therapist',
    therapistId: 'therapist-current',
  }, { merge: true }));
});

test('therapist query returns only own sessions', async () => {
  const db = testEnv.authenticatedContext('therapist-user', {
    email: 'stanislaw.babinski@gmail.com',
  }).firestore();
  const ownSessions = query(
    collection(db, 'sessions'),
    where('therapistId', '==', 'therapist-current'),
  );

  const snapshot = await assertSucceeds(getDocs(ownSessions));
  assert.equal(snapshot.size, 1);
  assert.equal(snapshot.docs[0].id, 'own-session');
  await assertFails(getDoc(doc(db, 'sessions/foreign-session')));
});

test('therapist cannot read patients or write sessions', async () => {
  const db = testEnv.authenticatedContext('therapist-user', {
    email: 'stanislaw.babinski@gmail.com',
  }).firestore();

  await assertFails(getDoc(doc(db, 'patients/patient-1')));
  await assertFails(updateDoc(doc(db, 'sessions/own-session'), {
    status: 'completed',
    updatedAt: 2,
  }));
});
