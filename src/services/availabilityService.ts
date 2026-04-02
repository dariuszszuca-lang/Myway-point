import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { Availability, AvailabilityOverride } from '../types';
import { getOverrideForDate } from './overrideService';

const availabilityCollectionRef = collection(db, 'availability');

// Day names in Polish
export const DAY_NAMES = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

// Default availability schedules for MyWay therapists
export const DEFAULT_AVAILABILITY: Omit<Availability, 'id'>[] = [
  // Krystian - Friday 19:30-21:00
  { therapistId: '', dayOfWeek: 5, startTime: '19:30', endTime: '21:00', isActive: true },

  // Waldek (Waldemar) - Wednesday 12:00-14:00, Thursday 07:00-11:00, Friday 07:00-11:00
  { therapistId: '', dayOfWeek: 3, startTime: '12:00', endTime: '14:00', isActive: true },
  { therapistId: '', dayOfWeek: 4, startTime: '07:00', endTime: '11:00', isActive: true },
  { therapistId: '', dayOfWeek: 5, startTime: '07:00', endTime: '11:00', isActive: true },

  // Natalia - Monday 18:30-19:30, Thursday 16:30-17:30
  { therapistId: '', dayOfWeek: 1, startTime: '18:30', endTime: '19:30', isActive: true },
  { therapistId: '', dayOfWeek: 4, startTime: '16:30', endTime: '17:30', isActive: true },
];

export const getAvailability = async (): Promise<Availability[]> => {
  const data = await getDocs(availabilityCollectionRef);
  return data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Availability[];
};

export const getAvailabilityByTherapist = async (therapistId: string): Promise<Availability[]> => {
  const q = query(availabilityCollectionRef, where('therapistId', '==', therapistId));
  const data = await getDocs(q);
  return data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Availability[];
};

export const addAvailability = async (data: Omit<Availability, 'id'>): Promise<Availability> => {
  const docRef = await addDoc(availabilityCollectionRef, data);
  return { ...data, id: docRef.id };
};

export const updateAvailability = async (id: string, data: Partial<Availability>): Promise<void> => {
  const availabilityDoc = doc(db, 'availability', id);
  await updateDoc(availabilityDoc, data);
};

export const deleteAvailability = async (id: string): Promise<void> => {
  const availabilityDoc = doc(db, 'availability', id);
  await deleteDoc(availabilityDoc);
};

export const deleteAvailabilityByTherapist = async (therapistId: string): Promise<void> => {
  const q = query(availabilityCollectionRef, where('therapistId', '==', therapistId));
  const data = await getDocs(q);
  const batch = writeBatch(db);
  data.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
};

// Initialize default availability for a therapist
export const initializeDefaultAvailability = async (therapistId: string, therapistName: string): Promise<void> => {
  let defaults: Omit<Availability, 'id'>[] = [];

  if (therapistName.includes('Krystian')) {
    defaults = [
      { therapistId, dayOfWeek: 5, startTime: '19:30', endTime: '21:00', isActive: true },
    ];
  } else if (therapistName.includes('Waldemar') || therapistName.includes('Waldek')) {
    defaults = [
      { therapistId, dayOfWeek: 3, startTime: '12:00', endTime: '14:00', isActive: true },
      { therapistId, dayOfWeek: 4, startTime: '07:00', endTime: '11:00', isActive: true },
      { therapistId, dayOfWeek: 5, startTime: '07:00', endTime: '11:00', isActive: true },
    ];
  } else if (therapistName.includes('Natalia')) {
    defaults = [
      { therapistId, dayOfWeek: 1, startTime: '18:30', endTime: '19:30', isActive: true },
      { therapistId, dayOfWeek: 4, startTime: '16:30', endTime: '17:30', isActive: true },
    ];
  }

  for (const avail of defaults) {
    await addAvailability(avail);
  }
};

// Convert time strings to minutes for comparison
const toMinutes = (time: string): number => {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
};

// Check if a specific time slot is available for a therapist
// Slot is available if its START time falls within the availability window
export const isTimeSlotAvailable = (
  availability: Availability[],
  dayOfWeek: number,
  startTime: string,
  _endTime: string
): boolean => {
  const activeAvailability = availability.filter(a => a.isActive && a.dayOfWeek === dayOfWeek);

  if (activeAvailability.length === 0) return false;

  const requestedStart = toMinutes(startTime);

  // Check if requested slot START falls within any availability window (inclusive)
  return activeAvailability.some(a => {
    const availStart = toMinutes(a.startTime);
    const availEnd = toMinutes(a.endTime);
    return requestedStart >= availStart && requestedStart <= availEnd;
  });
};

// Check availability WITH overrides for a specific date
// Override > default weekly schedule
export const isTimeSlotAvailableWithOverrides = (
  availability: Availability[],
  overrides: AvailabilityOverride[],
  therapistId: string,
  date: string,
  dayOfWeek: number,
  startTime: string,
  _endTime: string
): boolean => {
  // Sprawdź czy jest override na ten dzień
  const override = getOverrideForDate(overrides, therapistId, date);

  if (override) {
    // Override typu 'unavailable' — terapeuta nie pracuje
    if (override.type === 'unavailable') return false;

    // Override typu 'custom' — inne godziny
    if (override.type === 'custom' && override.startTime && override.endTime) {
      const requestedStart = toMinutes(startTime);
      const overrideStart = toMinutes(override.startTime);
      const overrideEnd = toMinutes(override.endTime);
      return requestedStart >= overrideStart && requestedStart <= overrideEnd;
    }
  }

  // Brak override → domyślna dostępność tygodniowa
  const therapistAvailability = availability.filter(a => a.therapistId === therapistId);
  return isTimeSlotAvailable(therapistAvailability, dayOfWeek, startTime, _endTime);
};

// Get available time slots for a therapist on a specific date
export const getAvailableTimeSlots = (
  availability: Availability[],
  dayOfWeek: number,
  slotDuration: number = 60
): { startTime: string; endTime: string }[] => {
  const activeAvailability = availability.filter(a => a.isActive && a.dayOfWeek === dayOfWeek);
  const slots: { startTime: string; endTime: string }[] = [];

  const toMinutes = (time: string): number => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  };

  const fromMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  activeAvailability.forEach(a => {
    let current = toMinutes(a.startTime);
    const end = toMinutes(a.endTime);

    while (current + slotDuration <= end) {
      slots.push({
        startTime: fromMinutes(current),
        endTime: fromMinutes(current + slotDuration),
      });
      current += slotDuration;
    }
  });

  return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
};
