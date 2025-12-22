import { useState, useEffect } from 'react';
import { Patient } from '../types';
import { X } from 'lucide-react';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patient: Omit<Patient, 'id'>) => void;
  patientToEdit?: Patient | null;
}

export function PatientModal({ isOpen, onClose, onSave, patientToEdit }: PatientModalProps) {
  const [name, setName] = useState('');
  const [totalSessions, setTotalSessions] = useState(20);

  useEffect(() => {
    if (patientToEdit) {
      setName(patientToEdit.name);
      setTotalSessions(patientToEdit.totalSessions);
    } else {
      setName('');
      setTotalSessions(20);
    }
  }, [patientToEdit, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
        name, 
        totalSessions: Number(totalSessions),
        usedSessions: patientToEdit ? patientToEdit.usedSessions : 0,
        sessionsHistory: patientToEdit ? patientToEdit.sessionsHistory : []
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg m-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">{patientToEdit ? 'Edytuj Pacjenta' : 'Dodaj Pacjenta'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-600 mb-2">Imię i nazwisko</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-myway-primary/50"
                required
              />
            </div>
            <div>
              <label htmlFor="totalSessions" className="block text-sm font-medium text-slate-600 mb-2">Liczba sesji w pakiecie</label>
              <input
                id="totalSessions"
                type="number"
                value={totalSessions}
                onChange={(e) => setTotalSessions(Number(e.target.value))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-myway-primary/50"
                required
              />
            </div>
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium">
              Anuluj
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg text-white bg-myway-primary hover:bg-teal-800 font-medium">
              {patientToEdit ? 'Zapisz zmiany' : 'Dodaj Pacjenta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
