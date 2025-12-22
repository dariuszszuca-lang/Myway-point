import { useState, useEffect } from 'react';
import { getPatients, addPatient, updatePatient, deletePatient } from '../services/patientService';
import { Patient } from '../types';
import { PatientModal } from '../components/PatientModal';
import { MoreVertical, User, Plus, CheckCircle2, Activity } from 'lucide-react';
import { format } from 'date-fns';

export function PatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);

    const loadPatients = async () => {
        setLoading(true);
        try {
            const fetchedPatients = await getPatients();
            setPatients(fetchedPatients);
        } catch (error) {
            console.error("Error fetching patients:", error);
            // Handle error display to the user
        }
        setLoading(false);
    };

    useEffect(() => {
        loadPatients();
    }, []);

    const handleOpenModalForCreate = () => {
        setPatientToEdit(null);
        setIsModalOpen(true);
    };
    
    const handleOpenModalForEdit = (patient: Patient) => {
        setPatientToEdit(patient);
        setIsModalOpen(true);
    };

    const handleSavePatient = async (patientData: Omit<Patient, 'id'>) => {
        try {
            if (patientToEdit) {
                await updatePatient(patientToEdit.id, patientData);
            } else {
                await addPatient(patientData);
            }
            loadPatients(); // Refresh the list
        } catch(error) {
            console.error("Error saving patient:", error);
        }
    };
    
    const handleDeletePatient = async (id: string) => {
        if(window.confirm('Czy na pewno chcesz usunąć tego pacjenta? Tej operacji nie można cofnąć.')) {
            try {
                await deletePatient(id);
                loadPatients(); // Refresh the list
            } catch (error) {
                console.error("Error deleting patient:", error);
            }
        }
    }


  return (
    <>
      <div className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-lg">Baza Pacjentów</h3>
          <div className="flex gap-2">
            <button 
              onClick={handleOpenModalForCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-myway-primary hover:bg-teal-800 rounded-lg shadow-lg shadow-teal-900/10"
            >
              <Plus size={16} />
              Dodaj Pacjenta
            </button>
          </div>
        </div>
        
        {loading ? (
            <div className="text-center p-10">Ładowanie pacjentów...</div>
        ) : (
            <table className="w-full">
            <thead className="bg-slate-50/80">
                <tr>
                <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Pacjent</th>
                <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-1/3">Status Pakietu</th>
                <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Ostatnia wizyta</th>
                <th className="p-5"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {patients.map(p => {
                    const usagePercent = p.totalSessions > 0 ? (p.usedSessions / p.totalSessions) * 100 : 0;
                    const isFinished = p.totalSessions > 0 && p.usedSessions >= p.totalSessions;
                    
                    return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-white group-hover:shadow-sm transition-all">
                            {p.name.charAt(0)}
                            </div>
                            <div>
                            <p className="font-bold text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-500">ID: {p.id.substring(0,6)}</p>
                            </div>
                        </div>
                        </td>
                        <td className="p-5">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                            <span>Wykorzystano: {p.usedSessions}</span>
                            <span>Pozostało: {p.totalSessions - p.usedSessions}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div 
                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                                isFinished ? 'bg-gradient-to-r from-rose-500 to-rose-400' : 
                                'bg-gradient-to-r from-teal-500 to-emerald-400'
                            }`} 
                            style={{ width: `${usagePercent}%` }}
                            ></div>
                        </div>
                        </td>
                        <td className="p-5">
                        {isFinished ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                <Activity size={12} /> Koniec pakietu
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <CheckCircle2 size={12} /> Aktywny
                            </span>
                        )}
                        </td>
                        <td className="p-5">
                            {/* This would require session data */}
                            <span className="text-sm text-slate-400 italic">Brak danych</span>
                        </td>
                        <td className="p-5 text-right">
                          <div className="relative">
                            <button onClick={() => { handleOpenModalForEdit(p) }} className="p-2 text-slate-400 hover:text-myway-primary hover:bg-slate-100 rounded-lg transition-colors">Edytuj</button>
                            <button onClick={() => { handleDeletePatient(p.id) }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">Usuń</button>
                          </div>
                        </td>
                    </tr>
                    );
                })}
            </tbody>
            </table>
        )}
      </div>
      <PatientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePatient}
        patientToEdit={patientToEdit}
      />
    </>
  );
}
