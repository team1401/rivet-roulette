import { getRandomInt } from './deck.js';

// Helper: Get local YYYY-MM-DD string
export function getDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper: Config signature
export function getConfigSignature(config) {
  // Use a stable stringified version of normalized config as signature
  return JSON.stringify(config);
}

// Helper: UUID or random ID generator
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    return {
      openingTime: '08:00',
      closingTime: '17:00',
      awards: [],
      partners: []
    };
  }

  const openingTime = typeof config.openingTime === 'string' ? config.openingTime.trim() : '08:00';
  const closingTime = typeof config.closingTime === 'string' ? config.closingTime.trim() : '17:00';

  const awards = [];
  if (Array.isArray(config.awards)) {
    config.awards.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `book-${idx}`;
        const offer = typeof item.offer === 'string' ? item.offer.trim() : '';
        const rawQty = Number(item.dailyQuantity);
        const dailyQuantity = Number.isInteger(rawQty) && rawQty >= 0 ? rawQty : 0;
        awards.push({ id, offer, dailyQuantity });
      }
    });
  } else {
    // Migrate legacy bookOffers
    let bookOffers = [];
    if (typeof config.bookOffers === 'string') {
      bookOffers = config.bookOffers
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } else if (Array.isArray(config.bookOffers)) {
      bookOffers = config.bookOffers
        .filter(offer => typeof offer === 'string')
        .map(offer => offer.trim())
        .filter(Boolean);
    }
    bookOffers.forEach((offer, idx) => {
      awards.push({
        id: `book-${idx}`,
        offer,
        dailyQuantity: 0
      });
    });
  }

  const partners = [];
  if (Array.isArray(config.partners)) {
    config.partners.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `partner-${idx}`;
        const vendor = typeof item.vendor === 'string' ? item.vendor.trim() : '';
        const offer = typeof item.offer === 'string' ? item.offer.trim() : '';
        const rawQty = item.dailyQuantity !== undefined ? Number(item.dailyQuantity) : Number(item.inventory);
        const dailyQuantity = Number.isInteger(rawQty) && rawQty >= 0 ? rawQty : 0;
        partners.push({ id, vendor, offer, dailyQuantity });
      }
    });
  }

  return {
    openingTime,
    closingTime,
    awards,
    partners
  };
}

export function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object.');
    return { valid: false, errors };
  }

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(config.openingTime)) {
    errors.push('Opening time must be in HH:MM format.');
  }
  if (!timeRegex.test(config.closingTime)) {
    errors.push('Closing time must be in HH:MM format.');
  }

  if (timeRegex.test(config.openingTime) && timeRegex.test(config.closingTime)) {
    const [oh, om] = config.openingTime.split(':').map(Number);
    const [ch, cm] = config.closingTime.split(':').map(Number);
    if (ch * 60 + cm <= oh * 60 + om) {
      errors.push('Closing time must be after opening time.');
    }
  }

  if (Array.isArray(config.awards)) {
    config.awards.forEach((item, idx) => {
      if (!item || typeof item !== 'object') {
        errors.push(`Award row ${idx + 1}: Invalid format.`);
        return;
      }
      const offer = typeof item.offer === 'string' ? item.offer.trim() : '';
      if (!offer) {
        errors.push(`Award row ${idx + 1}: Offer text is required.`);
      }
      const dailyQuantity = Number(item.dailyQuantity);
      if (!Number.isInteger(dailyQuantity) || dailyQuantity < 0) {
        errors.push(`Award row ${idx + 1}: Prizes per day must be a non-negative integer.`);
      }
    });
  }

  if (Array.isArray(config.partners)) {
    config.partners.forEach((item, idx) => {
      if (!item || typeof item !== 'object') {
        errors.push(`Partner row ${idx + 1}: Invalid format.`);
        return;
      }
      const vendor = typeof item.vendor === 'string' ? item.vendor.trim() : '';
      const offer = typeof item.offer === 'string' ? item.offer.trim() : '';
      if (!vendor) {
        errors.push(`Partner row ${idx + 1}: Vendor name is required.`);
      }
      if (!offer) {
        errors.push(`Partner row ${idx + 1}: Offer text is required.`);
      }
      const dailyQuantity = Number(item.dailyQuantity);
      if (!Number.isInteger(dailyQuantity) || dailyQuantity < 0) {
        errors.push(`Partner row ${idx + 1}: Prizes per day must be a non-negative integer.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function generateSlots(config, opensAt, closesAt, startMs, alreadyAwardedCounts, randomIntFn = getRandomInt) {
  const slots = [];
  const startSchedulingFrom = Math.max(opensAt, startMs);
  const remainingDuration = closesAt - startSchedulingFrom;

  // Process awards
  config.awards.forEach(award => {
    const awardedCount = alreadyAwardedCounts[award.id] || 0;
    const remainingQty = Math.max(0, award.dailyQuantity - awardedCount);
    if (remainingQty <= 0) return;

    for (let i = 0; i < remainingQty; i++) {
      let releaseAt;
      if (remainingDuration <= 0) {
        releaseAt = closesAt;
      } else {
        const bandStart = Math.floor(startSchedulingFrom + i * remainingDuration / remainingQty);
        const bandEnd = Math.floor(startSchedulingFrom + (i + 1) * remainingDuration / remainingQty);
        const bandSize = bandEnd - bandStart;
        const offset = bandSize > 0 ? randomIntFn(bandSize) : 0;
        releaseAt = bandStart + offset;
      }

      slots.push({
        id: `${award.id}-${i}-${generateUUID()}`,
        prizeId: award.id,
        type: 'book',
        offer: award.offer,
        releaseAt
      });
    }
  });

  // Process partners
  config.partners.forEach(partner => {
    const awardedCount = alreadyAwardedCounts[partner.id] || 0;
    const remainingQty = Math.max(0, partner.dailyQuantity - awardedCount);
    if (remainingQty <= 0) return;

    for (let i = 0; i < remainingQty; i++) {
      let releaseAt;
      if (remainingDuration <= 0) {
        releaseAt = closesAt;
      } else {
        const bandStart = Math.floor(startSchedulingFrom + i * remainingDuration / remainingQty);
        const bandEnd = Math.floor(startSchedulingFrom + (i + 1) * remainingDuration / remainingQty);
        const bandSize = bandEnd - bandStart;
        const offset = bandSize > 0 ? randomIntFn(bandSize) : 0;
        releaseAt = bandStart + offset;
      }

      slots.push({
        id: `${partner.id}-${i}-${generateUUID()}`,
        prizeId: partner.id,
        type: 'partner',
        vendor: partner.vendor,
        offer: partner.offer,
        releaseAt
      });
    }
  });

  // Sort slots by releaseAt ascending
  slots.sort((a, b) => a.releaseAt - b.releaseAt);
  return slots;
}

export function createDailySchedule(config, todayDateObj, randomIntFn = getRandomInt) {
  const norm = normalizeConfig(config);
  const dateKey = getDateKey(todayDateObj);
  const configSignature = getConfigSignature(norm);

  const [oh, om] = norm.openingTime.split(':').map(Number);
  const opensAt = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), todayDateObj.getDate(), oh, om, 0, 0).getTime();

  const [ch, cm] = norm.closingTime.split(':').map(Number);
  const closesAt = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), todayDateObj.getDate(), ch, cm, 0, 0).getTime();

  const slots = generateSlots(norm, opensAt, closesAt, todayDateObj.getTime(), {}, randomIntFn);

  return {
    version: 1,
    dateKey,
    configSignature,
    opensAt,
    closesAt,
    slots,
    awarded: []
  };
}

export function claimDuePrize(schedule, nowMs) {
  if (
    !schedule ||
    !Array.isArray(schedule.slots) ||
    !Array.isArray(schedule.awarded) ||
    !Number.isFinite(schedule.opensAt) ||
    !Number.isFinite(schedule.closesAt)
  ) {
    return { schedule, prize: null };
  }

  // Check bounds
  if (nowMs < schedule.opensAt || nowMs >= schedule.closesAt) {
    return { schedule, prize: null };
  }

  // Find the earliest due token
  // Since slots is sorted by releaseAt, the first one is the earliest.
  const candidate = schedule.slots[0];
  if (candidate && nowMs >= candidate.releaseAt) {
    const updatedSlots = schedule.slots.slice(1);
    const claimedToken = { ...candidate, awardedAt: nowMs };
    const updatedAwarded = [...schedule.awarded, claimedToken];

    const newSchedule = {
      ...schedule,
      slots: updatedSlots,
      awarded: updatedAwarded
    };

    return {
      schedule: newSchedule,
      prize: candidate
    };
  }

  return { schedule, prize: null };
}

export function countAwardedByPrize(schedule) {
  const counts = {};
  if (schedule && Array.isArray(schedule.awarded)) {
    for (const slot of schedule.awarded) {
      counts[slot.prizeId] = (counts[slot.prizeId] || 0) + 1;
    }
  }
  return counts;
}

export function reconcileDailySchedule(config, schedule, nowDateObj, randomIntFn = getRandomInt) {
  const norm = normalizeConfig(config);
  const currentDateKey = getDateKey(nowDateObj);
  const currentSignature = getConfigSignature(norm);

  if (
    schedule &&
    schedule.version === 1 &&
    schedule.dateKey === currentDateKey &&
    schedule.configSignature === currentSignature &&
    Array.isArray(schedule.slots) &&
    Array.isArray(schedule.awarded) &&
    Number.isFinite(schedule.opensAt) &&
    Number.isFinite(schedule.closesAt)
  ) {
    return schedule;
  }

  // Otherwise, we need to generate a new schedule or reconcile it.
  if (schedule && schedule.version === 1 && schedule.dateKey === currentDateKey) {
    const awarded = Array.isArray(schedule.awarded) ? schedule.awarded : [];
    const awardedCounts = countAwardedByPrize(schedule);

    const [oh, om] = norm.openingTime.split(':').map(Number);
    const opensAt = new Date(nowDateObj.getFullYear(), nowDateObj.getMonth(), nowDateObj.getDate(), oh, om, 0, 0).getTime();

    const [ch, cm] = norm.closingTime.split(':').map(Number);
    const closesAt = new Date(nowDateObj.getFullYear(), nowDateObj.getMonth(), nowDateObj.getDate(), ch, cm, 0, 0).getTime();

    const slots = generateSlots(norm, opensAt, closesAt, nowDateObj.getTime(), awardedCounts, randomIntFn);

    return {
      version: 1,
      dateKey: currentDateKey,
      configSignature: currentSignature,
      opensAt,
      closesAt,
      slots,
      awarded
    };
  } else {
    // New day or first time generating
    return createDailySchedule(config, nowDateObj, randomIntFn);
  }
}
