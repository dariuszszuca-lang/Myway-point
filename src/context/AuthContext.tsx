import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut, AuthUser as User } from '../aws/cognito';
import { ApiError } from '../aws/api';
import { loadAccount, UserRole, AppUser } from '../services/userService';
import { Patient } from '../types';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  role: UserRole | null;
  isAdmin: boolean;
  isTherapist: boolean;
  patientData: Patient | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  role: null,
  isAdmin: false,
  isTherapist: false,
  patientData: null,
  loading: true
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [patientData, setPatientData] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (authUser) => {
      setUser(authUser);

      if (authUser && authUser.email) {
        try {
          // Rolę, powiązania i rekord pacjenta ustala serwer.
          const konto = await loadAccount();
          setAppUser(konto.appUser);
          setPatientData(konto.appUser.role === 'patient' ? konto.patientData : null);
        } catch (error) {
          console.error('Error loading user data:', error);
          setAppUser(null);
          setPatientData(null);
          // Serwer nie uznaje sesji: wylogowanie zamiast pustego ekranu.
          if (error instanceof ApiError && error.status === 401) {
            await signOut();
            return;
          }
        }
      } else {
        setAppUser(null);
        setPatientData(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const role = appUser?.role ?? null;
  const isAdmin = role === 'admin';
  const isTherapist = role === 'therapist';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-myway-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-myway-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500">Ładowanie...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, appUser, role, isAdmin, isTherapist, patientData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
