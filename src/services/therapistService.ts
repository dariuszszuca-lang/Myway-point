import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { Therapist, DEFAULT_THERAPISTS } from '../types';
import { initializeDefaultAvailability, deleteAvailabilityByTherapist, getAvailabilityByTherapist } from './availabilityService';

const therapistsCollectionRef = collection(db, 'therapists');
const overridesCollectionRef = collection(db, 'availability_overrides');

const BOGDAN_AVAILABILITY_OVERRIDES = [
  { date: '2026-05-11', startTime: '12:00', endTime: '14:00' },
  { date: '2026-05-11', startTime: '17:00', endTime: '20:00' },
  { date: '2026-05-12', startTime: '10:00', endTime: '15:00' },
  { date: '2026-05-13', startTime: '10:00', endTime: '13:00' },
  { date: '2026-05-13', startTime: '17:00', endTime: '20:00' },
  { date: '2026-05-14', startTime: '12:00', endTime: '16:00' },
  { date: '2026-05-15', startTime: '10:00', endTime: '15:00' },
  { date: '2026-05-26', startTime: '10:00', endTime: '15:00' },
  { date: '2026-05-27', startTime: '10:00', endTime: '15:00' },
  { date: '2026-05-27', startTime: '17:00', endTime: '20:00' },
  { date: '2026-05-28', startTime: '12:00', endTime: '16:00' },
  { date: '2026-05-29', startTime: '10:00', endTime: '15:00' },
  { date: '2026-05-29', startTime: '17:00', endTime: '20:00' },
];

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
    if (therapist.name.includes('Bogdan')) {
      await ensureBogdanAvailabilityOverrides(docRef.id);
    }
  }
};

export const ensureBogdanAvailabilityOverrides = async (therapistId: string): Promise<void> => {
  const existingOverridesSnap = await getDocs(
    query(overridesCollectionRef, where('therapistId', '==', therapistId))
  );
  const existingKeys = new Set(
    existingOverridesSnap.docs.map(doc => {
      const data = doc.data();
      return `${data.date}|${data.startTime}|${data.endTime}|${data.type}`;
    })
  );

  for (const slot of BOGDAN_AVAILABILITY_OVERRIDES) {
    const key = `${slot.date}|${slot.startTime}|${slot.endTime}|custom`;
    if (!existingKeys.has(key)) {
      await addDoc(overridesCollectionRef, {
        therapistId,
        date: slot.date,
        type: 'custom',
        startTime: slot.startTime,
        endTime: slot.endTime,
        reason: 'Dyspozycja Bogdana - maj 2026',
      });
      existingKeys.add(key);
    }
  }
};

export const ensureDefaultTherapistsExist = async (): Promise<void> => {
  const existingTherapists = await getDocs(therapistsCollectionRef);
  const existingByName = new Map(
    existingTherapists.docs.map(doc => [String(doc.data().name || '').trim().toLowerCase(), doc.id])
  );

  for (const therapist of DEFAULT_THERAPISTS) {
    const normalizedName = therapist.name.trim().toLowerCase();
    let therapistId = existingByName.get(normalizedName);

    if (!therapistId) {
      const docRef = await addDoc(therapistsCollectionRef, therapist);
      await initializeDefaultAvailability(docRef.id, therapist.name);
      therapistId = docRef.id;
      existingByName.set(normalizedName, therapistId);
    }

    if (therapist.name.includes('Bogdan')) {
      await ensureBogdanAvailabilityOverrides(therapistId);
    }
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

  // Init only when database is empty. Admin manages the list manually after that.
  if (therapists.length === 0) {
    await resetTherapistsToDefault();
    return;
  }

  await ensureDefaultTherapistsExist();
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

const UNKNOWN_THERAPIST_COLOR = {
  bg: 'bg-slate-100',
  text: 'text-slate-600',
  border: 'border-slate-200',
  dot: 'bg-slate-400',
};

export const getTherapistColor = (index: number) => {
  if (!Number.isFinite(index) || index < 0) {
    return UNKNOWN_THERAPIST_COLOR;
  }

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
