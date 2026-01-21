import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '../firebaseConfig';
import { ensureUserExists, getPatientDataForUser, UserRole, AppUser } from '../services/userService';
import { Patient } from '../types';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  role: UserRole | null;
  isAdmin: boolean;
  patientData: Patient | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  role: null,
  isAdmin: false,
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
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser && firebaseUser.email) {
        try {
          // Ensure user document exists and get role
          const userData = await ensureUserExists(firebaseUser.uid, firebaseUser.email);
          setAppUser(userData);

          // If patient, load patient data
          if (userData.role === 'patient' && userData.patientId) {
            const pData = await getPatientDataForUser(userData.patientId);
            setPatientData(pData);
          } else {
            setPatientData(null);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          setAppUser(null);
          setPatientData(null);
        }
      } else {
        setAppUser(null);
        setPatientData(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [auth]);

  const role = appUser?.role ?? null;
  const isAdmin = role === 'admin';

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
    <AuthContext.Provider value={{ user, appUser, role, isAdmin, patientData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
