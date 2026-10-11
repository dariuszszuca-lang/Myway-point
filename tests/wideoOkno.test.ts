import test from 'node:test';
import assert from 'node:assert/strict';
import { chwilaWPolsce, godzinaOtwarcia, oknoWideo } from '../src/wideo/okno.ts';

const wizyta = { date: '2026-10-12', startTime: '16:00', endTime: '16:35' };

test('czas polski: lato +2, zima +1', () => {
  assert.equal(new Date(chwilaWPolsce('2026-07-01', '12:00')).toISOString(), '2026-07-01T10:00:00.000Z');
  assert.equal(new Date(chwilaWPolsce('2026-12-01', '12:00')).toISOString(), '2026-12-01T11:00:00.000Z');
});

test('okno wideo: 10 minut przed, 30 minut po końcu', () => {
  const start = chwilaWPolsce(wizyta.date, wizyta.startTime);
  const koniec = chwilaWPolsce(wizyta.date, wizyta.endTime);
  assert.equal(oknoWideo(wizyta, start - 11 * 60_000), 'za-wczesnie');
  assert.equal(oknoWideo(wizyta, start - 10 * 60_000), 'otwarte');
  assert.equal(oknoWideo(wizyta, koniec + 30 * 60_000), 'otwarte');
  assert.equal(oknoWideo(wizyta, koniec + 31 * 60_000), 'po-czasie');
});

test('godzina otwarcia pokoju', () => {
  assert.equal(godzinaOtwarcia(wizyta), '15:50');
});
