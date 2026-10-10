import { api, wybierz } from '../aws/api';
import { AvailabilityOverride } from '../types';

// Zmiany dostępności na konkretny dzień idą przez API rezerwacji na AWS (zapis tylko administrator).

const POLA = ['therapistId', 'date', 'type', 'startTime', 'endTime', 'reason'];

// Pobierz wszystkie overrides
export const getOverrides = async (): Promise<AvailabilityOverride[]> => {
  return (await api<{ wyjatki: AvailabilityOverride[] }>('GET', '/wyjatki')).wyjatki;
};

// Pobierz overrides dla terapeuty
export const getOverridesByTherapist = async (therapistId: string): Promise<AvailabilityOverride[]> => {
  return (await getOverrides()).filter(o => o.therapistId === therapistId);
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
  return (await api<{ wyjatek: AvailabilityOverride }>('POST', '/wyjatki', wybierz(data, POLA))).wyjatek;
};

// Aktualizuj override
export const updateOverride = async (id: string, data: Partial<AvailabilityOverride>): Promise<void> => {
  const obecny = (await getOverrides()).find(o => o.id === id);
  if (!obecny) throw new Error('Override not found');
  await api('PUT', `/wyjatki/${id}`, wybierz({ ...obecny, ...data }, POLA));
};

// Usuń override (przywróć domyślną dostępność)
export const deleteOverride = async (id: string): Promise<void> => {
  await api('DELETE', `/wyjatki/${id}`);
};

// Usuń wszystkie overrides terapeuty
export const deleteOverridesByTherapist = async (therapistId: string): Promise<void> => {
  const lista = await getOverridesByTherapist(therapistId);
  await Promise.all(lista.map(o => deleteOverride(o.id)));
};
