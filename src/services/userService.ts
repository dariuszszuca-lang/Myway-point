import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Patient } from '../types';
import {
  getTherapistNameForEmail,
  resolveStaffAccess,
  type StaffAccess,
} from '../auth/staffAccess';
import type { AppRole } from '../auth/accessPolicy';

export type UserRole = AppRole;

export interface AppUser {
  uid: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  patientId: string | null;
  therapistId: string | null;
  createdAt: number;
}

// Admin emails - auto-assigned admin role on login
const ADMIN_EMAILS = [
  "dariusz.szuca@gmail.com",
  "krystiannagaba@gmail.com",
  "mywaymarcin@gmail.com",
  "waldemarsikorski77@gmail.com",
  "b.mikolajczewski@wp.pl"
];

/**
 * Check if email is an admin email
 */
export const isAdminEmail = (email: string): boolean => {
  return ADMIN_EMAILS.some(adminEmail =>
    adminEmail.toLowerCase() === email.toLowerCase()
  );
};

const resolveStaffAccessForEmail = async (email: string): Promise<StaffAccess | null> => {
  if (isAdminEmail(email)) {
    return resolveStaffAccess(email, true, []);
  }

  const therapistName = getTherapistNameForEmail(email);
  if (!therapistName) return null;

  const therapistsRef = collection(db, 'therapists');
  const therapistQuery = query(therapistsRef, where('name', '==', therapistName));
  const snapshot = await getDocs(therapistQuery);
  const candidates = snapshot.docs.map(therapistDoc => ({
    id: therapistDoc.id,
    name: String(therapistDoc.data().name ?? ''),
    active: therapistDoc.data().active as boolean | undefined,
  }));

  return resolveStaffAccess(email, false, candidates);
};

/**
 * Get user document from Firestore
 */
export const getUser = async (uid: string): Promise<AppUser | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { uid, ...userSnap.data() } as AppUser;
  }
  return null;
};

/**
 * Find patient by email
 */
export const findPatientByEmail = async (email: string): Promise<Patient | null> => {
  const patientsRef = collection(db, 'patients');
  const q = query(patientsRef, where('email', '==', email.toLowerCase()));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    const d = doc.data();
    // Guard: brak pol pakietu (starsze konta) -> NaN w panelu pacjenta. Normalizujemy do liczby.
    return {
      ...d,
      id: doc.id,
      totalSessions: Number.isFinite(d.totalSessions) ? d.totalSessions : 0,
      usedSessions: Number.isFinite(d.usedSessions) ? d.usedSessions : 0,
    } as Patient;
  }
  return null;
};

/**
 * Create or update user document on login
 * - Auto-assigns admin role for admin emails
 * - Links therapist accounts to the current therapist record by name
 * - Links patient account if email matches a patient
 * - Stores displayName for session booking
 */
export const ensureUserExists = async (uid: string, email: string, displayName?: string | null): Promise<AppUser> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const normalizedEmail = email.toLowerCase();
  const staffAccess = await resolveStaffAccessForEmail(normalizedEmail);

  if (userSnap.exists()) {
    const existingUser = { uid, ...userSnap.data() } as AppUser;

    // Update displayName if it changed (e.g., user updated profile)
    if (displayName && displayName !== existingUser.displayName) {
      await setDoc(userRef, { displayName }, { merge: true });
      existingUser.displayName = displayName;
    }

    // Re-check staff identity on every login. Therapist IDs can change after a database reset.
    const identityUpdates: Partial<AppUser> = {};
    if (staffAccess) {
      if (existingUser.role !== staffAccess.role) {
        identityUpdates.role = staffAccess.role;
      }
      if (existingUser.therapistId !== staffAccess.therapistId) {
        identityUpdates.therapistId = staffAccess.therapistId;
      }
      if (existingUser.patientId !== null) {
        identityUpdates.patientId = null;
      }
    } else if (existingUser.role === 'therapist' && existingUser.therapistId) {
      // Fail closed if the therapist record is missing, inactive or ambiguous.
      identityUpdates.therapistId = null;
    }

    if (Object.keys(identityUpdates).length > 0) {
      await setDoc(userRef, identityUpdates, { merge: true });
      Object.assign(existingUser, identityUpdates);
    }

    // Re-check patient linking on every login (admin may have added patient record after registration)
    if (existingUser.role === 'patient' && !existingUser.patientId) {
      const patient = await findPatientByEmail(normalizedEmail);
      if (patient) {
        await setDoc(userRef, { patientId: patient.id }, { merge: true });
        existingUser.patientId = patient.id;
      }
    }

    return existingUser;
  }

  // New user - determine role
  const role: UserRole = staffAccess?.role ?? 'patient';

  // For patients, try to find matching patient record
  let patientId: string | null = null;
  if (role === 'patient') {
    const patient = await findPatientByEmail(normalizedEmail);
    if (patient) {
      patientId = patient.id;
    }
  }

  // Create user document
  const newUser: Omit<AppUser, 'uid'> = {
    email: normalizedEmail,
    displayName: displayName || null,
    role,
    patientId,
    therapistId: staffAccess?.therapistId ?? null,
    createdAt: Date.now()
  };

  await setDoc(userRef, newUser);

  return { uid, ...newUser };
};

/**
 * Get patient data for a user (if they are a patient with linked patientId)
 */
export const getPatientDataForUser = async (patientId: string | null): Promise<Patient | null> => {
  if (!patientId) return null;

  const patientRef = doc(db, 'patients', patientId);
  const patientSnap = await getDoc(patientRef);

  if (patientSnap.exists()) {
    return { id: patientSnap.id, ...patientSnap.data() } as Patient;
  }
  return null;
};

/**
 * Link user to patient record (used when patient is created after user signs up)
 */
export const linkUserToPatient = async (uid: string, patientId: string): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { patientId }, { merge: true });
};
