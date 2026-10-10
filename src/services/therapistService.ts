import { api, wybierz } from '../aws/api';
import { Therapist } from '../types';

// Terapeuci idą przez API rezerwacji na AWS (zapis tylko administrator).
// Listą terapeutów zarządza administrator. Ekran nie dodaje już nikogo sam przy starcie (decyzja D6).

const POLA_TERAPEUTY = ['name', 'specialization', 'color', 'avatar', 'active'];

export const getTherapists = async (): Promise<Therapist[]> => {
  return (await api<{ terapeuci: Therapist[] }>('GET', '/terapeuci')).terapeuci;
};

// Zostają puste dla zgodności z ekranami, które je wołają przy starcie.
export const initializeDefaultTherapists = async (): Promise<void> => {};
export const ensureDefaultTherapistsExist = async (): Promise<void> => {};
export const ensureTherapistsExist = async (): Promise<void> => {};
export const initializeAvailabilityForExistingTherapists = async (): Promise<void> => {};

export const addTherapist = async (therapistData: Omit<Therapist, 'id'>): Promise<Therapist> => {
  return (await api<{ terapeuta: Therapist }>('POST', '/terapeuci', wybierz(therapistData, POLA_TERAPEUTY))).terapeuta;
};

export const updateTherapist = async (id: string, therapistData: Partial<Therapist>): Promise<void> => {
  await api('PUT', `/terapeuci/${id}`, wybierz(therapistData, POLA_TERAPEUTY));
};

// Serwer usuwa terapeutę razem z jego godzinami i zmianami na dzień.
export const deleteTherapist = async (id: string): Promise<void> => {
  await api('DELETE', `/terapeuci/${id}`);
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

// Re-export availability functions for convenience
export { getAvailabilityByTherapist } from './availabilityService';
