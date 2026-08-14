export type AppRole = 'admin' | 'therapist' | 'patient';

export interface RoleCapabilities {
  canViewSchedule: boolean;
  canBookSessions: boolean;
  canManageSessions: boolean;
  canAccessAdminPages: boolean;
}

const NO_ACCESS: RoleCapabilities = {
  canViewSchedule: false,
  canBookSessions: false,
  canManageSessions: false,
  canAccessAdminPages: false,
};

export const getRoleCapabilities = (role: AppRole | null): RoleCapabilities => {
  if (role === 'admin') {
    return {
      canViewSchedule: true,
      canBookSessions: true,
      canManageSessions: true,
      canAccessAdminPages: true,
    };
  }

  if (role === 'therapist') {
    return {
      canViewSchedule: true,
      canBookSessions: false,
      canManageSessions: false,
      canAccessAdminPages: false,
    };
  }

  if (role === 'patient') {
    return {
      canViewSchedule: true,
      canBookSessions: true,
      canManageSessions: false,
      canAccessAdminPages: false,
    };
  }

  return NO_ACCESS;
};

export const canLoadTherapistSchedule = (
  role: AppRole | null,
  therapistId: string | null,
): boolean => role === 'therapist' && Boolean(therapistId);
