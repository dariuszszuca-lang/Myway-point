// Wywołania API rezerwacji MyWay. Każde zapytanie niesie token zalogowanej osoby.
import { API_URL } from './config';
import { getIdToken } from './cognito';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = any>(metoda: 'GET' | 'POST' | 'PUT' | 'DELETE', sciezka: string, cialo?: unknown): Promise<T> {
  const token = await getIdToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${sciezka}`, {
      method: metoda,
      headers: {
        authorization: `Bearer ${token}`,
        ...(cialo !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: cialo !== undefined ? JSON.stringify(cialo) : undefined,
    });
  } catch {
    throw new ApiError(0, 'unavailable', 'Serwer jest chwilowo niedostępny. Spróbuj ponownie za chwilę.');
  }
  const dane = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, String(dane.blad || 'blad'), String(dane.wiadomosc || dane.message || 'Nie udało się wykonać operacji.'));
  }
  return dane as T;
}

// Tylko pola o określonych nazwach i z wartością (ekran dokleja czasem pola pomocnicze).
export function wybierz<T extends object>(dane: T, pola: string[]): Partial<T> {
  const w: Record<string, unknown> = {};
  for (const p of pola) {
    const v = (dane as Record<string, unknown>)[p];
    if (v !== undefined) w[p] = v;
  }
  return w as Partial<T>;
}
