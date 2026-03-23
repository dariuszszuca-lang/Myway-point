import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { pl } from 'date-fns/locale';
import { BarChart3, Calendar, ChevronDown, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { getSessionsByDateRange } from '../services/sessionService';
import { getTherapists } from '../services/therapistService';
import { Session, Therapist } from '../types';

type Period = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';

export function ReportsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [period, setPeriod] = useState<Period>('thisWeek');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'thisWeek':
        return { start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
      case 'lastWeek': {
        const lw = subWeeks(now, 1);
        return { start: format(startOfWeek(lw, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(lw, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
      }
      case 'thisMonth':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'lastMonth': {
        const lm = subMonths(now, 1);
        return { start: format(startOfMonth(lm), 'yyyy-MM-dd'), end: format(endOfMonth(lm), 'yyyy-MM-dd') };
      }
      case 'custom':
        return { start: customStart, end: customEnd };
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    const load = async () => {
      if (!dateRange.start || !dateRange.end) return;
      setLoading(true);
      const [s, t] = await Promise.all([
        getSessionsByDateRange(dateRange.start, dateRange.end),
        getTherapists()
      ]);
      setSessions(s);
      setTherapists(t);
      setLoading(false);
    };
    load();
  }, [dateRange]);

  const stats = useMemo(() => {
    return therapists.map(t => {
      const therapistSessions = sessions.filter(s => s.therapistId === t.id);
      const completed = therapistSessions.filter(s => s.status === 'completed').length;
      const scheduled = therapistSessions.filter(s => s.status === 'scheduled').length;
      const cancelled = therapistSessions.filter(s => s.status === 'cancelled').length;
      const noShow = therapistSessions.filter(s => s.status === 'no-show').length;
      const total = therapistSessions.length;

      return { therapist: t, total, completed, scheduled, cancelled, noShow };
    }).sort((a, b) => b.total - a.total);
  }, [sessions, therapists]);

  const totals = useMemo(() => ({
    total: sessions.length,
    completed: sessions.filter(s => s.status === 'completed').length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    cancelled: sessions.filter(s => s.status === 'cancelled').length,
    noShow: sessions.filter(s => s.status === 'no-show').length,
  }), [sessions]);

  const maxSessions = Math.max(...stats.map(s => s.total), 1);

  const periodLabels: Record<Period, string> = {
    thisWeek: 'Ten tydzień',
    lastWeek: 'Ostatni tydzień',
    thisMonth: 'Ten miesiąc',
    lastMonth: 'Ostatni miesiąc',
    custom: 'Własny zakres'
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <BarChart3 className="text-myway-primary" size={28} />
            Raport terapeutów
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Statystyki sesji w okresie: {dateRange.start && dateRange.end
              ? `${format(new Date(dateRange.start), 'd MMM', { locale: pl })} – ${format(new Date(dateRange.end), 'd MMM yyyy', { locale: pl })}`
              : 'wybierz zakres'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-myway-primary/20 cursor-pointer"
            >
              {Object.entries(periodLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-myway-primary/20"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-myway-primary/20"
              />
            </div>
          )}
        </div>
      </div>

      {/* PODSUMOWANIE */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-2">
            <Calendar size={14} /> Wszystkie
          </div>
          <p className="text-3xl font-bold text-slate-800">{totals.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium mb-2">
            <CheckCircle2 size={14} /> Zakończone
          </div>
          <p className="text-3xl font-bold text-emerald-600">{totals.completed}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-blue-500 text-xs font-medium mb-2">
            <Clock size={14} /> Zaplanowane
          </div>
          <p className="text-3xl font-bold text-blue-500">{totals.scheduled}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-2">
            <XCircle size={14} /> Anulowane
          </div>
          <p className="text-3xl font-bold text-slate-400">{totals.cancelled}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-amber-500 text-xs font-medium mb-2">
            <AlertTriangle size={14} /> Nieobecność
          </div>
          <p className="text-3xl font-bold text-amber-500">{totals.noShow}</p>
        </div>
      </div>

      {/* TABELA TERAPEUTÓW */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-myway-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700">Sesje per terapeuta</h2>
          </div>

          <div className="divide-y divide-slate-50">
            {stats.map(({ therapist, total, completed, scheduled, cancelled, noShow }) => (
              <div key={therapist.id} className="px-6 py-5 hover:bg-slate-50/50 transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: therapist.color }}
                    >
                      {therapist.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">{therapist.name}</p>
                      <p className="text-xs text-slate-400">{therapist.specialization}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-800">{total}</p>
                    <p className="text-xs text-slate-400">sesji łącznie</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  {completed > 0 && (
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${(completed / maxSessions) * 100}%` }}
                      title={`Zakończone: ${completed}`}
                    />
                  )}
                  {scheduled > 0 && (
                    <div
                      className="h-full bg-blue-400 transition-all duration-500"
                      style={{ width: `${(scheduled / maxSessions) * 100}%` }}
                      title={`Zaplanowane: ${scheduled}`}
                    />
                  )}
                  {cancelled > 0 && (
                    <div
                      className="h-full bg-slate-300 transition-all duration-500"
                      style={{ width: `${(cancelled / maxSessions) * 100}%` }}
                      title={`Anulowane: ${cancelled}`}
                    />
                  )}
                  {noShow > 0 && (
                    <div
                      className="h-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${(noShow / maxSessions) * 100}%` }}
                      title={`Nieobecność: ${noShow}`}
                    />
                  )}
                </div>

                {/* Legendy */}
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  {completed > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> {completed} zakończ.
                    </span>
                  )}
                  {scheduled > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400" /> {scheduled} zaplan.
                    </span>
                  )}
                  {cancelled > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-300" /> {cancelled} anul.
                    </span>
                  )}
                  {noShow > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" /> {noShow} nieob.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
