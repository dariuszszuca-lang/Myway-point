import { useState, useEffect } from 'react';
import { getTherapists, addTherapist, deleteTherapist, initializeAvailabilityForExistingTherapists } from '../services/therapistService';
import { getAvailabilityByTherapist, addAvailability, deleteAvailability, updateAvailability, DAY_NAMES } from '../services/availabilityService';
import { Therapist, Availability } from '../types';
import { Plus, Clock, Trash2, Check, X } from 'lucide-react';

interface TherapistWithAvailability extends Therapist {
    availability: Availability[];
}

export function TherapistsPage() {
    const [therapists, setTherapists] = useState<TherapistWithAvailability[]>([]);
    const [loading, setLoading] = useState(true);
    const [newAvailability, setNewAvailability] = useState<{
        therapistId: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
    } | null>(null);

    const loadTherapists = async () => {
        setLoading(true);
        // First ensure availability exists for all therapists
        await initializeAvailabilityForExistingTherapists();

        const fetched = await getTherapists();
        const withAvailability = await Promise.all(
            fetched.map(async (therapist) => {
                const availability = await getAvailabilityByTherapist(therapist.id);
                return { ...therapist, availability };
            })
        );
        setTherapists(withAvailability);
        setLoading(false);
    };

    useEffect(() => {
        loadTherapists();
    }, []);

    const handleAddTherapist = async () => {
        const name = prompt("Podaj imię i nazwisko terapeuty:");
        if (name) {
            const specialization = prompt("Podaj specjalizację:") || "Terapeuta";
            await addTherapist({ name, specialization, color: '' });
            loadTherapists();
        }
    };

    const handleDeleteTherapist = async (id: string) => {
        if (window.confirm("Czy na pewno usunąć terapeutę? Usunięta zostanie również cała jego dostępność.")) {
            await deleteTherapist(id);
            loadTherapists();
        }
    };

    const handleAddAvailability = (therapistId: string) => {
        setNewAvailability({
            therapistId,
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '17:00',
        });
    };

    const handleSaveNewAvailability = async () => {
        if (newAvailability) {
            await addAvailability({
                ...newAvailability,
                isActive: true,
            });
            setNewAvailability(null);
            loadTherapists();
        }
    };

    const handleDeleteAvailability = async (availabilityId: string) => {
        if (window.confirm("Usunąć ten slot dostępności?")) {
            await deleteAvailability(availabilityId);
            loadTherapists();
        }
    };

    const handleToggleAvailability = async (availability: Availability) => {
        await updateAvailability(availability.id, { isActive: !availability.isActive });
        loadTherapists();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">Ładowanie terapeutów...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Terapeuci i Dostępność</h2>
                        <p className="text-sm text-slate-500 mt-1">Zarządzaj harmonogramem dostępności terapeutów</p>
                    </div>
                    <button
                        onClick={handleAddTherapist}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-myway-primary hover:bg-teal-800 rounded-lg shadow-lg shadow-teal-900/10 transition-colors"
                    >
                        <Plus size={16} />
                        Dodaj Terapeutę
                    </button>
                </div>
            </div>

            {/* Therapists List */}
            {therapists.map(therapist => (
                <div key={therapist.id} className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden">
                    {/* Therapist Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                                style={{ backgroundColor: therapist.color || '#0f766e' }}
                            >
                                {therapist.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">{therapist.name}</h3>
                                <p className="text-sm text-slate-500">{therapist.specialization}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleDeleteTherapist(therapist.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                        >
                            Usuń
                        </button>
                    </div>

                    {/* Availability Section */}
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Clock size={18} className="text-teal-600" />
                                Dostępność tygodniowa
                            </h4>
                            <button
                                onClick={() => handleAddAvailability(therapist.id)}
                                className="text-xs font-medium text-teal-700 hover:text-teal-800 flex items-center gap-1"
                            >
                                <Plus size={14} />
                                Dodaj slot
                            </button>
                        </div>

                        {/* New Availability Form */}
                        {newAvailability?.therapistId === therapist.id && (
                            <div className="mb-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
                                <div className="flex flex-wrap gap-3 items-center">
                                    <select
                                        value={newAvailability.dayOfWeek}
                                        onChange={(e) => setNewAvailability({
                                            ...newAvailability,
                                            dayOfWeek: parseInt(e.target.value)
                                        })}
                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    >
                                        {DAY_NAMES.map((day, index) => (
                                            <option key={index} value={index}>{day}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="time"
                                        value={newAvailability.startTime}
                                        onChange={(e) => setNewAvailability({
                                            ...newAvailability,
                                            startTime: e.target.value
                                        })}
                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    />
                                    <span className="text-slate-500">-</span>
                                    <input
                                        type="time"
                                        value={newAvailability.endTime}
                                        onChange={(e) => setNewAvailability({
                                            ...newAvailability,
                                            endTime: e.target.value
                                        })}
                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    />
                                    <button
                                        onClick={handleSaveNewAvailability}
                                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                                    >
                                        <Check size={18} />
                                    </button>
                                    <button
                                        onClick={() => setNewAvailability(null)}
                                        className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Availability List */}
                        {therapist.availability.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Brak ustawionej dostępności</p>
                        ) : (
                            <div className="grid gap-2">
                                {therapist.availability
                                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                                    .map(avail => (
                                        <div
                                            key={avail.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                                avail.isActive
                                                    ? 'bg-slate-50 border-slate-200'
                                                    : 'bg-slate-100 border-slate-200 opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${avail.isActive ? 'bg-green-500' : 'bg-slate-400'}`} />
                                                <span className="font-medium text-slate-700">
                                                    {DAY_NAMES[avail.dayOfWeek]}
                                                </span>
                                                <span className="text-slate-500">
                                                    {avail.startTime} - {avail.endTime}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleToggleAvailability(avail)}
                                                    className={`px-2 py-1 text-xs rounded ${
                                                        avail.isActive
                                                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                                            : 'text-green-700 bg-green-50 hover:bg-green-100'
                                                    }`}
                                                >
                                                    {avail.isActive ? 'Wyłącz' : 'Włącz'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAvailability(avail.id)}
                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {therapists.length === 0 && (
                <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-12 text-center">
                    <p className="text-slate-500">Brak terapeutów. Dodaj pierwszego terapeutę.</p>
                </div>
            )}
        </div>
    );
}
