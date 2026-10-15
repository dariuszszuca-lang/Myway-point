import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video } from 'lucide-react';
import { api } from '../aws/api';
import { Session } from '../types';
import { useAuth } from '../context/AuthContext';
import { oknoWideo, godzinaOtwarcia } from './okno';

// Serwer mówi raz na wejście do aplikacji, czy rozmowy wideo są włączone dla tego ośrodka i tej roli.
let stanWideo: Promise<boolean> | null = null;
function wideoWlaczone(): Promise<boolean> {
  stanWideo ??= api<{ wlaczone: boolean }>('GET', '/wideo/stan')
    .then((stan) => Boolean(stan.wlaczone))
    .catch(() => { stanWideo = null; return false; });
  return stanWideo;
}

// Przycisk rozmowy wideo w szczegółach wizyty. Widoczny od razu: przed oknem prowadzi do poczekalni,
// gdzie można sprawdzić kamerę i tło; wejście do rozmowy włącza się samo o godzinie otwarcia.
export function PrzyciskWideo({ sesja }: { sesja: Session }) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [wlaczone, setWlaczone] = useState(false);
  useEffect(() => {
    if (role !== 'patient' && role !== 'therapist') return;
    let aktualne = true;
    wideoWlaczone().then((w) => { if (aktualne) setWlaczone(w); });
    return () => { aktualne = false; };
  }, [role]);

  if (!wlaczone || sesja.status !== 'scheduled') return null;
  const okno = oknoWideo(sesja);
  if (okno === 'po-czasie') return null;
  return (
    <div className="space-y-2">
      <button
        onClick={() => navigate(`/wideo/${sesja.id}`, { state: { session: sesja } })}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-myway-primary text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20"
      >
        <Video size={18} />
        {okno === 'otwarte' ? 'Dołącz do wideo' : 'Rozmowa wideo'}
      </button>
      {okno === 'za-wczesnie' && (
        <p className="text-sm text-center text-teal-800">
          Rozmowa otworzy się w dniu wizyty o {godzinaOtwarcia(sesja)}. Wcześniej możesz sprawdzić kamerę i wybrać tło.
        </p>
      )}
    </div>
  );
}
