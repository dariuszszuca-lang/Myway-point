import { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { Activity, Mail, Lock } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // On successful login, the AuthProvider will redirect
    } catch (err: any) {
      setError('Nie udało się zalogować. Sprawdź e-mail i hasło.');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-myway-bg font-sans">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-soft">
        <div className="flex flex-col items-center">
            <div className="bg-myway-primary p-3 rounded-2xl shadow-lg shadow-teal-900/20 mb-4">
                <Activity className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">MyWay Point</h1>
            <p className="text-slate-500 mt-2">Zaloguj się, aby kontynuować</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Adres e-mail"
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-myway-secondary/50 transition-all"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Hasło"
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-myway-secondary/50 transition-all"
              required
            />
          </div>

          {error && <p className="text-center text-rose-500 text-sm font-medium">{error}</p>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 rounded-xl bg-myway-primary text-white font-bold hover:bg-teal-800 transition-colors shadow-lg shadow-teal-900/20 disabled:bg-slate-400 disabled:shadow-none"
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>
      </div>
    </div>
  );
}
