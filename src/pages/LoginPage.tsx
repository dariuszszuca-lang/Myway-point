import { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { Activity, Mail, Lock, ArrowRight, Shield, Clock, Users } from 'lucide-react';

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
    } catch (err: any) {
      setError('Nieprawidłowy e-mail lub hasło');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex font-sans">
      {/* Left side - Login Form */}
      <div className="w-full lg:w-[480px] flex flex-col justify-center px-8 lg:px-16 bg-white relative z-10">
        <div className="max-w-sm mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-gradient-to-br from-myway-primary to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">MyWay Point</h1>
              <p className="text-xs text-slate-400">System rezerwacji</p>
            </div>
          </div>

          {/* Welcome text */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Witaj ponownie</h2>
            <p className="text-slate-500">Zaloguj się do panelu terapeuty</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Adres e-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="twoj@email.pl"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-myway-primary/20 focus:border-myway-primary transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hasło
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-myway-primary/20 focus:border-myway-primary transition-all"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="text-rose-600 text-sm font-medium text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-myway-primary to-teal-600 text-white font-semibold hover:from-teal-700 hover:to-teal-700 transition-all shadow-lg shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Logowanie...
                </>
              ) : (
                <>
                  Zaloguj się
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-slate-400">
            Problemy z logowaniem? Skontaktuj się z administratorem
          </p>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-myway-primary via-teal-600 to-emerald-600 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-20 right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="max-w-lg">
            <h2 className="text-4xl font-bold mb-6 leading-tight">
              Zarządzaj sesjami terapeutycznymi w jednym miejscu
            </h2>
            <p className="text-lg text-white/80 mb-12">
              Intuicyjny kalendarz, zarządzanie pacjentami i pełna kontrola nad terminami.
            </p>

            {/* Features */}
            <div className="space-y-4">
              <FeatureItem
                icon={<Clock className="w-5 h-5" />}
                title="Kalendarz wizyt"
                description="Planuj sesje dla wielu terapeutów"
              />
              <FeatureItem
                icon={<Users className="w-5 h-5" />}
                title="Baza pacjentów"
                description="Śledź pakiety i historię wizyt"
              />
              <FeatureItem
                icon={<Shield className="w-5 h-5" />}
                title="Bezpieczeństwo"
                description="Dane zaszyfrowane i chronione"
              />
            </div>
          </div>

          {/* Bottom decoration */}
          <div className="absolute bottom-8 left-16 right-16 flex items-center gap-4 text-white/40 text-sm">
            <span>MyWay Kąpino</span>
            <span className="w-1 h-1 bg-white/40 rounded-full" />
            <span>Ośrodek Terapii Uzależnień</span>
          </div>
        </div>

        {/* Floating cards decoration */}
        <div className="absolute right-16 top-1/2 -translate-y-1/2 space-y-4">
          <FloatingCard delay="0s">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white font-bold">K</div>
              <div>
                <p className="font-medium text-slate-800">Krystian Nagaba</p>
                <p className="text-xs text-slate-500">Terapeuta uzależnień</p>
              </div>
            </div>
          </FloatingCard>
          <FloatingCard delay="0.2s">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">N</div>
              <div>
                <p className="font-medium text-slate-800">Natalia Pucz</p>
                <p className="text-xs text-slate-500">Terapeutka</p>
              </div>
            </div>
          </FloatingCard>
          <FloatingCard delay="0.4s">
            <div className="p-2 bg-myway-primary/10 rounded-lg">
              <p className="text-xs text-myway-primary font-medium">Dzisiaj: 8 sesji zaplanowanych</p>
            </div>
          </FloatingCard>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold mb-0.5">{title}</h3>
        <p className="text-sm text-white/70">{description}</p>
      </div>
    </div>
  );
}

function FloatingCard({ children, delay }: { children: React.ReactNode; delay: string }) {
  return (
    <div
      className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-xl animate-float"
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}
