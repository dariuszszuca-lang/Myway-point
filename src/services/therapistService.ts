import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Therapist, DEFAULT_THERAPISTS } from '../types';

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
    await addDoc(therapistsCollectionRef, therapist);
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
