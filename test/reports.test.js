import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReportStore,
  createSpinEvent,
  recordSpin,
  getReportDateKeys,
  summarizeReport,
  reportToCsv
} from '../public/js/reports.js';

function localTimestamp(year, monthIndex, day, hour = 12) {
  return new Date(year, monthIndex, day, hour, 0, 0, 0).getTime();
}

const bookPrize = {
  prizeId: 'book-25',
  type: 'book',
  offer: '25% off any book'
};

const partnerPrize = {
  prizeId: 'vendor-a-mug',
  type: 'partner',
  vendor: 'Vendor A',
  offer: 'Free rally mug'
};

test('Reports: createSpinEvent records only privacy-safe spin and prize fields', () => {
  const event = createSpinEvent({
    category: 'compliment',
    prize: partnerPrize,
    timestamp: localTimestamp(2026, 7, 19),
    id: 'spin-1',
    bookProvider: "Nomad's Edge Books"
  });

  assert.deepEqual(event, {
    id: 'spin-1',
    timestamp: localTimestamp(2026, 7, 19),
    dateKey: '2026-08-19',
    category: 'compliment',
    prize: {
      prizeId: 'vendor-a-mug',
      type: 'partner',
      provider: 'Vendor A',
      offer: 'Free rally mug'
    }
  });
  assert.equal('line' in event, false);
  assert.equal('visitor' in event, false);
  assert.throws(() => createSpinEvent({ category: 'other', timestamp: 1, id: 'bad' }), /category/i);
});

test('Reports: author awards default to Brian Smith - Author as provider', () => {
  const event = createSpinEvent({
    category: 'compliment',
    prize: bookPrize,
    timestamp: localTimestamp(2026, 7, 19),
    id: 'author-spin'
  });

  assert.equal(event.prize.provider, 'Brian Smith - Author');
});

test('Reports: historical author events migrate away from the old provider label', () => {
  const oldEvent = createSpinEvent({
    category: 'insult',
    prize: bookPrize,
    timestamp: localTimestamp(2026, 7, 19),
    id: 'old-author-spin',
    bookProvider: "Nomad's Edge Books"
  });

  const normalized = normalizeReportStore({ version: 1, events: [oldEvent] });
  assert.equal(normalized.events[0].prize.provider, 'Brian Smith - Author');
});

test('Reports: corrupt events are discarded and duplicate IDs are ignored', () => {
  const valid = createSpinEvent({
    category: 'insult',
    prize: null,
    timestamp: localTimestamp(2026, 7, 19),
    id: 'spin-1'
  });

  const normalized = normalizeReportStore({
    version: 999,
    events: [valid, null, { id: '', timestamp: 'bad' }, { ...valid }]
  });

  assert.equal(normalized.version, 1);
  assert.equal(normalized.events.length, 1);
  const afterDuplicate = recordSpin(normalized, valid);
  assert.equal(afterDuplicate.events.length, 1);

  const afterInvalidDirectRecord = recordSpin(afterDuplicate, {
    id: 'bad-direct',
    timestamp: Number.NaN,
    dateKey: 'not-a-date',
    category: 'compliment',
    prize: null
  });
  assert.equal(afterInvalidDirectRecord.events.length, 1);
});

test('Reports: summarizes Today, All Time, recorded dates, and prize-choice attribution', () => {
  let store = normalizeReportStore(null);
  const spins = [
    createSpinEvent({ category: 'compliment', prize: bookPrize, timestamp: localTimestamp(2026, 7, 19, 9), id: '1' }),
    createSpinEvent({ category: 'insult', prize: null, timestamp: localTimestamp(2026, 7, 19, 10), id: '2' }),
    createSpinEvent({ category: 'insult', prize: partnerPrize, timestamp: localTimestamp(2026, 7, 19, 11), id: '3' }),
    createSpinEvent({ category: 'compliment', prize: null, timestamp: localTimestamp(2026, 7, 20, 9), id: '4' }),
    createSpinEvent({ category: 'compliment', prize: bookPrize, timestamp: localTimestamp(2026, 7, 20, 10), id: '5' })
  ];
  for (const spin of spins) store = recordSpin(store, spin);

  assert.deepEqual(getReportDateKeys(store), ['2026-08-20', '2026-08-19']);

  const all = summarizeReport(store, 'all', new Date(2026, 7, 20, 12));
  assert.equal(all.spins, 5);
  assert.equal(all.compliments, 3);
  assert.equal(all.insults, 2);
  assert.equal(all.complimentPercent, 60);
  assert.equal(all.insultPercent, 40);
  assert.equal(all.prizes, 3);
  assert.equal(all.noPrize, 2);
  assert.equal(all.prizeRate, 60);
  assert.deepEqual(all.prizesByChoice, { compliment: 2, insult: 1 });
  assert.deepEqual(all.breakdown.map(row => ({
    prizeId: row.prizeId,
    wins: row.wins,
    compliment: row.compliment,
    insult: row.insult
  })), [
    { prizeId: 'book-25', wins: 2, compliment: 2, insult: 0 },
    { prizeId: 'vendor-a-mug', wins: 1, compliment: 0, insult: 1 }
  ]);

  const today = summarizeReport(store, 'today', new Date(2026, 7, 20, 12));
  assert.equal(today.spins, 2);
  assert.equal(today.compliments, 2);
  assert.equal(today.insults, 0);
  assert.equal(today.complimentPercent, 100);
  assert.equal(today.prizes, 1);
  assert.equal(today.prizeRate, 50);

  const firstDay = summarizeReport(store, '2026-08-19', new Date(2026, 7, 20, 12));
  assert.equal(firstDay.spins, 3);
  assert.equal(firstDay.prizes, 2);
});

test('Reports: empty summaries contain finite zero metrics', () => {
  const summary = summarizeReport(null, 'today', new Date(2026, 7, 20, 12));
  for (const field of ['spins', 'compliments', 'insults', 'complimentPercent', 'insultPercent', 'prizes', 'noPrize', 'prizeRate']) {
    assert.equal(summary[field], 0, `${field} should be zero`);
  }
  assert.deepEqual(summary.breakdown, []);
});

test('Reports: CSV exports one row per spin and neutralizes spreadsheet formulas', () => {
  const dangerous = createSpinEvent({
    category: 'insult',
    prize: {
      prizeId: 'danger',
      type: 'partner',
      vendor: '=HYPERLINK("bad")',
      offer: '+1 dangerous offer'
    },
    timestamp: localTimestamp(2026, 7, 19),
    id: 'csv-1'
  });
  const csv = reportToCsv(recordSpin(null, dangerous));

  assert.match(csv, /^timestamp,local_date,preference,won_prize,prize_type,prize_id,provider,offer\r?\n/);
  assert.equal(csv.trim().split(/\r?\n/).length, 2);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'+1 dangerous offer"));
  assert.ok(csv.includes(new Date(dangerous.timestamp).toISOString()));
  assert.ok(!csv.includes(',=HYPERLINK'));
});

test('Reports: CSV neutralizes formulas hidden behind tab or carriage-return prefixes', () => {
  const event = createSpinEvent({
    category: 'compliment',
    prize: {
      prizeId: 'prefixed-danger',
      type: 'partner',
      vendor: '\t=1+1',
      offer: '\r@SUM(1,1)'
    },
    timestamp: localTimestamp(2026, 7, 19),
    id: 'csv-prefixed'
  });
  const csv = reportToCsv(recordSpin(null, event));

  assert.ok(csv.includes("'\t=1+1"));
  assert.ok(csv.includes("'\r@SUM"));
});

test('Reports: CSV neutralizes formulas hidden behind leading spaces', () => {
  const event = createSpinEvent({
    category: 'compliment',
    prize: {
      prizeId: 'space-prefixed-danger',
      type: 'partner',
      vendor: ' =1+1',
      offer: '   @SUM(1,1)'
    },
    timestamp: localTimestamp(2026, 7, 19),
    id: 'csv-space-prefixed'
  });
  const csv = reportToCsv(recordSpin(null, event));

  assert.ok(csv.includes("' =1+1"));
  assert.ok(csv.includes("'   @SUM"));
});
