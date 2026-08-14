export interface TherapistIdentity {
  id: string;
  name: string;
  active?: boolean;
}

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
