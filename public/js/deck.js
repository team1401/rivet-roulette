// Rivet Roulette deck manager.
// Implements secure random choice, Fisher-Yates shuffle, and no-repeat logic.

/**
 * Generates a cryptographically secure random integer in the range [0, max)
 * using rejection sampling to eliminate modulo bias.
 * @param {number} max
 * @returns {number}
 */
export function getRandomInt(max) {
  if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) {
    throw new RangeError('max must be an integer between 1 and 2^32');
  }
  if (max === 1) return 0;

  const range = 0x100000000;
  const rejectionLimit = range - (range % max);
  const array = new Uint32Array(1);

  do {
    globalThis.crypto.getRandomValues(array);
  } while (array[0] >= rejectionLimit);

  return array[0] % max;
}

/**
 * Performs a Fisher-Yates shuffle on an array in-place.
 * @param {Array} array
 * @returns {Array}
 */
export function shuffle(array, randomInt = getRandomInt) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

/**
 * Generates a new shuffled round of indices.
 * @param {Array} items
 * @param {string|null} lastDrawnItem
 * @returns {number[]}
 */
export function generateNewRound(items, lastDrawnItem, randomInt = getRandomInt) {
  const indices = Array.from({ length: items.length }, (_, i) => i);
  shuffle(indices, randomInt);

  if (lastDrawnItem && items[indices[0]] === lastDrawnItem && items.length > 1) {
    const swapIdx = 1 + randomInt(items.length - 1);
    const temp = indices[0];
    indices[0] = indices[swapIdx];
    indices[swapIdx] = temp;
  }

  return indices;
}

export class Deck {
  constructor(category, items, storageKey, randomInt = getRandomInt) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new TypeError('Deck requires at least one item');
    }
    this.category = category;
    this.items = items;
    this.storageKey = storageKey;
    this.randomInt = randomInt;
    this.shuffledIndices = [];
    this.currentIndex = 0;
    this.lastDrawnItem = null;

    this.load();
  }

  load() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = window.localStorage.getItem(this.storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          if (
            parsed &&
            Array.isArray(parsed.shuffledIndices) &&
            parsed.shuffledIndices.length === this.items.length &&
            parsed.shuffledIndices.every(idx => Number.isInteger(idx) && idx >= 0 && idx < this.items.length) &&
            new Set(parsed.shuffledIndices).size === this.items.length &&
            Number.isInteger(parsed.currentIndex) &&
            parsed.currentIndex >= 0 &&
            parsed.currentIndex <= this.items.length
          ) {
            this.shuffledIndices = parsed.shuffledIndices;
            this.currentIndex = parsed.currentIndex;
            this.lastDrawnItem = parsed.lastDrawnItem || null;
            return;
          }
        }
      }
    } catch (e) {
      // Fail silently and let reset recover
    }
    this.reset();
  }

  save() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const state = {
          shuffledIndices: this.shuffledIndices,
          currentIndex: this.currentIndex,
          lastDrawnItem: this.lastDrawnItem
        };
        window.localStorage.setItem(this.storageKey, JSON.stringify(state));
      }
    } catch (e) {
      // Fail silently
    }
  }

  reset() {
    this.shuffledIndices = generateNewRound(this.items, this.lastDrawnItem, this.randomInt);
    this.currentIndex = 0;
    this.save();
  }

  draw() {
    if (this.currentIndex >= this.shuffledIndices.length) {
      this.shuffledIndices = generateNewRound(this.items, this.lastDrawnItem, this.randomInt);
      this.currentIndex = 0;
    }

    const itemIdx = this.shuffledIndices[this.currentIndex];
    const item = this.items[itemIdx];
    this.currentIndex++;
    this.lastDrawnItem = item;
    this.save();
    return item;
  }
}
