import { useState, useEffect } from 'react';
import { getTherapists, addTherapist, deleteTherapist } from '../services/therapistService';
import { Therapist } from '../types';
import { Plus } from 'lucide-react';

export function TherapistsPage() {
    const [therapists, setTherapists] = useState<Therapist[]>([]);
    const [loading, setLoading] = useState(true);

    const loadTherapists = async () => {
        setLoading(true);
        const fetched = await getTherapists();
        setTherapists(fetched);
        setLoading(false);
    };

    useEffect(() => {
        loadTherapists();
    }, []);
    
    // Basic handler for adding a new therapist
    const handleAddTherapist = async () => {
        const name = prompt("Podaj imię i nazwisko terapeuty:");
        if (name) {
            const specialization = prompt("Podaj specjalizację:") || "Terapeuta";
            await addTherapist({ name, specialization, color: '' });
            loadTherapists();
        }
    };

    const handleDeleteTherapist = async (id: string) => {
        if (window.confirm("Czy na pewno usunąć terapeutę?")) {
            await deleteTherapist(id);
            loadTherapists();
        }
    }

    if (loading) {
        return <div>Ładowanie terapeutów...</div>;
    }

    return (
        <div className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-lg">Zarządzaj Terapeutami</h3>
                <button 
                    onClick={handleAddTherapist}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-myway-primary hover:bg-teal-800 rounded-lg shadow-lg shadow-teal-900/10"
                >
                    <Plus size={16} />
                    Dodaj Terapeutę
                </button>
            </div>
            
            <table className="w-full">
                <thead className="bg-slate-50/80">
                    <tr>
                        <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Imię i nazwisko</th>
                        <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Specjalizacja</th>
                        <th className="p-5"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {therapists.map(therapist => (
                        <tr key={therapist.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="p-5 font-medium text-slate-800">{therapist.name}</td>
                            <td className="p-5 text-slate-600">{therapist.specialization}</td>
                            <td className="p-5 text-right">
                                <button 
                                    onClick={() => handleDeleteTherapist(therapist.id)}
                                    className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md"
                                >
                                    Usuń
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
