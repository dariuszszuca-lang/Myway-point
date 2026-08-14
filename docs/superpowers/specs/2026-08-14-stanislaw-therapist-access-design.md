# MyWayPoint: dostęp terapeuty do własnych rezerwacji

Data: 2026-08-14

## Cel

Stanisław Babiński ma po zalogowaniu widzieć wyłącznie rezerwacje przypisane do jego aktualnego rekordu terapeuty. Nie otrzymuje dostępu administratora do wszystkich pacjentów, raportów ani ustawień.

## Potwierdzona przyczyna

Konto Stanisława istnieje w Firebase Auth i w kolekcji `users`, lecz ma rolę `patient` bez `patientId`. Jego rekord terapeuty jest aktywny, a wszystkie istniejące sesje wskazują aktualne `therapistId`. Błąd leży w modelu uprawnień i ścieżce ładowania danych, nie w rezerwacjach.

## Projekt

1. Rozszerzyć role użytkownika o `therapist` i dodać do dokumentu użytkownika pole `therapistId`.
2. Trzymać mały rejestr kont terapeutów jako mapowanie email → pełna nazwa terapeuty. Przy logowaniu wyszukać aktualny rekord terapeuty po nazwie, aby nie utrwalać zmiennego ID Firestore.
3. Automatycznie zmigrować istniejące konto Stanisława z `patient` do `therapist`, tylko gdy jego email znajduje się w rejestrze i znaleziono jednoznaczny aktywny rekord terapeuty.
4. Reguły Firestore pozwalają roli `therapist` czytać wyłącznie dokumenty `sessions`, których `therapistId` jest równe `users/{uid}.therapistId`. Terapeuta nie może zapisywać sesji ani czytać kolekcji `patients`.
5. Dashboard i kalendarz pobierają dla terapeuty tylko jego zakres dat. Widok ukrywa funkcje tworzenia, edycji i usuwania oraz strony administracyjne. Nagłówek pokazuje „Konto terapeuty”.

## Przepływ danych

Firebase Auth → `ensureUserExists` → rozpoznanie konta terapeuty → wyszukanie `therapists` po nazwie → zapis `role=therapist` i bieżącego `therapistId` → zapytanie `sessions` ograniczone do `therapistId` oraz zakresu dat → widok tylko do odczytu.

## Bezpieczeństwo i błędy

- Brak dopasowania terapeuty nie podnosi uprawnień; konto pozostaje bez dostępu do sesji i pokazuje czytelny komunikat.
- Więcej niż jeden rekord o tej samej nazwie blokuje automatyczne powiązanie zamiast wybierać losowy dokument.
- Identyfikator terapeuty jest odświeżany przy logowaniu, więc reset kolekcji nie zostawia starego powiązania.
- Reguły bazy, a nie sam interfejs, wymuszają ograniczenie do własnych sesji.
- Dane rezerwacji nie są migrowane ani modyfikowane.

## Testy i odbiór

- Test rozpoznania konta Stanisława jako terapeuty.
- Test powiązania po nazwie przy zmiennym `therapistId`.
- Test selektora sesji: własne sesje widoczne, cudze odfiltrowane.
- Test braku podniesienia uprawnień przy niejednoznacznym albo brakującym rekordzie.
- Test reguł Firestore w emulatorze: własna sesja do odczytu, cudza i kolekcja pacjentów odrzucone, zapis odrzucony.
- Pełny build i lint bez błędów.
- Po wdrożeniu: logowanie Stanisława, widok „Konto terapeuty”, trzy przyszłe aktywne rezerwacje oraz brak dostępu do tras administracyjnych.

## Wdrożenie i rollback

Najpierw wdrażane są reguły Firestore, potem frontend przez commit i push do aktywnego repo Vercel. Ostatni dobry commit przed zmianą: `d56a47a`. Rollback to przywrócenie poprzednich reguł i `git revert` commita frontendu.

AI_ACT_CHECK: NIE_DOTYCZY — zwykły deterministyczny system rezerwacji, bez funkcji AI i bez publikacji treści generowanej przez AI.
