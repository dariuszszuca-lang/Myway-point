import { api, wybierz } from '../aws/api';
import { Patient } from '../types';

// Baza pacjentów idzie przez API rezerwacji na AWS (administrator: pełny dostęp, terapeuta: odczyt).

const POLA_PACJENTA = ['name', 'phone', 'email', 'totalSessions', 'usedSessions', 'sessionsHistory', 'notes', 'createdAt', 'crmPatientId'];

export const getPatients = async (): Promise<Patient[]> => {
    return (await api<{ pacjenci: Patient[] }>('GET', '/pacjenci')).pacjenci;
};

export const addPatient = async (patientData: Omit<Patient, 'id'>) => {
    return (await api<{ pacjent: Patient }>('POST', '/pacjenci', wybierz(patientData, POLA_PACJENTA))).pacjent;
};

export const updatePatient = async (id: string, patientData: Partial<Patient>) => {
    return (await api<{ pacjent: Patient }>('PUT', `/pacjenci/${id}`, wybierz(patientData, POLA_PACJENTA))).pacjent;
};

export const deletePatient = async (id: string) => {
    await api('DELETE', `/pacjenci/${id}`);
};

// Licznik wykorzystanych sesji zmienia teraz serwer, w tej samej operacji co status wizyty
// (PUT /sesje/{id}/status). Te dwie funkcje zostają puste, żeby ekran nie policzył sesji drugi raz.
export const incrementUsedSessions = async (_patientId: string): Promise<void> => {};

export const decrementUsedSessions = async (_patientId: string): Promise<void> => {};
