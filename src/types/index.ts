export interface Therapist {
  id: string;
  name: string;
  specialization: string;
}

export interface Patient {
  id: string;
  name: string;
  totalSessions: number;
  usedSessions: number;
  sessionsHistory: Session[];
}

export interface Session {
  id: string;
  patientId: string;
  therapistId: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface Availability {
  therapistId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}
