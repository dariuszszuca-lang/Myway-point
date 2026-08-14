# MyWayPoint Therapist Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Give Stanisław Babiński read-only access to only the reservations assigned to his current therapist record.

**Architecture:** Add a dedicated therapist role and a small email-to-therapist-name registry. Resolve the current Firestore therapist ID by name on every login, enforce ownership in Firestore rules, and branch the existing dashboard/calendar loaders so therapist queries are scoped before data reaches the UI.

**Tech Stack:** React 18, TypeScript, Vite, Firebase Auth, Firestore, Node 24 built-in test runner, Firebase Rules Unit Testing 5.0.1, Firebase Emulator Suite.

---

## File map

- Create: src/auth/staffAccess.ts — pure therapist account registry and unique active therapist resolver.
- Create: src/auth/sessionAccess.ts — pure defensive filtering and therapist dashboard statistics.
- Create: tests/staffAccess.test.ts — role recognition and changing-ID regression tests.
- Create: tests/sessionAccess.test.ts — own-session and date-range regression tests.
- Create: tests/firestoreRules.test.mjs — emulator tests for migration, scoped reads, denied patient access and denied writes.
- Modify: src/services/userService.ts — add therapist role, resolve therapist by name and migrate the existing user at login.
- Modify: src/context/AuthContext.tsx — expose isTherapist.
- Modify: src/services/sessionService.ts — expose a rule-compatible therapist query.
- Modify: src/pages/DashboardPage.tsx — load only therapist sessions and hide admin/write controls.
- Modify: src/pages/CalendarPage.tsx — load only the therapist week, lock selection to self and block empty-slot writes.
- Modify: src/App.tsx — show the correct account label and keep admin routes inaccessible.
- Modify: firestore.rules — enforce therapist identity and row-level session reads.
- Modify: package.json and package-lock.json — add the test command and rules test dependency.

### Task 1: Pure therapist identity resolver

**Files:**
- Create: tests/staffAccess.test.ts
- Create: src/auth/staffAccess.ts
- Modify: package.json

- [ ] **Step 1: Add the failing identity tests**

~~~typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTherapistNameForEmail,
  resolveTherapistIdForEmail,
} from '../src/auth/staffAccess.ts';

test('recognizes Stanisław therapist account case-insensitively', () => {
  assert.equal(
    getTherapistNameForEmail('STANISLAW.BABINSKI@GMAIL.COM'),
    'Stanisław Babiński',
  );
});

test('resolves the current active therapist ID by name instead of a hardcoded ID', () => {
  const therapists = [
    { id: 'old-id', name: 'Waldemar Sikorski', active: true },
    { id: 'current-id', name: 'Stanisław Babiński', active: true },
  ];

  assert.equal(
    resolveTherapistIdForEmail('stanislaw.babinski@gmail.com', therapists),
    'current-id',
  );
});

test('refuses an ambiguous or inactive therapist match', () => {
  const duplicate = [
    { id: 'first', name: 'Stanisław Babiński', active: true },
    { id: 'second', name: 'Stanisław Babiński', active: true },
  ];
  const inactive = [
    { id: 'inactive', name: 'Stanisław Babiński', active: false },
  ];

  assert.equal(resolveTherapistIdForEmail('stanislaw.babinski@gmail.com', duplicate), null);
  assert.equal(resolveTherapistIdForEmail('stanislaw.babinski@gmail.com', inactive), null);
});
~~~

- [ ] **Step 2: Add the package test command**

~~~json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
  "preview": "vite preview",
  "test": "node --test tests/*.test.ts"
}
~~~

- [ ] **Step 3: Run RED**

Run: npm test

Expected: FAIL with ERR_MODULE_NOT_FOUND for src/auth/staffAccess.ts.

- [ ] **Step 4: Implement the smallest pure resolver**

~~~typescript
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
~~~

- [ ] **Step 5: Run GREEN**

Run: npm test

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

Run:

~~~bash
git add package.json src/auth/staffAccess.ts tests/staffAccess.test.ts
git commit -m "test: define therapist account resolution"
~~~

### Task 2: User role and login migration

**Files:**
- Modify: src/services/userService.ts
- Modify: src/context/AuthContext.tsx
- Modify: src/App.tsx

- [ ] **Step 1: Extend the user model**

Change UserRole to:

~~~typescript
export type UserRole = 'admin' | 'therapist' | 'patient';
~~~

Add this field to AppUser:

~~~typescript
therapistId: string | null;
~~~

- [ ] **Step 2: Resolve the current therapist record before assigning the role**

Add imports and the helper:

~~~typescript
import {
  getTherapistNameForEmail,
  resolveTherapistIdForEmail,
} from '../auth/staffAccess';

const findTherapistIdForEmail = async (email: string): Promise<string | null> => {
  const therapistName = getTherapistNameForEmail(email);
  if (!therapistName) return null;

  const therapistsRef = collection(db, 'therapists');
  const therapistQuery = query(therapistsRef, where('name', '==', therapistName));
  const snapshot = await getDocs(therapistQuery);
  const candidates = snapshot.docs.map(therapistDoc => ({
    id: therapistDoc.id,
    name: String(therapistDoc.data().name ?? ''),
    active: therapistDoc.data().active as boolean | undefined,
  }));

  return resolveTherapistIdForEmail(email, candidates);
};
~~~

- [ ] **Step 3: Migrate existing and new accounts deterministically**

At the start of ensureUserExists, after reading the user document, resolve:

~~~typescript
const normalizedEmail = email.toLowerCase();
const shouldBeAdmin = isAdminEmail(normalizedEmail);
const therapistId = shouldBeAdmin ? null : await findTherapistIdForEmail(normalizedEmail);
~~~

For an existing user, persist only changed identity fields:

~~~typescript
const identityUpdates: Partial<AppUser> = {};

if (shouldBeAdmin && existingUser.role !== 'admin') {
  identityUpdates.role = 'admin';
  identityUpdates.therapistId = null;
} else if (!shouldBeAdmin && therapistId) {
  if (existingUser.role !== 'therapist') identityUpdates.role = 'therapist';
  if (existingUser.therapistId !== therapistId) identityUpdates.therapistId = therapistId;
}

if (Object.keys(identityUpdates).length > 0) {
  await setDoc(userRef, identityUpdates, { merge: true });
  Object.assign(existingUser, identityUpdates);
}
~~~

For a new user, set all identity fields:

~~~typescript
const role: UserRole = shouldBeAdmin ? 'admin' : therapistId ? 'therapist' : 'patient';
const patientId = role === 'patient'
  ? (await findPatientByEmail(normalizedEmail))?.id ?? null
  : null;

const newUser: Omit<AppUser, 'uid'> = {
  email: normalizedEmail,
  displayName: displayName || null,
  role,
  patientId,
  therapistId,
  createdAt: Date.now(),
};
~~~

- [ ] **Step 4: Expose therapist state**

Add isTherapist to AuthContextType, its default, and the provider value:

~~~typescript
const isTherapist = role === 'therapist' && Boolean(appUser?.therapistId);
~~~

In MainLayout use:

~~~typescript
const { isAdmin, isTherapist, patientData, user } = useAuth();
~~~

Replace the non-admin account badge with:

~~~tsx
{!isAdmin && (
  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-medium">
    {isTherapist ? 'Konto terapeuty' : 'Konto pacjenta'}
  </span>
)}
~~~

- [ ] **Step 5: Verify types and existing tests**

Run: npm test && npm run build

Expected: identity tests pass and TypeScript build completes.

- [ ] **Step 6: Commit**

Run:

~~~bash
git add src/services/userService.ts src/context/AuthContext.tsx src/App.tsx
git commit -m "feat(auth): add therapist role and login linking"
~~~

### Task 3: Firestore least-privilege rules

**Files:**
- Modify: firestore.rules
- Create: tests/firestoreRules.test.mjs
- Modify: package.json
- Modify mechanically: package-lock.json

- [ ] **Step 1: Install the compatible test dependency**

Run: npm install --save-dev @firebase/rules-unit-testing@5.0.1

Expected: package.json and package-lock.json record version 5.0.1.

- [ ] **Step 2: Add emulator tests before changing rules**

The test environment seeds one active therapist, one own session, one foreign session and one patient. It must assert:

~~~javascript
await assertSucceeds(getDoc(doc(therapistDb, 'sessions/own-session')));
await assertFails(getDoc(doc(therapistDb, 'sessions/foreign-session')));
await assertFails(getDoc(doc(therapistDb, 'patients/patient-1')));
await assertFails(updateDoc(doc(therapistDb, 'sessions/own-session'), {
  status: 'completed',
  updatedAt: 2,
}));
~~~

It must also seed the account as patient and prove that only the known email can perform:

~~~javascript
await assertSucceeds(setDoc(doc(therapistDb, 'users/therapist-user'), {
  role: 'therapist',
  therapistId: 'therapist-current',
}, { merge: true }));
~~~

The same update from other@example.com must use assertFails.

- [ ] **Step 3: Download a temporary local JRE and run RED**

Run:

~~~bash
curl -fL 'https://api.adoptium.net/v3/binary/latest/21/ga/mac/aarch64/jre/hotspot/normal/eclipse' -o /tmp/mywaypoint-temurin-jre21.tar.gz
mkdir -p /tmp/mywaypoint-temurin-jre21
tar -xzf /tmp/mywaypoint-temurin-jre21.tar.gz --strip-components=1 -C /tmp/mywaypoint-temurin-jre21
PATH="/tmp/mywaypoint-temurin-jre21/Contents/Home/bin:$PATH" firebase emulators:exec --only firestore --project demo-myway-point "node --test tests/firestoreRules.test.mjs"
~~~

Expected: FAIL because the current rules do not recognize role therapist.

- [ ] **Step 4: Add rule helpers and allowed user fields**

Add therapistId to validUserKeys. Add:

~~~text
function isKnownTherapistEmail() {
  return hasAuthEmail() && authEmail() == 'stanislaw.babinski@gmail.com';
}

function requestedTherapistId() {
  return request.resource.data.get('therapistId', null);
}

function validTherapistLink() {
  let therapistId = requestedTherapistId();
  return isKnownTherapistEmail() &&
    therapistId is string &&
    get(/databases/$(database)/documents/therapists/$(therapistId)).data.name == 'Stanisław Babiński' &&
    get(/databases/$(database)/documents/therapists/$(therapistId)).data.get('active', true) != false;
}

function isTherapist() {
  return isAuthenticated() &&
    signedInUser().role == 'therapist' &&
    signedInUser().get('therapistId', null) is string;
}
~~~

Extend validUserCreate with a therapist branch, allow patient-to-therapist promotion only for validTherapistLink, allow therapistId in owner updates, and require therapistId to be null for admin/patient identities.

- [ ] **Step 5: Scope session reads**

Inside sessions add:

~~~text
allow read: if isTherapist() &&
  resource.data.therapistId == signedInUser().get('therapistId', null);
~~~

Do not add therapist writes to sessions, patients, availability or overrides.

- [ ] **Step 6: Run GREEN**

Run:

~~~bash
PATH="/tmp/mywaypoint-temurin-jre21/Contents/Home/bin:$PATH" firebase emulators:exec --only firestore --project demo-myway-point "node --test tests/firestoreRules.test.mjs"
~~~

Expected: migration, own-read and all denial assertions pass.

- [ ] **Step 7: Commit**

Run:

~~~bash
git add firestore.rules package.json package-lock.json tests/firestoreRules.test.mjs
git commit -m "test(rules): enforce therapist-only session reads"
~~~

### Task 4: Therapist session selection

**Files:**
- Create: tests/sessionAccess.test.ts
- Create: src/auth/sessionAccess.ts
- Modify: src/services/sessionService.ts

- [ ] **Step 1: Add failing session tests**

Test that selectTherapistSessions returns only matching therapistId, excludes cancelled items when requested and applies inclusive YYYY-MM-DD bounds. Use one own session, one foreign session and one cancelled own session.

- [ ] **Step 2: Run RED**

Run: npm test

Expected: FAIL with ERR_MODULE_NOT_FOUND for src/auth/sessionAccess.ts.

- [ ] **Step 3: Implement the pure selector**

~~~typescript
import type { Session } from '../types';

export interface SessionRange {
  startDate?: string;
  endDate?: string;
  includeCancelled?: boolean;
}

export const selectTherapistSessions = (
  sessions: Session[],
  therapistId: string,
  range: SessionRange = {},
): Session[] => sessions
  .filter(session => session.therapistId === therapistId)
  .filter(session => range.includeCancelled || session.status !== 'cancelled')
  .filter(session => !range.startDate || session.date >= range.startDate)
  .filter(session => !range.endDate || session.date <= range.endDate)
  .sort((left, right) =>
    (left.date + ' ' + left.startTime).localeCompare(right.date + ' ' + right.startTime)
  );
~~~

- [ ] **Step 4: Keep the Firestore query rule-compatible**

Keep getSessionsByTherapist scoped in Firestore with where therapistId == current ID, remove its cross-field orderBy, and sort the mapped result by date plus startTime locally. Do not replace it with getSessions or a client-only ownership filter.

- [ ] **Step 5: Run GREEN and commit**

Run: npm test

Expected: all pure tests pass.

Run:

~~~bash
git add src/auth/sessionAccess.ts src/services/sessionService.ts tests/sessionAccess.test.ts
git commit -m "test: scope therapist session selection"
~~~

### Task 5: Read-only therapist dashboard and calendar

**Files:**
- Modify: src/pages/DashboardPage.tsx
- Modify: src/pages/CalendarPage.tsx
- Modify: src/App.tsx

- [ ] **Step 1: Branch dashboard loading before privileged calls**

For isTherapist with a therapistId, call getSessionsByTherapist and getTherapists only. Filter today/week/month with selectTherapistSessions. Do not call getPatients or getDashboardStats.

- [ ] **Step 2: Remove therapist write affordances**

Keep New session and Plan session links for admins and patients, but hide them when isTherapist. Keep modal contact data, package editing, status changes, edit and delete under existing isAdmin guards. Hide the patient-renewal quick stats row and Manage therapists link unless isAdmin.

- [ ] **Step 3: Branch calendar loading**

For therapist:

~~~typescript
const therapistId = appUser?.therapistId;
if (isTherapist && therapistId) {
  const therapistSessions = await getSessionsByTherapist(therapistId);
  sessionsData = selectTherapistSessions(therapistSessions, therapistId, {
    startDate: weekStart,
    endDate: weekEnd,
    includeCancelled: true,
  });
}
~~~

Filter therapistsData to the same ID and set selectedTherapist to that ID. Do not call getPatients.

- [ ] **Step 4: Block therapist writes in event handlers**

Add an immediate return for isTherapist in openNewSessionModal, openOverrideModal, handleCreateSession, handleEditSession, handleStatusChange and handleDeleteSession. Hide empty-slot plus buttons and override controls for therapist accounts. Existing session cards still open the read-only view modal.

- [ ] **Step 5: Verify UI tests and build**

Run: npm test && npm run build

Expected: all tests pass and the strict TypeScript/Vite build produces dist. The repository's pre-existing lint script is outside this fix because the baseline has neither ESLint dependencies nor an ESLint configuration (decision approved 2026-08-14).

- [ ] **Step 6: Commit**

Run:

~~~bash
git add src/pages/DashboardPage.tsx src/pages/CalendarPage.tsx src/App.tsx
git commit -m "fix(rezerwacje): show therapist only own schedule"
~~~

### Task 6: Local security verification and production checkpoint

**Files:**
- Review: all changed files
- Update before push: docs/superpowers/plans/2026-08-14-stanislaw-therapist-access.md checkboxes

- [ ] **Step 1: Run the complete local gate**

Run:

~~~bash
npm test
PATH="/tmp/mywaypoint-temurin-jre21/Contents/Home/bin:$PATH" firebase emulators:exec --only firestore --project demo-myway-point "node --test tests/firestoreRules.test.mjs"
npm run build
git diff origin/main --check
git status --short --branch
~~~

Expected: all tests, emulator assertions and build pass; only intentional files differ from origin/main.

- [ ] **Step 2: Scan the staged diff for secrets**

Run:

~~~bash
git diff origin/main --check
git check-ignore '.env*'
~~~

Expected: the diff is structurally clean and env files are ignored. Run the repository pre-commit secret scanner during the commit; do not bypass it.

- [ ] **Step 3: Present the exact production change and wait for explicit approval**

Present: Firestore rules in myway-point-app, frontend main branch for mywaypoint.pl, no reservation writes, rollback commit d56a47a. Ask for approval to deploy PROD and migrate only the Stanisław user role.

### Task 7: Production deploy and end-to-end smoke

**Files:**
- Update: claude-shared/memory/project_mywaypoint_rezerwacje.md
- Update: _STAN.md

- [ ] **Step 1: Confirm targets and backups**

Verify project myway-point-app, current origin/main, Vercel project myway-point and the current user document. Save the original user role fields to a chmod-600 file under /tmp before migration.

- [ ] **Step 2: Deploy rules first**

Run:

~~~bash
firebase deploy --only firestore:rules --project myway-point-app
~~~

Expected: rules compile and deploy successfully.

- [ ] **Step 3: Push the reviewed branch to production main**

Run:

~~~bash
git fetch origin
git rebase origin/main
git push origin HEAD:main
~~~

Expected: push succeeds without force and Vercel starts the myway-point deployment.

- [ ] **Step 4: Perform controlled account migration and live rule smoke**

Using a temporary custom Firebase token for the existing Stanisław UID, execute the same role update as login: role therapist plus the current therapistId. Then query sessions with where therapistId == current ID. Expected: 7 matching sessions total, including 3 future active sessions. A read of a foreign session and patients/patient-1 must be denied. Do not print the token or patient data.

- [ ] **Step 5: Verify Vercel production**

Poll until the newest myway-point deployment is Ready. Then run:

~~~bash
curl -fsSI https://mywaypoint.pl/login
curl -fsS https://mywaypoint.pl/login | rg '<script[^>]+src='
~~~

Expected: HTTP 200, text/html, and the deployed bundle is present.

- [ ] **Step 6: Record the result**

Update project_mywaypoint_rezerwacje.md with the root cause, therapist role, Firestore ownership rule, tests and deployed commit. Add a concise MyWay entry to _STAN.md with AI_ACT_CHECK = NIE_DOTYCZY. These files live in the AITeam workspace outside the MyWayPoint Git worktree, so do not mix them into the application commit.

- [ ] **Step 7: Final verification**

Run:

~~~bash
git status --short --branch
git log --oneline -7
curl -fsSI https://mywaypoint.pl/login
~~~

Expected: clean branch, origin/main contains the fix, and production returns HTTP 200.
