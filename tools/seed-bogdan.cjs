#!/usr/bin/env node
/**
 * Seed Bogdana Mikolajczewskiego do MyWayPoint
 *
 * Co robi:
 * 1. Loguje admin (email + haslo z prompta)
 * 2. Sprawdza czy Bogdan istnieje w `therapists` (po nazwie). Jesli nie - dodaje
 * 3. Dodaje 13 override'ow `availability_overrides` na maj 2026
 *    (4 dni z dwoma blokami + 5 dni z jednym blokiem)
 *
 * Idempotent: ponowne uruchomienie nie duplikuje danych.
 *
 * Uruchom:
 *   cd MyWayPoint-Rezerwacje
 *   node tools/seed-bogdan.cjs
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { Writable } = require('stream');

// Wczytaj .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Brak pliku .env.local w katalogu projektu');
  process.exit(1);
}
fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const BOGDAN = {
  name: 'Bogdan Mikołajczewski',
  specialization: 'Terapeuta uzależnień',
  color: '',
};

// 9 dni, 13 blokow
const SCHEDULE = [
  { date: '2026-05-11', blocks: [['12:00', '14:00'], ['17:00', '20:00']] },
  { date: '2026-05-12', blocks: [['10:00', '15:00']] },
  { date: '2026-05-13', blocks: [['10:00', '13:00'], ['17:00', '20:00']] },
  { date: '2026-05-14', blocks: [['12:00', '16:00']] },
  { date: '2026-05-15', blocks: [['10:00', '15:00']] },
  { date: '2026-05-26', blocks: [['10:00', '15:00']] },
  { date: '2026-05-27', blocks: [['10:00', '15:00'], ['17:00', '20:00']] },
  { date: '2026-05-28', blocks: [['12:00', '16:00']] },
  { date: '2026-05-29', blocks: [['10:00', '15:00'], ['17:00', '20:00']] },
];

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const muted = new Writable({
      write(chunk, _enc, cb) {
        if (!muted.muted) process.stdout.write(chunk);
        cb();
      },
    });
    muted.muted = false;
    const rl = readline.createInterface({
      input: process.stdin,
      output: muted,
      terminal: true,
    });
    process.stdout.write(question);
    if (hidden) muted.muted = true;
    rl.question('', (answer) => {
      if (hidden) process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('Brak zmiennych VITE_FIREBASE_* w .env.local');
    process.exit(1);
  }

  console.log('\n=== SEED Bogdan Mikolajczewski - MyWayPoint ===');
  console.log(`Project: ${firebaseConfig.projectId}\n`);

  const email = await ask('Email admina (np. dariusz.szuca@gmail.com): ');
  const password = await ask('Haslo (niewidoczne podczas wpisywania): ', true);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('\nLoguje...');
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (err) {
    console.error('Blad logowania:', err.message);
    process.exit(1);
  }
  console.log('OK zalogowano\n');

  // 1. Therapist: Bogdan
  const therapistsRef = collection(db, 'therapists');
  const existing = await getDocs(query(therapistsRef, where('name', '==', BOGDAN.name)));
  let therapistId;
  if (!existing.empty) {
    therapistId = existing.docs[0].id;
    console.log(`Bogdan juz istnieje w bazie (id: ${therapistId}) - pomijam tworzenie`);
  } else {
    const docRef = await addDoc(therapistsRef, BOGDAN);
    therapistId = docRef.id;
    console.log(`Dodano Bogdana (id: ${therapistId})`);
  }

  // 2. Overrides
  const overridesRef = collection(db, 'availability_overrides');
  const existingOverridesSnap = await getDocs(
    query(overridesRef, where('therapistId', '==', therapistId)),
  );
  const existingOverrides = existingOverridesSnap.docs.map((d) => d.data());

  let added = 0;
  let skipped = 0;
  for (const day of SCHEDULE) {
    for (const [start, end] of day.blocks) {
      const dup = existingOverrides.find(
        (o) =>
          o.date === day.date &&
          o.startTime === start &&
          o.endTime === end &&
          o.type === 'custom',
      );
      if (dup) {
        console.log(`  - ${day.date} ${start}-${end}  istnieje, pomijam`);
        skipped++;
        continue;
      }
      await addDoc(overridesRef, {
        therapistId,
        date: day.date,
        type: 'custom',
        startTime: start,
        endTime: end,
        reason: 'Dyspozycja maj 2026',
      });
      console.log(`  + ${day.date} ${start}-${end}`);
      added++;
    }
  }

  console.log(`\nGotowe. Dodano: ${added}, pominieto: ${skipped}`);
  console.log('\nKolejne kroki:');
  console.log('1. Bogdan zaklada konto: aplikacja - Stworz konto - email b.mikolajczewski@wp.pl + haslo.');
  console.log('2. Po pierwszym zalogowaniu automatycznie dostanie role admin.');
  console.log('3. Kalendarz juz pokaze jego dyspozycje na maj 2026.\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Blad:', err);
  process.exit(1);
});
