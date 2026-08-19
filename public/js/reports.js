// Pure reporting API for Rivet Roulette

// Helper: UUID or random ID generator
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Normalize a report store
export function normalizeReportStore(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      version: 1,
      events: []
    };
  }

  const events = [];
  const seenIds = new Set();

  if (Array.isArray(raw.events)) {
    for (const e of raw.events) {
      if (!e || typeof e !== 'object') continue;
      if (typeof e.id !== 'string' || e.id.trim() === '') continue;
      if (typeof e.timestamp !== 'number' || isNaN(e.timestamp) || e.timestamp <= 0) continue;
      if (e.category !== 'compliment' && e.category !== 'insult') continue;
      if (typeof e.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.dateKey)) continue;

      // Duplicate event IDs must not double count
      if (seenIds.has(e.id)) continue;

      let validPrize = null;
      if (e.prize !== null && typeof e.prize === 'object') {
        const pId = e.prize.prizeId || e.prize.id;
        const pType = e.prize.type;
        const pProvider = e.prize.provider || e.prize.vendor;
        const pOffer = e.prize.offer;

        if (typeof pId === 'string' && typeof pType === 'string' && typeof pOffer === 'string') {
          validPrize = {
            prizeId: pId,
            type: pType,
            provider: typeof pProvider === 'string' ? pProvider : '',
            offer: pOffer
          };
        }
      }

      seenIds.add(e.id);
      events.push({
        id: e.id,
        timestamp: e.timestamp,
        dateKey: e.dateKey,
        category: e.category,
        prize: validPrize
      });
    }
  }

  return {
    version: 1,
    events
  };
}

// Create a spin event
export function createSpinEvent({ category, prize, timestamp, id, bookProvider }) {
  if (category !== 'compliment' && category !== 'insult') {
    throw new Error('Invalid category: must be compliment or insult');
  }

  const ts = typeof timestamp === 'number' ? timestamp : Date.now();
  const eventId = typeof id === 'string' && id.trim() !== '' ? id : generateUUID();

  // Compute local YYYY-MM-DD
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  let mappedPrize = null;
  if (prize) {
    let provider = '';
    if (prize.type === 'book') {
      provider = bookProvider || "Nomad's Edge Books";
    } else {
      provider = prize.vendor || prize.provider || '';
    }

    mappedPrize = {
      prizeId: prize.prizeId || prize.id,
      type: prize.type,
      provider: provider,
      offer: prize.offer
    };
  }

  return {
    id: eventId,
    timestamp: ts,
    dateKey,
    category,
    prize: mappedPrize
  };
}

// Record a spin in the store
export function recordSpin(store, event) {
  const s = normalizeReportStore(store);
  const candidate = normalizeReportStore({ events: [event] }).events[0];
  if (!candidate) return s;

  // Check if duplicate ID
  if (s.events.some(e => e.id === candidate.id)) {
    return s;
  }

  return {
    version: 1,
    events: [...s.events, candidate]
  };
}

// Get all unique date keys in descending order (newest first)
export function getReportDateKeys(store) {
  const s = normalizeReportStore(store);
  const keys = s.events.map(e => e.dateKey).filter(Boolean);
  const uniqueKeys = Array.from(new Set(keys));
  uniqueKeys.sort((a, b) => b.localeCompare(a));
  return uniqueKeys;
}

// Summarize store based on scope and current date
export function summarizeReport(store, scope, nowDate) {
  const s = normalizeReportStore(store);
  const refDate = nowDate instanceof Date ? nowDate : new Date();

  // Compute local date key for today
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, '0');
  const d = String(refDate.getDate()).padStart(2, '0');
  const todayKey = `${y}-${m}-${d}`;

  let filtered = s.events;
  if (scope === 'today') {
    filtered = s.events.filter(e => e.dateKey === todayKey);
  } else if (scope !== 'all') {
    filtered = s.events.filter(e => e.dateKey === scope);
  }

  const spins = filtered.length;
  let compliments = 0;
  let insults = 0;
  let prizes = 0;

  const prizesByChoice = {
    compliment: 0,
    insult: 0
  };

  const breakdownMap = new Map();

  for (const e of filtered) {
    if (e.category === 'compliment') {
      compliments++;
      if (e.prize) prizesByChoice.compliment++;
    } else if (e.category === 'insult') {
      insults++;
      if (e.prize) prizesByChoice.insult++;
    }

    if (e.prize) {
      prizes++;
      const pId = e.prize.prizeId;
      if (!breakdownMap.has(pId)) {
        breakdownMap.set(pId, {
          prizeId: pId,
          provider: e.prize.provider,
          offer: e.prize.offer,
          type: e.prize.type,
          wins: 0,
          compliment: 0,
          insult: 0
        });
      }
      const row = breakdownMap.get(pId);
      row.wins++;
      if (e.category === 'compliment') {
        row.compliment++;
      } else if (e.category === 'insult') {
        row.insult++;
      }
    }
  }

  const complimentPercent = spins > 0 ? Math.round((compliments / spins) * 100) : 0;
  const insultPercent = spins > 0 ? Math.round((insults / spins) * 100) : 0;
  const noPrize = spins - prizes;
  const prizeRate = spins > 0 ? Math.round((prizes / spins) * 100) : 0;

  // Convert breakdown map to sorted array (sorted by wins descending)
  const breakdown = Array.from(breakdownMap.values()).sort((a, b) => b.wins - a.wins);

  return {
    spins,
    compliments,
    insults,
    complimentPercent,
    insultPercent,
    prizes,
    noPrize,
    prizeRate,
    prizesByChoice,
    breakdown
  };
}

// Escapes cell values for RFC 4180 CSV output and neutralizes formula injection
function escapeCsvCell(val) {
  let str = val === null || val === undefined ? '' : String(val);

  // Neutralize cells beginning with spreadsheet formula characters
  if (/^\s*[=\+\-@]/.test(str)) {
    str = "'" + str;
  }

  // If the cell contains quotes, commas, or newlines, wrap in quotes and escape quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

// Convert store to CSV string
export function reportToCsv(store) {
  const s = normalizeReportStore(store);
  const headers = ['timestamp', 'local_date', 'preference', 'won_prize', 'prize_type', 'prize_id', 'provider', 'offer'];
  const rows = [headers.join(',')];

  for (const e of s.events) {
    const row = [
      escapeCsvCell(new Date(e.timestamp).toISOString()),
      escapeCsvCell(e.dateKey),
      escapeCsvCell(e.category),
      escapeCsvCell(e.prize ? 'yes' : 'no'),
      escapeCsvCell(e.prize ? e.prize.type : ''),
      escapeCsvCell(e.prize ? e.prize.prizeId : ''),
      escapeCsvCell(e.prize ? e.prize.provider : ''),
      escapeCsvCell(e.prize ? e.prize.offer : '')
    ];
    rows.push(row.join(','));
  }

  return rows.join('\r\n') + '\r\n';
}
