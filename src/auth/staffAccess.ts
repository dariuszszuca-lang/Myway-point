export interface TherapistIdentity {
  id: string;
  name: string;
  active?: boolean;
}

export type StaffAccess =
  | { role: 'admin'; therapistId: null }
  | { role: 'therapist'; therapistId: string };

const THERAPIST_ACCOUNTS = new Map<string, string>([
  ['stanislaw.babinski@gmail.com', 'Stanisław Babiński'],
]);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const getTherapistNameForEmail = (email: string): string | null =>
  THERAPIST_ACCOUNTS.get(normalizeEmail(email)) ?? null;

export const resolveTherapistIdForEmail = (
  email: string,
  therapists: TherapistIdentity[],
): string | null => {
  const therapistName = getTherapistNameForEmail(email);
  if (!therapistName) return null;

  const matches = therapists.filter(
    therapist => therapist.name === therapistName && therapist.active !== false,
  );

  return matches.length === 1 ? matches[0].id : null;
};

export const resolveStaffAccess = (
  email: string,
  isAdmin: boolean,
  therapists: TherapistIdentity[],
): StaffAccess | null => {
  if (isAdmin) {
    return { role: 'admin', therapistId: null };
  }

  const therapistId = resolveTherapistIdForEmail(email, therapists);
  return therapistId ? { role: 'therapist', therapistId } : null;
};
