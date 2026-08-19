import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeConfig,
  validateConfig,
  createDailySchedule,
  claimDuePrize,
  countAwardedByPrize,
  reconcileDailySchedule
} from '../public/js/prizes.js';

const baseConfig = {
  openingTime: '08:00',
  closingTime: '17:00',
  awards: [
    { id: 'book-1', offer: '20% off any book', dailyQuantity: 3 }
  ],
  partners: [
    { id: 'vendor-a', vendor: 'Vendor A', offer: 'Rally mug', dailyQuantity: 2 }
  ]
};

const localDate = (hour, minute = 0) => new Date(2026, 7, 19, hour, minute, 0, 0);
const zeroRandom = () => 0;
const maxRandom = upperBound => Math.max(0, upperBound - 1);

test('Daily prizes: normalizes the new daily schedule configuration', () => {
  const normalized = normalizeConfig({
    openingTime: '08:00',
    closingTime: '17:00',
    awards: [{ id: ' mine ', offer: '  Free bookmark ', dailyQuantity: '4' }],
    partners: [{ id: ' v-a ', vendor: ' Vendor A ', offer: ' Mug ', dailyQuantity: '3' }]
  });

  assert.equal(normalized.openingTime, '08:00');
  assert.equal(normalized.closingTime, '17:00');
  assert.deepEqual(normalized.awards, [
    { id: 'mine', offer: 'Free bookmark', dailyQuantity: 4 }
  ]);
  assert.deepEqual(normalized.partners, [
    { id: 'v-a', vendor: 'Vendor A', offer: 'Mug', dailyQuantity: 3 }
  ]);
});

test('Daily prizes: migrates legacy inventory without enabling unlimited legacy book offers', () => {
  const normalized = normalizeConfig({
    bookOffers: ['10% off', 'Free bookmark'],
    partners: [{ vendor: 'Vendor A', offer: 'Mug', inventory: 3 }]
  });

  assert.equal(normalized.openingTime, '08:00');
  assert.equal(normalized.closingTime, '17:00');
  assert.equal(normalized.awards.length, 2);
  assert.ok(normalized.awards.every(item => item.dailyQuantity === 0));
  assert.equal(normalized.partners[0].dailyQuantity, 3);
});

test('Daily prizes: validates hours, quantities, and required fields', () => {
  const result = validateConfig({
    openingTime: '17:00',
    closingTime: '08:00',
    awards: [{ id: 'a', offer: '', dailyQuantity: 1.5 }],
    partners: [{ id: 'p', vendor: '', offer: '', dailyQuantity: -1 }]
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('Closing time')));
  assert.ok(result.errors.some(error => error.includes('Award row 1: Offer text')));
  assert.ok(result.errors.some(error => error.includes('Award row 1: Prizes per day')));
  assert.ok(result.errors.some(error => error.includes('Partner row 1: Vendor name')));
  assert.ok(result.errors.some(error => error.includes('Partner row 1: Offer text')));
  assert.ok(result.errors.some(error => error.includes('Partner row 1: Prizes per day')));
});

test('Daily prizes: creates one token per prize and stratifies the combined pool across the day', () => {
  const schedule = createDailySchedule(baseConfig, localDate(7), zeroRandom);

  assert.equal(schedule.dateKey, '2026-08-19');
  assert.equal(schedule.slots.length, 5);
  assert.equal(schedule.awarded.length, 0);
  assert.equal(new Set(schedule.slots.map(slot => slot.id)).size, 5);

  assert.equal(schedule.slots.filter(slot => slot.prizeId === 'book-1').length, 3);
  assert.equal(schedule.slots.filter(slot => slot.prizeId === 'vendor-a').length, 2);
  assert.deepEqual(
    schedule.slots.map(slot => slot.releaseAt),
    [localDate(8).getTime(), localDate(9, 48).getTime(), localDate(11, 36).getTime(), localDate(13, 24).getTime(), localDate(15, 12).getTime()]
  );
  assert.ok(schedule.slots.every(slot => slot.releaseAt >= schedule.opensAt && slot.releaseAt < schedule.closesAt));
});

test('Daily prizes: fifty awards configured at 1:10 PM release the first token within one minute', () => {
  const config = {
    openingTime: '08:00',
    closingTime: '17:00',
    awards: [{ id: 'author-award', offer: 'Signed book', dailyQuantity: 50 }],
    partners: []
  };
  const schedule = createDailySchedule(config, localDate(13, 10), maxRandom);

  assert.equal(schedule.slots.length, 50);
  assert.ok(schedule.slots[0].releaseAt < localDate(13, 11).getTime());
  assert.ok(claimDuePrize(schedule, localDate(13, 11).getTime()).prize);
});

test('Daily prizes: awards only one earliest due token per spin and never after closing', () => {
  let schedule = createDailySchedule(baseConfig, localDate(7), zeroRandom);

  let result = claimDuePrize(schedule, localDate(7, 59).getTime());
  assert.equal(result.prize, null);

  result = claimDuePrize(schedule, localDate(12).getTime());
  assert.ok(result.prize);
  assert.equal(result.schedule.awarded.length, 1);
  assert.equal(result.schedule.slots.length, 4);
  schedule = result.schedule;

  result = claimDuePrize(schedule, localDate(12).getTime());
  assert.ok(result.prize, 'A second overdue token may be claimed only by a second spin');
  assert.equal(result.schedule.awarded.length, 2);
  schedule = result.schedule;

  result = claimDuePrize(schedule, localDate(17).getTime());
  assert.equal(result.prize, null, 'Closing time is exclusive for prize claims');
  assert.equal(result.schedule.awarded.length, 2);
});

test('Daily prizes: reconciling changed settings preserves awarded counts', () => {
  let schedule = createDailySchedule(baseConfig, localDate(7), zeroRandom);
  let claimed = claimDuePrize(schedule, localDate(8).getTime());
  schedule = claimed.schedule;

  const awardedBefore = countAwardedByPrize(schedule);
  assert.equal(Object.values(awardedBefore).reduce((sum, value) => sum + value, 0), 1);

  const editedConfig = {
    ...baseConfig,
    awards: [{ ...baseConfig.awards[0], dailyQuantity: 4 }],
    partners: [...baseConfig.partners, { id: 'vendor-b', vendor: 'Vendor B', offer: 'Patch', dailyQuantity: 1 }]
  };
  const reconciled = reconcileDailySchedule(editedConfig, schedule, localDate(9), zeroRandom);

  assert.equal(reconciled.awarded.length, 1);
  assert.equal(reconciled.slots.filter(slot => slot.prizeId === claimed.prize.prizeId).length, 3,
    'Only the remaining quantity should be scheduled for the already-awarded prize type');
  assert.equal(reconciled.slots.filter(slot => slot.prizeId === 'vendor-b').length, 1);
});

test('Daily prizes: the same valid schedule is reused instead of rerolled', () => {
  const schedule = createDailySchedule(baseConfig, localDate(7), zeroRandom);
  const reconciled = reconcileDailySchedule(baseConfig, schedule, localDate(10), () => {
    throw new Error('Randomness must not be called when the existing schedule is valid');
  });
  assert.strictEqual(reconciled, schedule);
});

test('Daily prizes: migrates a same-day v1 schedule from now while preserving awarded history', () => {
  const config = {
    openingTime: '08:00',
    closingTime: '17:00',
    awards: [{ id: 'author-award', offer: 'Signed book', dailyQuantity: 50 }],
    partners: []
  };
  let legacy = createDailySchedule(config, localDate(7), zeroRandom);
  legacy = claimDuePrize(legacy, localDate(8).getTime()).schedule;
  legacy = { ...legacy, version: 1 };

  const migrated = reconcileDailySchedule(config, legacy, localDate(13, 10), maxRandom);

  assert.equal(migrated.version, 2);
  assert.equal(migrated.awarded.length, 1);
  assert.equal(migrated.slots.length, 49);
  assert.ok(migrated.slots[0].releaseAt >= localDate(13, 10).getTime());
  assert.ok(migrated.slots[0].releaseAt < localDate(13, 11).getTime());
});

test('Daily prizes: malformed persisted arrays recover instead of breaking claims', () => {
  const schedule = createDailySchedule(baseConfig, localDate(7), zeroRandom);
  const malformed = { ...schedule, slots: null, awarded: null };
  const recovered = reconcileDailySchedule(baseConfig, malformed, localDate(10), zeroRandom);

  assert.ok(Array.isArray(recovered.slots));
  assert.ok(Array.isArray(recovered.awarded));
  assert.equal(recovered.slots.length, 5);
  assert.doesNotThrow(() => claimDuePrize(recovered, localDate(10).getTime()));
});
