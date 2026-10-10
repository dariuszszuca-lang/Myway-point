// Logowanie przez Amazon Cognito (pula myway-rezerwacje): e-mail + hasło, tak jak wcześniej w Firebase.
// Bez dodatkowej biblioteki: kilka wywołań HTTP i sesja w pamięci przeglądarki.
import { CLIENT_ID, REGION } from './config';

const ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;
const KLUCZ = 'rez-sesja-v1';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
}

interface Sesja {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  wygasa: number; // ms
}

export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function cognito<T = any>(operacja: string, cialo: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${operacja}`,
      },
      body: JSON.stringify(cialo),
    });
  } catch {
    throw new AuthError('siec', 'Brak połączenia. Spróbuj ponownie.');
  }
  const dane = await res.json().catch(() => ({}));
  if (!res.ok) {
    const typ = String(dane.__type || '').split('#').pop() || 'blad';
    throw new AuthError(typ, String(dane.message || ''));
  }
  return dane as T;
}

function odczytajToken(idToken: string): Record<string, any> {
  const srodek = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const bajty = Uint8Array.from(atob(srodek), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bajty));
}

function uzytkownikZTokenu(idToken: string): AuthUser {
  const t = odczytajToken(idToken);
  return {
    uid: t.sub,
    email: String(t.email || '').toLowerCase(),
    displayName: t.name || null,
    emailVerified: t.email_verified === true || t.email_verified === 'true',
  };
}

function wczytajSesje(): Sesja | null {
  try {
    const s = JSON.parse(localStorage.getItem(KLUCZ) || 'null');
    return s && s.idToken && s.refreshToken ? s : null;
  } catch {
    return null;
  }
}

let sesja: Sesja | null = wczytajSesje();
const sluchacze = new Set<(u: AuthUser | null) => void>();

function ustawSesje(nowa: Sesja | null, powiadom = true) {
  sesja = nowa;
  if (nowa) localStorage.setItem(KLUCZ, JSON.stringify(nowa));
  else localStorage.removeItem(KLUCZ);
  if (powiadom) {
    const u = nowa ? uzytkownikZTokenu(nowa.idToken) : null;
    sluchacze.forEach((f) => f(u));
  }
}

function zWyniku(w: any, refreshToken?: string): Sesja {
  const r = w.AuthenticationResult;
  return {
    idToken: r.IdToken,
    accessToken: r.AccessToken,
    refreshToken: r.RefreshToken || refreshToken || '',
    wygasa: Date.now() + (r.ExpiresIn || 3600) * 1000,
  };
}

export function currentUser(): AuthUser | null {
  return sesja ? uzytkownikZTokenu(sesja.idToken) : null;
}

// Zgłasza stan logowania od razu i przy każdej zmianie. Zwraca funkcję wypisania.
export function onAuthStateChanged(f: (u: AuthUser | null) => void): () => void {
  sluchacze.add(f);
  odswiezJesliTrzeba()
    .catch(() => null)
    .then(() => f(currentUser()));
  return () => {
    sluchacze.delete(f);
  };
}

let trwaOdswiezanie: Promise<void> | null = null;

async function odswiezJesliTrzeba(): Promise<void> {
  if (!sesja || sesja.wygasa - Date.now() > 60_000) return;
  if (!trwaOdswiezanie) {
    const stara = sesja;
    trwaOdswiezanie = cognito('InitiateAuth', {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: stara.refreshToken },
    })
      .then((w) => ustawSesje(zWyniku(w, stara.refreshToken), false))
      .catch((e) => {
        // Sesja wygasła albo została cofnięta: wylogowanie. Chwilowy brak sieci nie wylogowuje.
        if (e instanceof AuthError && e.code !== 'siec') ustawSesje(null);
        throw e;
      })
      .finally(() => {
        trwaOdswiezanie = null;
      });
  }
  await trwaOdswiezanie;
}

// Token do wywołań API. Odświeża go przed wygaśnięciem.
export async function getIdToken(): Promise<string> {
  await odswiezJesliTrzeba();
  if (!sesja) throw new AuthError('brak-sesji', 'Sesja wygasła. Zaloguj się ponownie.');
  return sesja.idToken;
}

export async function signIn(email: string, password: string): Promise<void> {
  const w = await cognito('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password },
  });
  if (!w.AuthenticationResult) throw new AuthError('wyzwanie', 'Logowanie wymaga dodatkowego kroku. Skontaktuj się z ośrodkiem.');
  ustawSesje(zWyniku(w));
}

// Zwraca true, gdy konto jest od razu czynne; false, gdy trzeba wpisać kod z maila.
export async function signUp(email: string, password: string, displayName: string): Promise<boolean> {
  const w = await cognito('SignUp', {
    ClientId: CLIENT_ID,
    Username: email.trim().toLowerCase(),
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email.trim().toLowerCase() },
      { Name: 'name', Value: displayName },
    ],
  });
  return Boolean(w.UserConfirmed);
}

export const confirmSignUp = (email: string, kod: string) =>
  cognito('ConfirmSignUp', { ClientId: CLIENT_ID, Username: email.trim().toLowerCase(), ConfirmationCode: kod.trim() });

export const resendCode = (email: string) =>
  cognito('ResendConfirmationCode', { ClientId: CLIENT_ID, Username: email.trim().toLowerCase() });

export const forgotPassword = (email: string) =>
  cognito('ForgotPassword', { ClientId: CLIENT_ID, Username: email.trim().toLowerCase() });

export const confirmForgotPassword = (email: string, kod: string, password: string) =>
  cognito('ConfirmForgotPassword', {
    ClientId: CLIENT_ID,
    Username: email.trim().toLowerCase(),
    ConfirmationCode: kod.trim(),
    Password: password,
  });

export async function signOut(): Promise<void> {
  const stara = sesja;
  ustawSesje(null);
  if (stara?.refreshToken) {
    await cognito('RevokeToken', { ClientId: CLIENT_ID, Token: stara.refreshToken }).catch(() => null);
  }
}
