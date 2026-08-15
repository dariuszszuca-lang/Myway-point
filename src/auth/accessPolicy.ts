export type AppRole = 'admin' | 'therapist' | 'patient';

export interface RoleCapabilities {
  canViewSchedule: boolean;
  canBookSessions: boolean;
  canManageSessions: boolean;
  canViewPatients: boolean;
  canManagePatients: boolean;
  canAccessAdminPages: boolean;
}

const NO_ACCESS: RoleCapabilities = {
  canViewSchedule: false,
  canBookSessions: false,
  canManageSessions: false,
  canViewPatients: false,
  canManagePatients: false,
  canAccessAdminPages: false,
};

export const getRoleCapabilities = (role: AppRole | null): RoleCapabilities => {
  if (role === 'admin') {
    return {
      canViewSchedule: true,
      canBookSessions: true,
      canManageSessions: true,
      canViewPatients: true,
      canManagePatients: true,
      canAccessAdminPages: true,
    };
  }

  if (role === 'therapist') {
    return {
      canViewSchedule: true,
      canBookSessions: false,
      canManageSessions: false,
      canViewPatients: true,
      canManagePatients: false,
      canAccessAdminPages: false,
    };
  }

  if (role === 'patient') {
    return {
      canViewSchedule: true,
      canBookSessions: true,
      canManageSessions: false,
      canViewPatients: false,
      canManagePatients: false,
      canAccessAdminPages: false,
    };
  }

  return NO_ACCESS;
};

export const canLoadTherapistSchedule = (
  role: AppRole | null,
  therapistId: string | null,
): boolean => role === 'therapist' && Boolean(therapistId);
