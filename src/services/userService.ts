import { api } from '../aws/api';
import { Patient } from '../types';
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

export interface Konto {
  appUser: AppUser;
  patientData: Patient | null;
}

/**
 * Konto zalogowanej osoby z serwera: rola, powiązanie z pacjentem albo terapeutą i rekord pacjenta.
 * Rolę i powiązania ustala serwer (tabela kont na AWS), ekran ich nie wylicza.
 * Pierwsze wejście zakłada konto; pacjent jest dopasowywany do rekordu po potwierdzonym adresie e-mail.
 */
export const loadAccount = async (): Promise<Konto> => {
  const r = await api<{ konto: AppUser; pacjent: Patient | null }>('GET', '/ja');
  return { appUser: r.konto, patientData: r.pacjent };
};
