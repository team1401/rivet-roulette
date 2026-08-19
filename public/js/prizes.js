/**
 * Normalizes book offers text by splitting it into non-empty, trimmed lines.
 * @param {string} text
 * @returns {string[]}
 */
export function normalizeBookOffers(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Normalizes partner list by ensuring correct types and defaults.
 * @param {Array} partners
 * @returns {Object[]}
 */
export function normalizePartners(partners) {
  if (!Array.isArray(partners)) return [];
  return partners.map(p => {
    if (!p || typeof p !== 'object') {
      return { vendor: '', offer: '', inventory: 0 };
    }
    const vendor = typeof p.vendor === 'string' ? p.vendor.trim() : '';
    const offer = typeof p.offer === 'string' ? p.offer.trim() : '';
    const rawInventory = Number(p.inventory);
    const inventory = Number.isInteger(rawInventory) && rawInventory >= 0 ? rawInventory : 0;
    return { vendor, offer, inventory };
  });
}

/**
 * Normalizes the entire prize configuration.
 * @param {Object} config
 * @returns {Object}
 */
export function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    return {
      bookChance: 0,
      partnerChance: 0,
      bookOffers: [],
      partners: []
    };
  }
  const rawBookChance = Number(config.bookChance);
  const bookChance = Number.isInteger(rawBookChance) && rawBookChance >= 0 && rawBookChance <= 100 ? rawBookChance : 0;

  const rawPartnerChance = Number(config.partnerChance);
  const partnerChance = Number.isInteger(rawPartnerChance) && rawPartnerChance >= 0 && rawPartnerChance <= 100 ? rawPartnerChance : 0;

  const bookOffers = typeof config.bookOffers === 'string'
    ? normalizeBookOffers(config.bookOffers)
    : (Array.isArray(config.bookOffers)
      ? config.bookOffers
        .filter(offer => typeof offer === 'string')
        .map(offer => offer.trim())
        .filter(Boolean)
      : []);

  const partners = normalizePartners(config.partners);

  return {
    bookChance,
    partnerChance,
    bookOffers,
    partners
  };
}

/**
 * Validates the prize configuration.
 * @param {Object} config - Config to validate.
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object.');
    return { valid: false, errors };
  }

  const bookChance = Number(config.bookChance);
  const partnerChance = Number(config.partnerChance);

  if (!Number.isInteger(bookChance) || bookChance < 0 || bookChance > 100) {
    errors.push('Book chance must be an integer between 0 and 100.');
  }

  if (!Number.isInteger(partnerChance) || partnerChance < 0 || partnerChance > 100) {
    errors.push('Partner chance must be an integer between 0 and 100.');
  }

  if (Number.isInteger(bookChance) && Number.isInteger(partnerChance)) {
    if (bookChance + partnerChance > 100) {
      errors.push('Combined chance must be between 0 and 100.');
    }
  }

  if (Number.isInteger(bookChance) && bookChance > 0) {
    const offers = typeof config.bookOffers === 'string'
      ? normalizeBookOffers(config.bookOffers)
      : normalizeConfig(config).bookOffers;
    if (offers.length === 0) {
      errors.push('Add at least one book offer when Book Chance is above 0%.');
    }
  }

  if (Number.isInteger(partnerChance) && partnerChance > 0) {
    if (!Array.isArray(config.partners) || config.partners.length === 0) {
      errors.push('Add at least one partner when Partner Chance is above 0%.');
    }
  }

  if (config.partners && Array.isArray(config.partners)) {
    config.partners.forEach((p, idx) => {
      if (!p || typeof p !== 'object') {
        errors.push(`Partner row ${idx + 1}: Invalid partner format.`);
        return;
      }
      const vendor = typeof p.vendor === 'string' ? p.vendor.trim() : '';
      const offer = typeof p.offer === 'string' ? p.offer.trim() : '';
      const inventory = Number(p.inventory);

      if (!vendor) {
        errors.push(`Partner row ${idx + 1}: Vendor name is required.`);
      }
      if (!offer) {
        errors.push(`Partner row ${idx + 1}: Offer text is required.`);
      }
      if (!Number.isInteger(inventory) || inventory < 0) {
        errors.push(`Partner row ${idx + 1}: Inventory must be a non-negative integer.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Filters partners list for eligible ones (non-empty vendor/offer and inventory > 0).
 * @param {Object[]} partners
 * @returns {Object[]}
 */
export function filterEligiblePartners(partners) {
  if (!Array.isArray(partners)) return [];
  return partners.map((p, originalIndex) => ({ ...p, originalIndex }))
    .filter(p => {
      const vendor = (p.vendor || '').trim();
      const offer = (p.offer || '').trim();
      return vendor.length > 0 && offer.length > 0 && Number.isInteger(p.inventory) && p.inventory > 0;
    });
}

/**
 * Selects a prize deterministically using the injected randomInt function.
 * @param {Object} config - The normalized config.
 * @param {Function} randomInt - Random number generator returning [0, max).
 * @returns {Object|null} Selected prize description or null.
 */
export function selectPrize(config, randomInt) {
  const norm = normalizeConfig(config);
  if (norm.bookChance + norm.partnerChance > 100) return null;
  const roll = randomInt(100); // Roll in [0, 99]

  if (roll < norm.bookChance) {
    if (norm.bookOffers.length === 0) {
      return null;
    }
    const idx = randomInt(norm.bookOffers.length);
    return {
      type: 'book',
      offer: norm.bookOffers[idx]
    };
  } else if (roll < norm.bookChance + norm.partnerChance) {
    const eligible = filterEligiblePartners(norm.partners);
    if (eligible.length === 0) {
      return null;
    }
    const idx = randomInt(eligible.length);
    const partner = eligible[idx];
    return {
      type: 'partner',
      vendor: partner.vendor,
      offer: partner.offer,
      partnerIndex: partner.originalIndex
    };
  }

  return null;
}

/**
 * Decrements the inventory of a partner at the given index.
 * Ensures the inventory does not go negative.
 * @param {Object[]} partners
 * @param {number} partnerIndex
 * @returns {Object[]}
 */
export function decrementPartnerInventory(partners, partnerIndex) {
  if (!Array.isArray(partners)) return [];
  return partners.map((p, idx) => {
    if (idx === partnerIndex) {
      const inventory = Number.isInteger(p.inventory) ? p.inventory : 0;
      return {
        ...p,
        inventory: Math.max(0, inventory - 1)
      };
    }
    return p;
  });
}
