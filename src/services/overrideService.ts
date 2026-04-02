import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { AvailabilityOverride } from '../types';

const overridesCollectionRef = collection(db, 'availability_overrides');

// Pobierz wszystkie overrides
export const getOverrides = async (): Promise<AvailabilityOverride[]> => {
  const data = await getDocs(overridesCollectionRef);
  return data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as AvailabilityOverride[];
};

// Pobierz overrides dla terapeuty
export const getOverridesByTherapist = async (therapistId: string): Promise<AvailabilityOverride[]> => {
  const q = query(overridesCollectionRef, where('therapistId', '==', therapistId));
  const data = await getDocs(q);
  return data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as AvailabilityOverride[];
};

// Pobierz override dla konkretnej daty i terapeuty
export const getOverrideForDate = (
  overrides: AvailabilityOverride[],
  therapistId: string,
  date: string
): AvailabilityOverride | undefined => {
  return overrides.find(o => o.therapistId === therapistId && o.date === date);
};

// Dodaj override
export const addOverride = async (data: Omit<AvailabilityOverride, 'id'>): Promise<AvailabilityOverride> => {
  const docRef = await addDoc(overridesCollectionRef, data);
  return { ...data, id: docRef.id };
};

// Aktualizuj override
export const updateOverride = async (id: string, data: Partial<AvailabilityOverride>): Promise<void> => {
  const overrideDoc = doc(db, 'availability_overrides', id);
  await updateDoc(overrideDoc, data);
};

// Usuń override (przywróć domyślną dostępność)
export const deleteOverride = async (id: string): Promise<void> => {
  const overrideDoc = doc(db, 'availability_overrides', id);
  await deleteDoc(overrideDoc);
};

// Usuń wszystkie overrides terapeuty
export const deleteOverridesByTherapist = async (therapistId: string): Promise<void> => {
  const q = query(overridesCollectionRef, where('therapistId', '==', therapistId));
  const data = await getDocs(q);
  const promises = data.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(promises);
};
