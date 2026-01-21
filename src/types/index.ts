export interface Therapist {
  id: string;
  name: string;
  specialization: string;
  color: string; // For calendar display
  avatar?: string;
}

export interface Patient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  totalSessions: number;
  usedSessions: number;
  sessionsHistory: string[]; // Session IDs
  notes?: string;
  createdAt: number;
  crmPatientId?: string; // Link to MyWay-CRM patient record
}

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show';

export interface Session {
  id: string;
  patientId: string;
  patientName: string; // Denormalized for quick display
  therapistId: string;
  therapistName: string; // Denormalized for quick display
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: SessionStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Availability {
  id: string;
  therapistId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isActive: boolean;
}

// For creating new sessions
export interface CreateSessionData {
  patientId: string;
  patientName: string;
  therapistId: string;
  therapistName: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

// Dashboard stats
export interface DashboardStats {
  todaySessions: number;
  weekSessions: number;
  totalPatients: number;
  completedThisMonth: number;
}

// Calendar view types
export interface CalendarDay {
  date: Date;
  sessions: Session[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

export interface TimeSlot {
  time: string; // HH:mm
  sessions: Session[];
}

// Default therapists for MyWay
export const DEFAULT_THERAPISTS: Omit<Therapist, 'id'>[] = [
  {
    name: 'Krystian Nagaba',
    specialization: 'Terapeuta uzależnień',
    color: '#0f766e', // teal
  },
  {
    name: 'Natalia Pucz',
    specialization: 'Terapeutka',
    color: '#7c3aed', // violet
  },
  {
    name: 'Waldemar Sikorski',
    specialization: 'Terapeuta uzależnień',
    color: '#ea580c', // orange
  },
];

// Domyślna liczba sesji w pakiecie
export const DEFAULT_SESSIONS_PACKAGE = 20;

// Working hours
export const WORKING_HOURS = {
  start: 8, // 8:00
  end: 22, // 22:00 - żeby pokazać slot 21:00 dla wieczornych sesji
  slotDuration: 30, // minutes - co pół godziny
};
