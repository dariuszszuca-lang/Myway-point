import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Patient } from '../types';

export type UserRole = 'admin' | 'patient';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  patientId: string | null;
  createdAt: number;
}

// Admin emails - auto-assigned admin role on login
const ADMIN_EMAILS = [
  "dariusz.szuca@gmail.com",
  "krystiannagaba@gmail.com",
  "mywaymarcin@gmail.com"
];

/**
 * Check if email is an admin email
 */
export const isAdminEmail = (email: string): boolean => {
  return ADMIN_EMAILS.some(adminEmail =>
    adminEmail.toLowerCase() === email.toLowerCase()
  );
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
    return { id: doc.id, ...doc.data() } as Patient;
  }
  return null;
};

/**
 * Create or update user document on login
 * - Auto-assigns admin role for admin emails
 * - Links patient account if email matches a patient
 */
export const ensureUserExists = async (uid: string, email: string): Promise<AppUser> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    // User exists, return existing data
    return { uid, ...userSnap.data() } as AppUser;
  }

  // New user - determine role
  const role: UserRole = isAdminEmail(email) ? 'admin' : 'patient';

  // For patients, try to find matching patient record
  let patientId: string | null = null;
  if (role === 'patient') {
    const patient = await findPatientByEmail(email);
    if (patient) {
      patientId = patient.id;
    }
  }

  // Create user document
  const newUser: Omit<AppUser, 'uid'> = {
    email: email.toLowerCase(),
    role,
    patientId,
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
