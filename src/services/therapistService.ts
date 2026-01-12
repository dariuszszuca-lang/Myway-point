import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Therapist, DEFAULT_THERAPISTS } from '../types';
import { initializeDefaultAvailability, deleteAvailabilityByTherapist, getAvailabilityByTherapist } from './availabilityService';

const therapistsCollectionRef = collection(db, 'therapists');

export const getTherapists = async (): Promise<Therapist[]> => {
  const q = query(therapistsCollectionRef, orderBy('name', 'asc'));
  const data = await getDocs(q);
  const therapists = data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Therapist[];

  // If no therapists exist, initialize with defaults
  if (therapists.length === 0) {
    await initializeDefaultTherapists();
    return getTherapists();
  }

  return therapists;
};

export const initializeDefaultTherapists = async (): Promise<void> => {
  for (const therapist of DEFAULT_THERAPISTS) {
    const docRef = await addDoc(therapistsCollectionRef, therapist);
    // Initialize default availability for this therapist
    await initializeDefaultAvailability(docRef.id, therapist.name);
  }
};

// Reset and reinitialize therapists with defaults
export const resetTherapistsToDefault = async (): Promise<void> => {
  // Delete all existing therapists
  const existingTherapists = await getDocs(therapistsCollectionRef);
  for (const doc of existingTherapists.docs) {
    await deleteDoc(doc.ref);
  }
  // Add default therapists
  await initializeDefaultTherapists();
};

// Ensure correct therapists exist (call on app init)
export const ensureTherapistsExist = async (): Promise<void> => {
  const data = await getDocs(therapistsCollectionRef);
  const therapists = data.docs.map(doc => doc.data());

  // Check if we have the correct 3 therapists
  const expectedNames = ['Krystian Nagaba', 'Natalia Pucz', 'Waldemar Sikorski'];
  const currentNames = therapists.map(t => t.name);

  const hasAllTherapists = expectedNames.every(name => currentNames.includes(name));

  if (!hasAllTherapists || therapists.length === 0) {
    await resetTherapistsToDefault();
  }
};

export const addTherapist = async (therapistData: Omit<Therapist, 'id'>): Promise<Therapist> => {
  const docRef = await addDoc(therapistsCollectionRef, therapistData);
  return { ...therapistData, id: docRef.id };
};

export const updateTherapist = async (id: string, therapistData: Partial<Therapist>): Promise<void> => {
  const therapistDoc = doc(db, 'therapists', id);
  await updateDoc(therapistDoc, therapistData);
};

export const deleteTherapist = async (id: string): Promise<void> => {
  // Delete therapist's availability first
  await deleteAvailabilityByTherapist(id);
  const therapistDoc = doc(db, 'therapists', id);
  await deleteDoc(therapistDoc);
};

// Therapist colors for calendar
export const THERAPIST_COLORS = [
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
];

export const getTherapistColor = (index: number) => {
  return THERAPIST_COLORS[index % THERAPIST_COLORS.length];
};

// Initialize availability for existing therapists (one-time setup)
export const initializeAvailabilityForExistingTherapists = async (): Promise<void> => {
  const therapists = await getTherapists();
  for (const therapist of therapists) {
    const existingAvailability = await getAvailabilityByTherapist(therapist.id);
    if (existingAvailability.length === 0) {
      await initializeDefaultAvailability(therapist.id, therapist.name);
    }
  }
};

// Re-export availability functions for convenience
export { getAvailabilityByTherapist } from './availabilityService';
