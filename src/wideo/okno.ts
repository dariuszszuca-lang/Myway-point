// Okno wejścia do rozmowy wideo. Te same liczby co na serwerze (rezerwacje-api/src/zasady.mjs).
// Serwer i tak sprawdza okno sam: tu chodzi tylko o to, kiedy pokazać przycisk.
export const WIDEO_MIN_PRZED = 10;
export const WIDEO_MIN_PO = 30;

export type OknoWideo = 'otwarte' | 'za-wczesnie' | 'po-czasie';

// Chwila (ms od epoki) dla daty i godziny zapisanych w czasie polskim, także przy zmianie czasu.
export function chwilaWPolsce(data: string, godzina: string): number {
  const [r, m, d] = data.split('-').map(Number);
  const [g, min] = godzina.split(':').map(Number);
  const jakUtc = Date.UTC(r, m - 1, d, g, min);
  const przesuniecie = (t: number) => {
    const lokalnie = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(t));
    return Date.parse(`${lokalnie.replace(' ', 'T')}Z`) - t;
  };
  return jakUtc - przesuniecie(jakUtc - przesuniecie(jakUtc));
}

export function oknoWideo(sesja: { date: string; startTime: string; endTime: string }, terazMs: number = Date.now()): OknoWideo {
  const od = chwilaWPolsce(sesja.date, sesja.startTime) - WIDEO_MIN_PRZED * 60_000;
  const doKiedy = chwilaWPolsce(sesja.date, sesja.endTime) + WIDEO_MIN_PO * 60_000;
  if (terazMs < od) return 'za-wczesnie';
  if (terazMs > doKiedy) return 'po-czasie';
  return 'otwarte';
}

// Godzina (czas polski), od której można wejść, np. "15:50".
export function godzinaOtwarcia(sesja: { date: string; startTime: string }): string {
  const od = chwilaWPolsce(sesja.date, sesja.startTime) - WIDEO_MIN_PRZED * 60_000;
  return new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' }).format(new Date(od));
}
