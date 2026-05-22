# Roadmapa MyWayPoint Rezerwacje

Data utworzenia: 2026-05-22  
Produkt: MyWayPoint Rezerwacje  
Produkcja: https://mywaypoint.pl  
Firebase project: `myway-point-app`

## Cel produktu

MyWayPoint Rezerwacje ma bezpiecznie obsługiwać zapisy pacjentów na sesje terapeutyczne, bez ryzyka podwójnych rezerwacji, wycieku danych pacjentów albo utraty dostępu dla zespołu MyWay.

Priorytet produktu:

1. Pacjenci mogą bez problemu rezerwować dostępne terminy.
2. Admini widzą pełny kalendarz i mogą zarządzać pacjentami, terapeutami oraz dostępnością.
3. Dane pacjentów są chronione zgodnie z logiką RODO: minimalny dostęp, brak cudzych danych w widoku pacjenta.
4. Zmiany produkcyjne są małe, odwracalne i testowane przed deployem.

## Stan aktualny

### Działa

- Logowanie przez Firebase Auth.
- Kalendarz rezerwacji tygodniowych.
- Panel admina z pacjentami, terapeutami, sesjami i raportami.
- Zarządzanie dostępnością tygodniową i jednorazową.
- Natalia Pucz jest przywrócona w danych, ale wyłączona z rezerwacji.
- Bogdan Mikołajczewski jest dodany jako terapeuta i ma wpisane jednorazowe terminy na maj 2026.
- Rezerwacje używają anonimowej kolekcji `booked_slots`, żeby pacjent nie musiał czytać cudzych pełnych rezerwacji.
- Reguły Firestore blokują samodzielne nadanie sobie roli admina.
- Pacjent może czytać pełne dokumenty `sessions` tylko dla swoich wizyt.

### Ostatnie ważne zmiany

- `3083065` - Natalia wyłączona bez psucia kalendarza.
- `352b9d4` - bezpieczne przywracanie brakujących terapeutów domyślnych.
- `b14b2f6` - dostępność Bogdana na maj 2026.
- `3e8995b` - widoczność jednorazowej dostępności terapeutów w panelu.
- `214d54a` - utwardzenie reguł Firestore dla ról i zapisów.
- `33f0f5d` - ochrona odczytu pełnych rezerwacji pacjentów przez `booked_slots`.

## Zasady pracy nad projektem

- Nie usuwać danych produkcyjnych bez osobnej, jasnej zgody.
- Najpierw robić kopię/backfill, potem zawężać reguły.
- Przy zmianach w Firestore Rules robić mały deploy reguł i smoke test.
- Nie zamykać odczytu ani zapisu, jeśli obecny frontend jeszcze tego potrzebuje.
- Każda zmiana dotycząca rezerwacji musi zachować:
  - tworzenie rezerwacji przez pacjenta,
  - widoczność swoich wizyt przez pacjenta,
  - pełny kalendarz admina,
  - blokadę podwójnej rezerwacji tego samego terapeuty w tym samym czasie.

## Teraz: najbliższy tydzień

| Priorytet | Zadanie | Po co | Właściciel | Szacowany effort |
|---|---|---|---|---|
| P0 | Testy reguł Firestore | Potwierdzić, że pacjent nie widzi cudzych `sessions`, nie robi sobie admina i nadal może rezerwować | CTO | 2-4h |
| P0 | Transakcyjna rezerwacja slotu | Zamknąć race condition: dwie osoby klikają ten sam termin naraz | CTO | 4-8h |
| P0 | Smoke test checklist przed deployem | Stała lista: login admin, login pacjent, rezerwacja, anulowanie, dostępność, raporty | COO/CTO | 1-2h |
| P1 | Backup Firestore | Ustawić regularny eksport albo ręczny proces przed większymi zmianami | CTO | 2-4h |
| P1 | Monitoring błędów rezerwacji | Alert na `permission-denied`, błędy zapisu sesji i błędy odczytu dostępności | CTO | 2-4h |

## Następne: 2-4 tygodnie

| Priorytet | Zadanie | Po co | Właściciel | Szacowany effort |
|---|---|---|---|---|
| P1 | Firebase Custom Claims dla adminów | Rola admina powinna wynikać z Auth, nie z dokumentu użytkownika | CTO | 4-8h |
| P1 | Firebase App Check | Ograniczyć dostęp do Firestore spoza aplikacji | CTO | 2-4h |
| P1 | Audit log działań admina | Wiedzieć kto zmienił sesję, pacjenta, dostępność, pakiet | CTO | 4-8h |
| P1 | Uporządkowanie dostępności terapeutów | Jeden stabilny flow: tygodniowa dostępność + wyjątki + podgląd w panelu | PM/CTO | 4-8h |
| P2 | Lepsze komunikaty błędów dla pacjenta | Mniej telefonów typu "nie działa rezerwacja" | PM/CTO | 2-4h |
| P2 | Instrukcja obsługi admina i terapeuty po zmianach | Zespół MyWay wie, co gdzie kliknąć | PM/COO | 2-4h |

## Później: ten kwartał

| Priorytet | Zadanie | Po co | Właściciel | Szacowany effort |
|---|---|---|---|---|
| P2 | E2E testy Playwright | Automatycznie sprawdzać krytyczne flow przed deployem | CTO | 6-12h |
| P2 | Cloud Function do zmian pakietów sesji | Nie liczyć wykorzystanych sesji po stronie klienta | CTO | 4-8h |
| P2 | Raporty operacyjne dla MyWay | Terapie per terapeuta, anulacje, no-show, obłożenie terminów | PM/CTO | 4-10h |
| P2 | Integracja z CRM/MyWay App | Jedno źródło pacjentów i pakietów sesji | PM/CTO | 1-3 dni |
| P3 | Powiadomienia email/SMS o rezerwacji | Mniej nieobecności i pomyłek | PM/CTO | 1-2 dni |
| P3 | Panel historii zmian pacjenta | Większa kontrola operacyjna i bezpieczeństwo | CTO | 4-8h |

## Icebox: dobre pomysły, ale nie teraz

- Publiczna rezerwacja bez konta.
- Lista oczekujących na zwolniony termin.
- Rezerwacje cykliczne.
- Integracja z Google Calendar.
- Eksport PDF/CSV raportów miesięcznych.
- Automatyczne przypomnienia WhatsApp.
- Panel dla terapeuty z własnym grafikiem.
- System zgód i dokumentów pacjenta.

## Ryzyka do pilnowania

### 1. Race condition przy rezerwacji

Obecnie frontend sprawdza zajętość przed zapisem, a `booked_slots` zmniejsza zakres danych dla pacjenta. To poprawia prywatność, ale nie jest jeszcze pełną blokadą transakcyjną. Docelowo rezerwacja powinna przejść przez Cloud Function albo transakcję Firestore.

### 2. Role adminów

Reguły blokują self-promote, ale docelowo role adminów powinny być w Firebase Auth Custom Claims. Firestore document może zostać wtedy pomocniczy, nie decyzyjny.

### 3. Dane medyczne i notatki

Każde pole w `patients`, `sessions`, notatkach i historii jest potencjalnie wrażliwe. Nowe funkcje muszą przechodzić przez zasadę minimalnego dostępu.

### 4. Brak automatycznych testów reguł

Każda zmiana Firestore Rules bez testów może przypadkiem:

- otworzyć cudze dane pacjentowi,
- zablokować pacjentom rezerwacje,
- zablokować adminom pracę.

## Checklist przed deployem

Przed zmianą produkcyjną:

- `git status --short` i sprawdzenie, które pliki są nasze.
- `npm run build` w kopii poza iCloud, jeśli build w iCloud wisi.
- Deploy Firestore Rules osobno, jeśli zmiana dotyczy reguł.
- Backfill danych przed zawężeniem reguł, jeśli frontend ma nowe kolekcje pomocnicze.
- Smoke test `https://mywaypoint.pl`.

Minimalny smoke test:

- Strona produkcyjna zwraca HTTP 200.
- Admin widzi kalendarz i terapeutów.
- Pacjent widzi swoje rezerwacje.
- Pacjent nie widzi cudzych pełnych sesji.
- Nowa rezerwacja tworzy wpis w `sessions` i `booked_slots`.
- Anulowanie wizyty aktualizuje `sessions` i `booked_slots`.

## Następny rekomendowany sprint

Sprint: Bezpieczeństwo rezerwacji V2  
Cel: zamknąć ostatnie największe ryzyko techniczne bez zmiany UX.

Zakres:

1. Testy Firestore Rules dla ról, pacjentów, `sessions`, `booked_slots`.
2. Cloud Function albo transakcja do atomowego tworzenia rezerwacji.
3. Checklist smoke testów w repo.
4. Krótka instrukcja rollbacku.

Nie robimy w tym sprincie:

- nowego UI,
- publicznej rezerwacji bez konta,
- dużej integracji z CRM,
- przypomnień SMS/email.

