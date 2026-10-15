import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  BackgroundBlurVideoFrameProcessor,
  BackgroundReplacementVideoFrameProcessor,
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
  MeetingSessionStatusCode,
  DefaultVideoTransformDevice,
} from 'amazon-chime-sdk-js';
import type { AudioVideoFacade, AudioVideoObserver, MeetingSessionStatus, VideoTileState } from 'amazon-chime-sdk-js';
import { ArrowLeft, Image as IkonaTla, Mic, MicOff, PhoneOff, Video, VideoOff, WifiOff, X } from 'lucide-react';
import { api, ApiError } from '../aws/api';
import { useAuth } from '../context/AuthContext';
import type { Session } from '../types';

// Ekran rozmowy wideo dla jednej wizyty: poczekalnia, rozmowa, zakończenie.
// Bez menu aplikacji, ciemne tło: w rozmowie ma być widać rozmówcę, nie program.

type Etap = 'poczekalnia' | 'laczenie' | 'rozmowa' | 'zerwane' | 'koniec';
type KlopotZeSprzetem = 'brak-zgody' | 'brak-urzadzen' | 'zajete' | 'inny' | null;

interface Informacja {
  wizyta: { id: string; date: string; startTime: string; endTime: string; status: string };
  rozmowca: string | null;
  okno: 'otwarte' | 'za-wczesnie' | 'po-czasie';
  otwarcie: number;
  rola: string;
}

interface Dolaczenie {
  pokoj: Record<string, unknown>;
  uczestnik: { AttendeeId: string } & Record<string, unknown>;
  rola: string;
}

const OPIS_KLOPOTU: Record<Exclude<KlopotZeSprzetem, null>, { tytul: string; rada: string }> = {
  'brak-zgody': {
    tytul: 'Przeglądarka nie ma zgody na kamerę i mikrofon',
    rada: 'Kliknij ikonę kłódki obok adresu strony. Zezwól na kamerę i mikrofon. Potem kliknij „Spróbuj ponownie”.',
  },
  'brak-urzadzen': {
    tytul: 'Nie widzę kamery ani mikrofonu',
    rada: 'Podłącz mikrofon albo słuchawki z mikrofonem. Potem kliknij „Spróbuj ponownie”.',
  },
  zajete: {
    tytul: 'Kamera albo mikrofon są zajęte',
    rada: 'Zamknij inne programy do rozmów wideo. Potem kliknij „Spróbuj ponownie”.',
  },
  inny: {
    tytul: 'Nie udało się włączyć kamery i mikrofonu',
    rada: 'Odśwież stronę. Jeśli to nie pomoże, otwórz ją w przeglądarce Chrome albo Safari.',
  },
};

function rozpoznajKlopot(e: unknown): Exclude<KlopotZeSprzetem, null> {
  const nazwa = (e as { name?: string })?.name;
  if (nazwa === 'NotAllowedError' || nazwa === 'SecurityError') return 'brak-zgody';
  if (nazwa === 'NotFoundError' || nazwa === 'OverconstrainedError') return 'brak-urzadzen';
  if (nazwa === 'NotReadableError' || nazwa === 'AbortError') return 'zajete';
  return 'inny';
}

// Tło za osobą w rozmowie. Obrazy krajobrazów: grafika AI w public/tla.
type Tlo = 'brak' | 'rozmycie' | 'jezioro' | 'morze' | 'gory' | 'las';
const TLA: { id: Tlo; nazwa: string; mini?: string }[] = [
  { id: 'brak', nazwa: 'Bez tła' },
  { id: 'rozmycie', nazwa: 'Rozmycie' },
  { id: 'jezioro', nazwa: 'Jezioro', mini: '/tla/jezioro-mini.jpg' },
  { id: 'morze', nazwa: 'Morze', mini: '/tla/morze-mini.jpg' },
  { id: 'gory', nazwa: 'Góry', mini: '/tla/gory-mini.jpg' },
  { id: 'las', nazwa: 'Las', mini: '/tla/las-mini.jpg' },
];

function zapamietaneTlo(): Tlo {
  try {
    const t = localStorage.getItem('wideo-tlo');
    return TLA.some((x) => x.id === t) ? (t as Tlo) : 'brak';
  } catch {
    return 'brak';
  }
}

function zatrzymaj(strumien: MediaStream | null) {
  strumien?.getTracks().forEach((t) => t.stop());
}

export function VideoPage() {
  const { idWizyty } = useParams();
  const navigate = useNavigate();
  const { isTherapist } = useAuth();
  const wizyta = (useLocation().state as { session?: Session } | null)?.session;
  // Po wejściu z linku w mailu nie ma danych z kalendarza: pytamy serwer, co to za wizyta.
  const [info, setInfo] = useState<Informacja | null>(null);
  const [odmowa, setOdmowa] = useState<string | null>(null);
  const [teraz, setTeraz] = useState(() => Date.now());
  useEffect(() => {
    let aktualne = true;
    api<Informacja>('GET', `/wideo/${idWizyty}`)
      .then((dane) => { if (aktualne) setInfo(dane); })
      .catch((e) => { if (aktualne) setOdmowa(e instanceof ApiError ? e.message : 'Nie udało się otworzyć rozmowy.'); });
    return () => { aktualne = false; };
  }, [idWizyty]);
  useEffect(() => {
    const zegar = window.setInterval(() => setTeraz(Date.now()), 15_000);
    return () => window.clearInterval(zegar);
  }, []);
  const rozmowca = info?.rozmowca ?? (wizyta ? (isTherapist ? wizyta.patientName : wizyta.therapistName) : null);
  const zaWczesnie = Boolean(info && info.okno === 'za-wczesnie' && teraz < info.otwarcie);
  const niedostepna = odmowa
    ?? (info && info.wizyta.status !== 'scheduled' ? 'Ta wizyta nie jest już zaplanowana, więc rozmowa wideo jest zamknięta.' : null)
    ?? (info && info.okno === 'po-czasie' ? 'Czas tej wizyty już minął.' : null);
  const kiedyOtwarcie = info
    ? new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(info.otwarcie))
    : '';
  const ktoDrugi = isTherapist ? 'pacjent' : 'terapeuta';

  const [etap, setEtap] = useState<Etap>('poczekalnia');
  const [mikrofon, setMikrofon] = useState(true);
  const [kamera, setKamera] = useState(true);
  const [maKamere, setMaKamere] = useState(true);
  const [klopot, setKlopot] = useState<KlopotZeSprzetem>(null);
  const [sprzetGotowy, setSprzetGotowy] = useState(false);
  const [poziom, setPoziom] = useState(0);
  const [blad, setBlad] = useState<string | null>(null);
  const [drugaOsoba, setDrugaOsoba] = useState(false);
  const [obrazDrugiej, setObrazDrugiej] = useState(false);
  const [slabeLacze, setSlabeLacze] = useState(false);
  const [wznawianie, setWznawianie] = useState(false);
  const [tlo, setTlo] = useState<Tlo>(zapamietaneTlo);
  const [tlaMozliwe, setTlaMozliwe] = useState(false);
  const [wyborTla, setWyborTla] = useState(false);
  const [tloLaduje, setTloLaduje] = useState(false);
  // Obraz rozmówcy w innym układzie niż ekran (poziomy na pionowym telefonie): pokazujemy cały, bez przycinania.
  const [calyObraz, setCalyObraz] = useState(false);

  const podgladRef = useRef<HTMLVideoElement>(null);
  const wlasnyRef = useRef<HTMLVideoElement>(null);
  const zdalnyRef = useRef<HTMLVideoElement>(null);
  const dzwiekRef = useRef<HTMLAudioElement>(null);
  const strumienRef = useRef<MediaStream | null>(null);
  const avRef = useRef<AudioVideoFacade | null>(null);
  const wychodzeRef = useRef(false);
  const dziennikRef = useRef(new ConsoleLogger('wideo', LogLevel.WARN));
  const urzadzenieRef = useRef<DefaultVideoTransformDevice | null>(null);
  const tloRef = useRef(tlo);
  tloRef.current = tlo;

  useEffect(() => {
    BackgroundBlurVideoFrameProcessor.isSupported().then(setTlaMozliwe).catch(() => setTlaMozliwe(false));
  }, []);

  const sprawdzDopasowanie = useCallback(() => {
    const v = zdalnyRef.current;
    const k = v?.parentElement;
    if (!v || !k || !v.videoWidth || !k.clientHeight) return;
    setCalyObraz((v.videoWidth >= v.videoHeight) !== (k.clientWidth >= k.clientHeight));
  }, []);
  useEffect(() => {
    window.addEventListener('resize', sprawdzDopasowanie);
    return () => window.removeEventListener('resize', sprawdzDopasowanie);
  }, [sprawdzDopasowanie]);

  // Kamera z wybranym tłem. Gdy tło nie zadziała na tym urządzeniu, idzie zwykły obraz.
  const uruchomKamere = useCallback(async (av: AudioVideoFacade, wybor: Tlo): Promise<boolean> => {
    const kamery = await av.listVideoInputDevices();
    if (!kamery.length) return false;
    const id = kamery[0].deviceId || 'default';
    const dziennik = dziennikRef.current;
    const stare = urzadzenieRef.current;
    urzadzenieRef.current = null;
    let wejscie: string | DefaultVideoTransformDevice = id;
    if (wybor !== 'brak') {
      try {
        const procesor = wybor === 'rozmycie'
          ? await BackgroundBlurVideoFrameProcessor.create(undefined, { logger: dziennik })
          : await BackgroundReplacementVideoFrameProcessor.create(undefined, {
            logger: dziennik,
            imageBlob: await (await fetch(`/tla/${wybor}.jpg`)).blob(),
          });
        if (procesor) {
          urzadzenieRef.current = new DefaultVideoTransformDevice(dziennik, id, [procesor]);
          wejscie = urzadzenieRef.current;
        }
      } catch { /* zostaje zwykła kamera */ }
    }
    await av.startVideoInput(wejscie);
    await stare?.stop();
    return true;
  }, []);

  const zatrzymajKamere = useCallback(async (av: AudioVideoFacade) => {
    await av.stopVideoInput();
    await urzadzenieRef.current?.stop();
    urzadzenieRef.current = null;
  }, []);

  // --- Poczekalnia: podgląd kamery i wskaźnik mikrofonu, jeszcze bez połączenia z pokojem ---
  const wlaczSprzet = useCallback(async () => {
    setKlopot(null);
    setSprzetGotowy(false);
    zatrzymaj(strumienRef.current);
    try {
      let strumien: MediaStream;
      try {
        strumien = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } });
        setMaKamere(true);
      } catch (e) {
        // Brak kamery nie zamyka drogi: rozmowa samym głosem też jest rozmową.
        if (rozpoznajKlopot(e) === 'brak-zgody') throw e;
        strumien = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMaKamere(false);
        setKamera(false);
      }
      strumienRef.current = strumien;
      if (podgladRef.current) podgladRef.current.srcObject = strumien;
      setSprzetGotowy(true);
    } catch (e) {
      setKlopot(rozpoznajKlopot(e));
    }
  }, []);

  useEffect(() => {
    if (etap !== 'poczekalnia' || niedostepna) return;
    wlaczSprzet();
    return () => {
      zatrzymaj(strumienRef.current);
      strumienRef.current = null;
    };
  }, [etap, wlaczSprzet, niedostepna]);

  // Wskaźnik głośności: pacjent widzi, że mikrofon go słyszy.
  useEffect(() => {
    if (etap !== 'poczekalnia' || !sprzetGotowy || !strumienRef.current) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const analizator = ctx.createAnalyser();
    analizator.fftSize = 256;
    ctx.createMediaStreamSource(strumienRef.current).connect(analizator);
    const probki = new Uint8Array(analizator.frequencyBinCount);
    const zegar = window.setInterval(() => {
      analizator.getByteTimeDomainData(probki);
      let szczyt = 0;
      for (const p of probki) szczyt = Math.max(szczyt, Math.abs(p - 128));
      setPoziom(Math.min(1, szczyt / 50));
    }, 120);
    return () => {
      window.clearInterval(zegar);
      ctx.close().catch(() => undefined);
    };
  }, [etap, sprzetGotowy]);

  // Przełączniki w poczekalni działają na podglądzie.
  useEffect(() => {
    strumienRef.current?.getAudioTracks().forEach((t) => { t.enabled = mikrofon; });
    strumienRef.current?.getVideoTracks().forEach((t) => { t.enabled = kamera; });
  }, [mikrofon, kamera, sprzetGotowy]);

  // --- Rozmowa ---
  const rozlacz = useCallback(async () => {
    const av = avRef.current;
    avRef.current = null;
    if (!av) return;
    try {
      av.stopLocalVideoTile();
      await zatrzymajKamere(av);
      await av.stopAudioInput();
    } catch { /* sprzęt mógł już zniknąć */ }
    av.stop();
  }, [zatrzymajKamere]);

  const dolacz = useCallback(async () => {
    setBlad(null);
    setEtap('laczenie');
    wychodzeRef.current = false;
    zatrzymaj(strumienRef.current);
    strumienRef.current = null;
    try {
      const dane = await api<Dolaczenie>('POST', `/wideo/${idWizyty}/dolacz`);
      const dziennik = dziennikRef.current;
      const sesja = new DefaultMeetingSession(
        new MeetingSessionConfiguration(dane.pokoj, dane.uczestnik),
        dziennik,
        new DefaultDeviceController(dziennik),
      );
      const av = sesja.audioVideo;
      avRef.current = av;
      const mojeId = dane.uczestnik.AttendeeId;

      const obserwator: AudioVideoObserver = {
        audioVideoDidStart: () => { setWznawianie(false); setEtap('rozmowa'); },
        audioVideoDidStartConnecting: (ponownie: boolean) => { if (ponownie) setWznawianie(true); },
        audioVideoDidStop: (status: MeetingSessionStatus) => {
          avRef.current = null;
          setDrugaOsoba(false);
          setObrazDrugiej(false);
          const kod = status.statusCode();
          const koniec = wychodzeRef.current || kod === MeetingSessionStatusCode.MeetingEnded || kod === MeetingSessionStatusCode.Left;
          setEtap(koniec ? 'koniec' : 'zerwane');
        },
        videoTileDidUpdate: (kafel: VideoTileState) => {
          if (!kafel.boundAttendeeId || kafel.tileId === null || kafel.isContent) return;
          if (kafel.localTile) {
            if (wlasnyRef.current) av.bindVideoElement(kafel.tileId, wlasnyRef.current);
          } else if (zdalnyRef.current) {
            av.bindVideoElement(kafel.tileId, zdalnyRef.current);
            setObrazDrugiej(true);
          }
        },
        videoTileWasRemoved: () => {
          // Przy dwóch osobach zniknąć może tylko kafel rozmówcy albo własny; stan własnego trzyma przełącznik.
          if (!av.getAllRemoteVideoTiles().length) setObrazDrugiej(false);
        },
        connectionDidBecomePoor: () => setSlabeLacze(true),
        connectionDidSuggestStopVideo: () => setSlabeLacze(true),
        connectionDidBecomeGood: () => setSlabeLacze(false),
      };
      av.addObserver(obserwator);
      av.realtimeSubscribeToAttendeeIdPresence((id: string, obecny: boolean) => {
        if (id === mojeId) return;
        setDrugaOsoba(obecny);
        if (!obecny) setObrazDrugiej(false);
      });

      const mikrofony = await av.listAudioInputDevices();
      if (!mikrofony.length) throw Object.assign(new Error('brak mikrofonu'), { name: 'NotFoundError' });
      await av.startAudioInput(mikrofony[0].deviceId || 'default');
      if (dzwiekRef.current) await av.bindAudioElement(dzwiekRef.current);
      av.start();
      if (!mikrofon) av.realtimeMuteLocalAudio();
      if (kamera) {
        if (await uruchomKamere(av, tloRef.current)) {
          av.startLocalVideoTile();
        } else {
          setMaKamere(false);
          setKamera(false);
        }
      }
    } catch (e) {
      await rozlacz();
      if (e instanceof ApiError) {
        setBlad(e.message);
      } else if ((e as { name?: string })?.name) {
        setKlopot(rozpoznajKlopot(e));
      } else {
        setBlad('Nie udało się połączyć. Spróbuj ponownie.');
      }
      setEtap('poczekalnia');
    }
  }, [idWizyty, mikrofon, kamera, rozlacz, uruchomKamere]);

  const przelaczMikrofon = () => {
    const av = avRef.current;
    if (av) {
      if (mikrofon) av.realtimeMuteLocalAudio(); else av.realtimeUnmuteLocalAudio();
    }
    setMikrofon(!mikrofon);
  };

  const przelaczKamere = async () => {
    const av = avRef.current;
    if (!av) { setKamera(!kamera); return; }
    try {
      if (kamera) {
        av.stopLocalVideoTile();
        await zatrzymajKamere(av);
        setKamera(false);
        setWyborTla(false);
      } else {
        if (!(await uruchomKamere(av, tlo))) { setMaKamere(false); return; }
        av.startLocalVideoTile();
        setKamera(true);
        setSlabeLacze(false);
      }
    } catch (e) {
      setKlopot(rozpoznajKlopot(e));
    }
  };

  const wybierzTlo = async (nowe: Tlo) => {
    setTlo(nowe);
    try { localStorage.setItem('wideo-tlo', nowe); } catch { /* wybór tylko na tę rozmowę */ }
    const av = avRef.current;
    if (!av || !kamera) return;
    setTloLaduje(true);
    try {
      await uruchomKamere(av, nowe);
    } catch (e) {
      setKlopot(rozpoznajKlopot(e));
    } finally {
      setTloLaduje(false);
    }
  };

  const zakoncz = async () => {
    wychodzeRef.current = true;
    await rozlacz();
    setEtap('koniec');
  };

  // Zamknięcie karty albo wyjście ze strony zwalnia kamerę i miejsce w pokoju.
  useEffect(() => () => {
    wychodzeRef.current = true;
    zatrzymaj(strumienRef.current);
    rozlacz();
  }, [rozlacz]);

  const doKalendarza = () => navigate('/calendar');
  const czasWizyty = info?.wizyta ?? wizyta;
  const godziny = czasWizyty ? `${czasWizyty.startTime} do ${czasWizyty.endTime}` : null;
  const wRozmowie = etap === 'rozmowa';

  return (
    <div className="gabinet min-h-[100dvh] flex flex-col text-[#eaf3f0] font-sans">
      <audio ref={dzwiekRef} className="hidden" />

      <header className={`${wRozmowie ? 'hidden sm:flex' : 'flex'} items-center justify-between gap-4 px-4 sm:px-8 pt-4 sm:pt-6`}>
        {wRozmowie ? <span className="w-10" /> : (
          <button
            onClick={doKalendarza}
            className="gabinet-fokus flex items-center gap-2 text-sm text-[#a9c9c2] hover:text-white rounded-lg px-2 py-1.5 -ml-2"
          >
            <ArrowLeft size={18} />
            Kalendarz
          </button>
        )}
        <div className="text-right min-w-0">
          <p className="text-sm font-medium truncate">{rozmowca ?? 'Konsultacja wideo'}</p>
          {godziny && <p className="text-xs text-[#a9c9c2]">Wizyta {godziny}</p>}
        </div>
      </header>

      {/* Poczekalnia */}
      {niedostepna && (etap === 'poczekalnia' || etap === 'laczenie') && (
        <main className="flex-1 flex items-center justify-center px-4 py-6">
          <div className="w-full max-w-sm text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Rozmowa jest niedostępna</h1>
            <p className="mt-2 text-sm text-[#a9c9c2]">{niedostepna}</p>
            <button onClick={doKalendarza} className="gabinet-fokus mt-6 w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 font-medium transition-colors">
              Przejdź do kalendarza
            </button>
          </div>
        </main>
      )}

      {!niedostepna && (etap === 'poczekalnia' || etap === 'laczenie') && (
        <main className="flex-1 flex items-center justify-center px-4 py-6">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-semibold tracking-tight">Sprawdź, czy Cię widać i słychać</h1>
            <p className="mt-2 text-sm text-[#a9c9c2]">
              Nikt Cię jeszcze nie widzi. Rozmowa zacznie się, gdy klikniesz „Wejdź do rozmowy”.
            </p>

            <div className="gabinet-rama mt-6 aspect-[4/3] relative overflow-hidden">
              <video
                ref={podgladRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${kamera && sprzetGotowy ? '' : 'invisible'}`}
              />
              {(!kamera || !sprzetGotowy) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#a9c9c2]">
                  <VideoOff size={28} />
                  <span className="text-sm">
                    {!sprzetGotowy && !klopot ? 'Włączam kamerę…' : maKamere ? 'Kamera wyłączona' : 'Brak kamery, rozmowa głosowa'}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <PrzyciskSprzetu wlaczony={mikrofon} onClick={przelaczMikrofon} etykieta={mikrofon ? 'Wycisz mikrofon' : 'Włącz mikrofon'}>
                {mikrofon ? <Mic size={20} /> : <MicOff size={20} />}
              </PrzyciskSprzetu>
              <PrzyciskSprzetu wlaczony={kamera} onClick={przelaczKamere} etykieta={kamera ? 'Wyłącz kamerę' : 'Włącz kamerę'} nieczynny={!maKamere}>
                {kamera ? <Video size={20} /> : <VideoOff size={20} />}
              </PrzyciskSprzetu>
              <div className="flex-1 min-w-0" aria-hidden="true">
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#7fd6c6] transition-[width] duration-100"
                    style={{ width: `${mikrofon && sprzetGotowy ? Math.round(poziom * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-[#a9c9c2]">
                  {mikrofon ? 'Powiedz coś. Pasek pokaże, że mikrofon Cię słyszy.' : 'Mikrofon jest wyciszony.'}
                </p>
              </div>
            </div>

            {klopot && (
              <div role="alert" className="mt-5 rounded-2xl bg-[#3a2a16] border border-[#7a5a2a] p-4">
                <p className="text-sm font-semibold text-[#ffd9a1]">{OPIS_KLOPOTU[klopot].tytul}</p>
                <p className="mt-1 text-sm text-[#f1dcc0]">{OPIS_KLOPOTU[klopot].rada}</p>
                <button onClick={wlaczSprzet} className="gabinet-fokus mt-3 text-sm font-medium underline underline-offset-4 rounded">
                  Spróbuj ponownie
                </button>
              </div>
            )}
            {blad && (
              <div role="alert" className="mt-5 rounded-2xl bg-[#3a1d22] border border-[#7d3a44] p-4 text-sm text-[#ffd5da]">
                {blad}
              </div>
            )}

            <button
              onClick={dolacz}
              disabled={etap === 'laczenie' || !sprzetGotowy || zaWczesnie}
              className="gabinet-fokus mt-6 w-full py-3.5 rounded-2xl bg-[#7fd6c6] text-[#062321] font-semibold hover:bg-[#9be3d5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {etap === 'laczenie' ? 'Łączę…' : 'Wejdź do rozmowy'}
            </button>
            {zaWczesnie && (
              <p role="status" className="mt-3 text-sm text-center text-[#a9c9c2]">
                Pokój otworzy się: {kiedyOtwarcie}. Możesz zostać na tej stronie, przycisk włączy się sam.
              </p>
            )}
          </div>
        </main>
      )}

      {/* Rozmowa */}
      <main className={wRozmowie ? 'flex-1 flex flex-col min-h-0 sm:p-6' : 'hidden'}>
        <div className="gabinet-rama gabinet-rozmowa relative flex-1 min-h-0 overflow-hidden">
          <video
            ref={zdalnyRef}
            autoPlay
            playsInline
            onLoadedMetadata={sprawdzDopasowanie}
            onResize={sprawdzDopasowanie}
            className={`absolute inset-0 w-full h-full ${calyObraz ? 'object-contain' : 'object-cover'} ${obrazDrugiej ? '' : 'invisible'}`}
          />

          {/* Na telefonie nagłówek leży na obrazie, żeby rozmówca miał cały ekran */}
          <div className="sm:hidden absolute left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex">
            <div className="max-w-full rounded-full bg-[#062321]/70 backdrop-blur px-3.5 py-1.5 text-sm truncate">
              {rozmowca ?? 'Konsultacja wideo'}{godziny && <span className="text-[#a9c9c2]"> · {godziny}</span>}
            </div>
          </div>

          {!obrazDrugiej && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <div className={`gabinet-krag ${drugaOsoba ? '' : 'gabinet-oddech'}`}>
                <span className="text-2xl font-semibold">{(rozmowca ?? ktoDrugi).charAt(0).toUpperCase()}</span>
              </div>
              <p className="mt-5 text-lg font-medium">
                {drugaOsoba ? `${rozmowca ?? 'Druga osoba'} jest w rozmowie` : `Czekamy, aż dołączy ${ktoDrugi}`}
              </p>
              <p className="mt-1 text-sm text-[#a9c9c2]">
                {drugaOsoba ? 'Kamera drugiej osoby jest wyłączona. Słyszycie się.' : 'Zostań na tej stronie. Rozmowa zacznie się sama.'}
              </p>
            </div>
          )}

          <div className={`absolute right-3 sm:right-5 ${wyborTla ? 'top-16 sm:top-5' : 'bottom-[calc(6.5rem+env(safe-area-inset-bottom))] sm:bottom-5'} w-24 sm:w-44 aspect-[3/4] sm:aspect-[4/3] rounded-2xl overflow-hidden bg-[#0d3331] ring-1 ring-white/15 shadow-xl ${kamera ? '' : 'hidden'}`}>
            <video ref={wlasnyRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
          </div>

          {(slabeLacze || wznawianie) && (
            <div role="status" className="absolute top-16 left-3 right-3 sm:top-3 sm:left-5 sm:right-auto sm:max-w-sm rounded-2xl bg-[#062321]/85 backdrop-blur px-4 py-3 flex items-start gap-3">
              <WifiOff size={18} className="mt-0.5 shrink-0 text-[#ffd9a1]" />
              <div className="text-sm">
                {wznawianie ? 'Połączenie się zerwało. Łączę ponownie…' : 'Słabe łącze.'}
                {!wznawianie && kamera && (
                  <button onClick={przelaczKamere} className="gabinet-fokus ml-1 underline underline-offset-4 rounded">
                    Przejdź na sam dźwięk
                  </button>
                )}
              </div>
            </div>
          )}

          {wyborTla && (
            <div className="absolute inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] sm:left-auto sm:right-5 sm:bottom-24 sm:w-96 z-10 rounded-3xl bg-[#062321]/90 backdrop-blur p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Tło za Tobą</p>
                <button onClick={() => setWyborTla(false)} aria-label="Zamknij wybór tła" className="gabinet-fokus h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {TLA.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => wybierzTlo(t.id)}
                    disabled={tloLaduje}
                    aria-pressed={tlo === t.id}
                    className={`gabinet-fokus relative aspect-[3/2] rounded-xl overflow-hidden bg-white/10 ring-2 transition-shadow disabled:opacity-60 ${tlo === t.id ? 'ring-[#7fd6c6]' : 'ring-transparent'}`}
                  >
                    {t.mini
                      ? <img src={t.mini} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      : <span className={`absolute inset-0 ${t.id === 'rozmycie' ? 'bg-gradient-to-br from-[#5f8f87] to-[#1d4a47] blur-[1px]' : ''}`} />}
                    <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-[11px] text-white">{t.nazwa}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#a9c9c2]">
                {tloLaduje ? 'Ustawiam tło…' : 'Tło widzisz w swoim okienku. Rozmówca widzi to samo.'}
              </p>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 rounded-full bg-[#062321]/70 backdrop-blur px-3 py-2.5">
              <PrzyciskSprzetu wlaczony={mikrofon} onClick={przelaczMikrofon} etykieta={mikrofon ? 'Wycisz mikrofon' : 'Włącz mikrofon'}>
                {mikrofon ? <Mic size={20} /> : <MicOff size={20} />}
              </PrzyciskSprzetu>
              <PrzyciskSprzetu wlaczony={kamera} onClick={przelaczKamere} etykieta={kamera ? 'Wyłącz kamerę' : 'Włącz kamerę'} nieczynny={!maKamere}>
                {kamera ? <Video size={20} /> : <VideoOff size={20} />}
              </PrzyciskSprzetu>
              {tlaMozliwe && kamera && (
                <PrzyciskSprzetu wlaczony={!wyborTla} onClick={() => setWyborTla(!wyborTla)} etykieta="Wybierz tło">
                  <IkonaTla size={20} />
                </PrzyciskSprzetu>
              )}
              <button
                onClick={zakoncz}
                className="gabinet-fokus h-12 px-5 rounded-full bg-[#d9484f] hover:bg-[#e75d64] text-white font-medium flex items-center gap-2 transition-colors"
              >
                <PhoneOff size={18} />
                Zakończ
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Zakończenie albo zerwane połączenie */}
      {(etap === 'koniec' || etap === 'zerwane') && (
        <main className="flex-1 flex items-center justify-center px-4 py-6">
          <div className="w-full max-w-sm text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {etap === 'koniec' ? 'Rozmowa zakończona' : 'Połączenie zostało przerwane'}
            </h1>
            <p className="mt-2 text-sm text-[#a9c9c2]">
              {etap === 'koniec'
                ? 'Kamera i mikrofon są wyłączone. Możesz zamknąć tę stronę.'
                : 'Sprawdź internet i wejdź do rozmowy jeszcze raz.'}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {etap === 'zerwane' && (
                <button onClick={() => setEtap('poczekalnia')} className="gabinet-fokus w-full py-3.5 rounded-2xl bg-[#7fd6c6] text-[#062321] font-semibold hover:bg-[#9be3d5] transition-colors">
                  Wejdź ponownie
                </button>
              )}
              <button onClick={doKalendarza} className="gabinet-fokus w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 font-medium transition-colors">
                Wróć do kalendarza
              </button>
              {etap === 'koniec' && (
                <button onClick={() => setEtap('poczekalnia')} className="gabinet-fokus text-sm text-[#a9c9c2] hover:text-white underline underline-offset-4 rounded">
                  Wejdź do rozmowy ponownie
                </button>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

function PrzyciskSprzetu({ wlaczony, onClick, etykieta, nieczynny, children }: {
  wlaczony: boolean;
  onClick: () => void;
  etykieta: string;
  nieczynny?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={nieczynny}
      aria-label={etykieta}
      title={etykieta}
      aria-pressed={!wlaczony}
      className={`gabinet-fokus h-12 w-12 shrink-0 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        wlaczony ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-white text-[#062321]'
      }`}
    >
      {children}
    </button>
  );
}

export default VideoPage;
