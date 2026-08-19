import { compliments, insults } from './lines.js';
import { Deck, getRandomInt } from './deck.js';
import {
  normalizeConfig,
  validateConfig,
  createDailySchedule,
  claimDuePrize,
  countAwardedByPrize,
  reconcileDailySchedule
} from './prizes.js';

const SESSION_DURATION_MS = 30_000;
const PRIZE_VALIDITY_MS = 60 * 60 * 1000;
const ADMIN_PIN = '4167';
const BOOK_PROVIDER = "Nomad's Edge Books";

// State Management
let complimentDeck;
let insultDeck;
let selectedVoiceName = '';
let speechRate = 1.0;
let lastSpokenLine = null;
let lastSpokenCategory = null;

let currentUtteranceId = 0;
let activeUtteranceId = null;
let activeUtterance = null;

let prizeConfig = {
  openingTime: '08:00',
  closingTime: '17:00',
  awards: [],
  partners: []
};
let dailySchedule = null;
let currentAwards = []; // Temporary buffer for editing in settings dialog
let currentPartners = []; // Temporary buffer for editing in settings dialog
let lockTimerId = null;

// Initialize Decks and Settings
complimentDeck = new Deck('compliment', compliments, 'rivet-roulette-compliment');
insultDeck = new Deck('insult', insults, 'rivet-roulette-insult');

try {
  selectedVoiceName = localStorage.getItem('rivet-roulette-voice') || '';
  const savedRate = localStorage.getItem('rivet-roulette-rate');
  if (savedRate !== null) {
    const parsedRate = Number.parseFloat(savedRate);
    if (Number.isFinite(parsedRate) && parsedRate >= 0.5 && parsedRate <= 2) {
      speechRate = parsedRate;
    }
  }
} catch (e) {
  console.warn('Saved voice settings are unavailable; using defaults.', e);
}

/**
 * Searches the voice list for the best option matching priority criteria.
 */
function getBestFallbackVoice(voicesList) {
  if (!voicesList || voicesList.length === 0) return null;

  const englishVoices = voicesList.filter(v => v.lang.toLowerCase().startsWith('en'));

  // 1. Names containing Siri (English)
  const siriVoice = englishVoices.find(v => v.name.toLowerCase().includes('siri'));
  if (siriVoice) return siriVoice;

  // 2. High-quality local English Apple voices
  const preferredAppleNames = ['ava', 'samantha', 'allison', 'susan', 'nicky', 'aaron', 'tom', 'daniel'];
  const appleVoice = englishVoices.find(v => {
    const identity = `${v.name} ${v.voiceURI || ''}`.toLowerCase();
    return v.localService && (identity.includes('enhanced') || identity.includes('premium'));
  }) || englishVoices.find(v => {
    const identity = `${v.name} ${v.voiceURI || ''}`.toLowerCase();
    return v.localService && (identity.includes('apple') || preferredAppleNames.some(name => identity.includes(name)));
  });
  if (appleVoice) return appleVoice;

  // 3. Any local English voice
  const localEnglish = englishVoices.find(v => v.localService);
  if (localEnglish) return localEnglish;

  // 4. Any English voice
  if (englishVoices.length > 0) return englishVoices[0];

  // 5. Browser default
  const defaultVoice = voicesList.find(v => v.default);
  if (defaultVoice) return defaultVoice;

  return voicesList[0];
}

function loadVoices() {
  if (!window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

function updateVoiceDropdown(voicesList) {
  const select = document.getElementById('voice-select');
  if (!select) return;

  select.innerHTML = '<option value="">Automatic (best available)</option>';
  const englishVoices = voicesList.filter(voice => voice.lang.toLowerCase().startsWith('en'));
  englishVoices.forEach(voice => {
    const opt = document.createElement('option');
    opt.value = voice.name;
    opt.textContent = `${voice.name} (${voice.lang})${voice.localService ? ' [local]' : ''}`;
    if (voice.name === selectedVoiceName) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function updateVoiceStatusText(activeVoice) {
  const statusSpan = document.getElementById('voice-status-text');
  if (!statusSpan) return;

  if (!window.speechSynthesis) {
    statusSpan.textContent = "Status: Speech Synthesis Unsupported (Text displays only)";
    return;
  }

  if (!activeVoice) {
    statusSpan.textContent = 'Ready: using the browser default voice';
    return;
  }

  const name = activeVoice.name;
  if (name.toLowerCase().includes('siri')) {
    statusSpan.textContent = `Ready: ${name} (Siri)`;
  } else {
    statusSpan.textContent = `Ready: ${name} (Apple voice fallback)`;
  }
}

function speakText(text) {
  if (!window.speechSynthesis) return;

  const wasActive = window.speechSynthesis.speaking || window.speechSynthesis.pending;
  try {
    window.speechSynthesis.cancel();
  } catch (e) {
    console.error("Speech cancel failed:", e);
  }

  const id = ++currentUtteranceId;
  activeUtteranceId = id;

  const utterance = new SpeechSynthesisUtterance(text);
  activeUtterance = utterance;
  const voicesList = loadVoices();

  let voice = null;
  if (selectedVoiceName) {
    voice = voicesList.find(v => v.name === selectedVoiceName);
  }
  if (!voice) {
    voice = getBestFallbackVoice(voicesList);
  }

  if (voice) {
    utterance.voice = voice;
  }
  utterance.rate = speechRate;

  utterance.onend = () => {
    if (activeUtteranceId === id) {
      activeUtteranceId = null;
      activeUtterance = null;
      updateVoiceStatusText(voice);
    }
  };

  utterance.onerror = (e) => {
    if (activeUtteranceId === id) {
      activeUtteranceId = null;
      activeUtterance = null;
      if (e.error && e.error !== 'interrupted') {
        const statusSpan = document.getElementById('voice-status-text');
        if (statusSpan) {
          statusSpan.textContent = `Speech error: ${e.error}. The text remains available.`;
        }
      }
    }
  };

  const beginSpeech = () => {
    if (activeUtteranceId !== id) return;
    try {
      window.speechSynthesis.speak(utterance);
      const statusSpan = document.getElementById('voice-status-text');
      if (statusSpan) {
        const voiceName = voice ? voice.name : 'browser default voice';
        statusSpan.textContent = `Speaking with ${voiceName}`;
      }
    } catch (e) {
      if (activeUtteranceId === id) {
        activeUtteranceId = null;
        activeUtterance = null;
      }
      const statusSpan = document.getElementById('voice-status-text');
      if (statusSpan) {
        statusSpan.textContent = `Speech error: ${e.message}. The text remains available.`;
      }
    }
  };

  if (wasActive) {
    window.setTimeout(beginSpeech, 50);
  } else {
    beginSpeech();
  }
}

// Format date-time helper for proof panel
function formatDateTime(date) {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

// Escape HTML helper
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Render the proof panel
function renderPrizeProof(prize) {
  const container = document.getElementById('prize-proof-container');
  const resultStage = document.getElementById('result-stage');
  if (!container) return;

  if (!prize) {
    container.innerHTML = '';
    if (resultStage) resultStage.classList.remove('has-prize');
    return;
  }

  if (resultStage) resultStage.classList.add('has-prize');

  const isBook = prize.type === 'book';
  const headline = isBook ? 'BOOK DISCOUNT VOUCHER' : 'PARTNER PERK VOUCHER';
  const provider = isBook ? BOOK_PROVIDER : prize.vendor;
  const offer = prize.offer;

  const now = new Date();
  const expires = new Date(now.getTime() + PRIZE_VALIDITY_MS);

  const awardedStr = formatDateTime(now);
  const expiresStr = formatDateTime(expires);

  container.innerHTML = `
    <div class="prize-voucher">
      <div class="prize-voucher-headline">${escapeHtml(headline)}</div>
      <div class="prize-detail-row">
        <span class="prize-detail-label">Provider</span>
        <span class="prize-detail-value">${escapeHtml(provider)}</span>
      </div>
      <div class="prize-detail-row">
        <span class="prize-detail-label">Offer</span>
        <span class="prize-detail-value">${escapeHtml(offer)}</span>
      </div>
      <div class="prize-detail-row">
        <span class="prize-detail-label">Awarded</span>
        <span class="prize-detail-value">${escapeHtml(awardedStr)}</span>
      </div>
      <div class="prize-detail-row">
        <span class="prize-detail-label">Expires</span>
        <span class="prize-detail-value">${escapeHtml(expiresStr)} (Exactly one hour after award)</span>
      </div>
      <div class="prize-voucher-instructions">
        Take a photo of this screen and show it to the vendor.
      </div>
    </div>
  `;
}

// Load saved config on load/save
function loadSavedPrizeConfig() {
  try {
    const saved = localStorage.getItem('rivet-roulette-prize-config');
    if (saved) {
      const parsed = JSON.parse(saved);
      prizeConfig = normalizeConfig(parsed);
    } else {
      prizeConfig = normalizeConfig(null);
    }
  } catch (e) {
    console.warn('Failed to load prize config:', e);
    prizeConfig = normalizeConfig(null);
  }
}

// Generate unique slot IDs
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Load, reconcile, and save the daily schedule
function loadAndReconcileSchedule() {
  loadSavedPrizeConfig();

  try {
    const savedSchedule = localStorage.getItem('rivet-roulette-prize-schedule-v1');
    if (savedSchedule) {
      dailySchedule = JSON.parse(savedSchedule);
    } else {
      dailySchedule = null;
    }
  } catch (e) {
    console.warn('Failed to load schedule, creating new', e);
    dailySchedule = null;
  }

  const now = new Date();
  dailySchedule = reconcileDailySchedule(prizeConfig, dailySchedule, now, getRandomInt);

  try {
    localStorage.setItem('rivet-roulette-prize-schedule-v1', JSON.stringify(dailySchedule));
  } catch (e) {
    console.warn('Failed to save daily schedule:', e);
  }

  updateAdminSummary();
}

// Update admin summary container
function updateAdminSummary() {
  const summaryContainer = document.getElementById('admin-summary-container');
  if (!summaryContainer) return;

  if (!dailySchedule) {
    summaryContainer.textContent = 'No active daily schedule.';
    return;
  }

  const totalScheduled = dailySchedule.slots.length + dailySchedule.awarded.length;
  const totalAwarded = dailySchedule.awarded.length;
  const totalRemaining = dailySchedule.slots.length;

  summaryContainer.innerHTML = `
    Scheduled today: <strong>${totalScheduled}</strong><br>
    Awarded today: <strong>${totalAwarded}</strong><br>
    Remaining today: <strong>${totalRemaining}</strong>
  `;
}

// Session Lock Timers
function startLockTimer(expiresTimestamp) {
  if (lockTimerId) clearInterval(lockTimerId);

  function updateCountdown() {
    const now = Date.now();
    const timeLeft = expiresTimestamp - now;
    if (timeLeft <= 0) {
      clearInterval(lockTimerId);
      lockTimerId = null;
      localStorage.removeItem('rivet-roulette-session-expires');
      unlockApp();
    } else {
      const sec = Math.ceil(timeLeft / 1000);
      updateButtonsLockedState(sec);
    }
  }

  updateCountdown();
  lockTimerId = setInterval(updateCountdown, 250);
}

function lockApp(timeLeft) {
  const expires = Date.now() + timeLeft;
  if (!localStorage.getItem('rivet-roulette-session-expires')) {
    localStorage.setItem('rivet-roulette-session-expires', expires.toString());
  }

  const btnCompliment = document.getElementById('btn-compliment');
  const btnInsult = document.getElementById('btn-insult');
  if (btnCompliment) btnCompliment.disabled = true;
  if (btnInsult) btnInsult.disabled = true;

  startLockTimer(parseInt(localStorage.getItem('rivet-roulette-session-expires'), 10));
}

function unlockApp() {
  if (lockTimerId) {
    clearInterval(lockTimerId);
    lockTimerId = null;
  }

  const btnCompliment = document.getElementById('btn-compliment');
  const btnInsult = document.getElementById('btn-insult');

  if (btnCompliment) {
    btnCompliment.disabled = false;
    const cue = btnCompliment.querySelector('.btn-cue');
    if (cue) cue.textContent = 'Tap for a warm boost';
  }
  if (btnInsult) {
    btnInsult.disabled = false;
    const cue = btnInsult.querySelector('.btn-cue');
    if (cue) cue.textContent = 'Tap for a playful roast';
  }

  const resultCategory = document.getElementById('result-category');
  const resultText = document.getElementById('result-text');
  const resultStage = document.getElementById('result-stage');
  const prizeProofContainer = document.getElementById('prize-proof-container');

  if (resultCategory && resultCategory.textContent !== 'READY') {
    resultCategory.textContent = 'READY';
  }
  if (resultText && resultText.textContent !== 'Tap below to spin the Rivet Roulette.') {
    resultText.textContent = 'Tap below to spin the Rivet Roulette.';
  }
  if (resultStage) {
    resultStage.classList.remove('compliment-active', 'insult-active', 'has-prize');
  }
  if (prizeProofContainer) {
    prizeProofContainer.innerHTML = '';
  }

  if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
    window.speechSynthesis.cancel();
    activeUtteranceId = null;
    activeUtterance = null;
  }
  const voicesList = loadVoices();
  const activeVoice = voicesList.find(v => v.name === selectedVoiceName) || getBestFallbackVoice(voicesList);
  updateVoiceStatusText(activeVoice);
}

function updateButtonsLockedState(secondsLeft) {
  const btnCompliment = document.getElementById('btn-compliment');
  const btnInsult = document.getElementById('btn-insult');

  const label = `Locked (${secondsLeft}s)`;

  if (btnCompliment) {
    const cue = btnCompliment.querySelector('.btn-cue');
    if (cue) cue.textContent = label;
  }
  if (btnInsult) {
    const cue = btnInsult.querySelector('.btn-cue');
    if (cue) cue.textContent = label;
  }
}

function checkSessionLock() {
  const expires = localStorage.getItem('rivet-roulette-session-expires');
  if (!expires) {
    unlockApp();
    return;
  }
  const now = Date.now();
  const timeLeft = parseInt(expires, 10) - now;
  if (timeLeft <= 0) {
    localStorage.removeItem('rivet-roulette-session-expires');
    unlockApp();
  } else {
    lockApp(timeLeft);
  }
}

function triggerSelection(category) {
  // Check if locked
  const expires = localStorage.getItem('rivet-roulette-session-expires');
  if (expires && (parseInt(expires, 10) - Date.now() > 0)) {
    return;
  }

  // Lock buttons first
  lockApp(SESSION_DURATION_MS);

  let line;
  let labelText;
  if (category === 'compliment') {
    line = complimentDeck.draw();
    labelText = 'COMPLIMENT';
  } else {
    line = insultDeck.draw();
    labelText = 'INSULT';
  }

  // Perform prize roll: claim due prize
  loadAndReconcileSchedule();
  const nowMs = Date.now();
  const claimResult = claimDuePrize(dailySchedule, nowMs);
  const prize = claimResult.prize;
  dailySchedule = claimResult.schedule;

  // Persist the claimed schedule before showing the prize
  try {
    localStorage.setItem('rivet-roulette-prize-schedule-v1', JSON.stringify(dailySchedule));
  } catch (e) {
    console.warn('Failed to save claimed schedule:', e);
  }

  // Construct spoken text
  let spokenText = line;
  if (prize) {
    if (prize.type === 'book') {
      spokenText += '. You won a book discount: ' + prize.offer;
    } else {
      spokenText += '. You won a partner perk from ' + prize.vendor + ': ' + prize.offer;
    }
    spokenText += '. Take a photo of this screen now and show it to the vendor. This prize is valid for one hour.';
  }

  lastSpokenLine = spokenText;
  lastSpokenCategory = category;

  const replayBtn = document.getElementById('btn-replay');
  if (replayBtn) replayBtn.disabled = false;

  const resultStage = document.getElementById('result-stage');
  const resultCategory = document.getElementById('result-category');
  const resultText = document.getElementById('result-text');

  // Trigger visual reveal transition
  if (resultText) {
    resultText.classList.remove('reveal-active');
    resultText.classList.add('reveal-transition');
  }

  if (resultStage) {
    resultStage.classList.remove('compliment-active', 'insult-active');
    if (category === 'compliment') {
      resultStage.classList.add('compliment-active');
    } else {
      resultStage.classList.add('insult-active');
    }
  }

  if (resultCategory) resultCategory.textContent = labelText;
  if (resultText) {
    resultText.textContent = line;
    // Force browser reflow to reset transition state
    void resultText.offsetHeight;
    resultText.classList.remove('reveal-transition');
    resultText.classList.add('reveal-active');
  }

  // Render proof panel if awarded
  renderPrizeProof(prize);

  // Speak the text
  speakText(spokenText);
}

// Dynamic rendering of award rows in settings dialog
function renderAwardRows() {
  const container = document.getElementById('awards-rows-container');
  if (!container) return;
  container.innerHTML = '';

  currentAwards.forEach((a, idx) => {
    const row = document.createElement('div');
    row.className = 'partner-row';
    row.setAttribute('data-index', idx);

    row.innerHTML = `
      <div class="partner-row-header">
        <span class="partner-row-title">Award #${idx + 1}</span>
        <button type="button" class="btn-remove-award" data-index="${idx}">Remove</button>
      </div>
      <div class="partner-inputs">
        <label for="award-offer-${idx}">Offer text</label>
        <input type="text" id="award-offer-${idx}" class="form-control award-offer" placeholder="Offer text" value="${escapeHtml(a.offer)}">
        <div class="partner-inventory-wrapper">
          <label for="award-qty-${idx}">Prizes per day</label>
          <input type="number" id="award-qty-${idx}" class="form-control award-quantity" min="0" step="1" inputmode="numeric" placeholder="0" value="${a.dailyQuantity}">
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}

// Dynamic rendering of partner rows in settings dialog
function renderPartnerRows() {
  const container = document.getElementById('partner-rows-container');
  if (!container) return;
  container.innerHTML = '';

  currentPartners.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'partner-row';
    row.setAttribute('data-index', idx);

    row.innerHTML = `
      <div class="partner-row-header">
        <span class="partner-row-title">Partner #${idx + 1}</span>
        <button type="button" class="btn-remove-partner" data-index="${idx}">Remove</button>
      </div>
      <div class="partner-inputs">
        <label for="partner-vendor-${idx}">Vendor name</label>
        <input type="text" id="partner-vendor-${idx}" class="form-control partner-vendor" placeholder="Vendor name" value="${escapeHtml(p.vendor)}">
        <label for="partner-offer-${idx}">Offer text</label>
        <input type="text" id="partner-offer-${idx}" class="form-control partner-offer" placeholder="Offer text" value="${escapeHtml(p.offer)}">
        <div class="partner-inventory-wrapper">
          <label for="partner-qty-${idx}">Prizes per day</label>
          <input type="number" id="partner-qty-${idx}" class="form-control partner-quantity" min="0" step="1" inputmode="numeric" placeholder="0" value="${p.dailyQuantity}">
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}

function loadSettingsIntoDialog() {
  loadAndReconcileSchedule();

  const opensInput = document.getElementById('expo-opens');
  const closesInput = document.getElementById('expo-closes');

  if (opensInput) opensInput.value = prizeConfig.openingTime;
  if (closesInput) closesInput.value = prizeConfig.closingTime;

  currentAwards = prizeConfig.awards.map(a => ({ ...a }));
  currentPartners = prizeConfig.partners.map(p => ({ ...p }));

  renderAwardRows();
  renderPartnerRows();
  updateAdminSummary();

  const errDiv = document.getElementById('settings-error');
  const succDiv = document.getElementById('settings-success');
  if (errDiv) {
    errDiv.textContent = '';
    errDiv.style.display = 'none';
  }
  if (succDiv) {
    succDiv.textContent = '';
    succDiv.style.display = 'none';
  }
}

// Event Listeners setup
document.addEventListener('DOMContentLoaded', () => {
  const btnCompliment = document.getElementById('btn-compliment');
  const btnInsult = document.getElementById('btn-insult');
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsClose = document.getElementById('settings-close');
  const settingsDialog = document.getElementById('settings-dialog');

  const pinDialog = document.getElementById('pin-dialog');
  const pinClose = document.getElementById('pin-close');
  const pinForm = document.getElementById('pin-form');
  const pinInput = document.getElementById('pin-input');
  const pinError = document.getElementById('pin-error');

  const voiceSelect = document.getElementById('voice-select');
  const rateRange = document.getElementById('rate-range');
  const rateValue = document.getElementById('rate-value');
  const btnReplay = document.getElementById('btn-replay');
  const btnResetDecks = document.getElementById('btn-reset-decks');

  const awardsRowsContainer = document.getElementById('awards-rows-container');
  const btnAddAward = document.getElementById('btn-add-award');
  const partnerRowsContainer = document.getElementById('partner-rows-container');
  const btnAddPartner = document.getElementById('btn-add-partner');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Load prize config and schedule first
  loadAndReconcileSchedule();

  // Check session lock immediately
  checkSessionLock();

  if (btnCompliment) {
    btnCompliment.addEventListener('click', () => triggerSelection('compliment'));
  }
  if (btnInsult) {
    btnInsult.addEventListener('click', () => triggerSelection('insult'));
  }

  // Settings authorization flow
  if (settingsToggle && pinDialog) {
    settingsToggle.addEventListener('click', () => {
      if (pinInput) pinInput.value = '';
      if (pinError) {
        pinError.textContent = '';
        pinError.style.display = 'none';
      }
      pinDialog.showModal();
    });
  }

  if (pinClose && pinDialog) {
    pinClose.addEventListener('click', () => {
      pinDialog.close();
    });
  }

  if (pinForm && pinDialog && settingsDialog) {
    pinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (pinInput && pinInput.value === ADMIN_PIN) {
        pinDialog.close();
        loadSettingsIntoDialog();
        const list = loadVoices();
        updateVoiceDropdown(list);
        settingsDialog.showModal();
      } else {
        if (pinError) {
          pinError.textContent = 'Incorrect PIN. Access denied.';
          pinError.style.display = 'block';
        }
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
      }
    });
  }

  if (settingsClose && settingsDialog) {
    settingsClose.addEventListener('click', () => {
      settingsDialog.close();
    });
  }

  if (voiceSelect) {
    voiceSelect.addEventListener('change', (e) => {
      selectedVoiceName = e.target.value;
      try {
        localStorage.setItem('rivet-roulette-voice', selectedVoiceName);
      } catch (_) {}

      const list = loadVoices();
      const activeVoice = list.find(v => v.name === selectedVoiceName) || getBestFallbackVoice(list);
      updateVoiceStatusText(activeVoice);
    });
  }

  if (rateRange && rateValue) {
    rateRange.value = speechRate;
    rateValue.textContent = speechRate.toFixed(1);
    rateRange.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!Number.isFinite(val) || val < 0.5 || val > 2) return;
      speechRate = val;
      rateValue.textContent = val.toFixed(1);
      try {
        localStorage.setItem('rivet-roulette-rate', val);
      } catch (_) {}
    });
  }

  if (btnReplay) {
    btnReplay.addEventListener('click', () => {
      if (lastSpokenLine) {
        speakText(lastSpokenLine);
      }
    });
  }

  if (btnResetDecks) {
    btnResetDecks.addEventListener('click', () => {
      if (complimentDeck && typeof complimentDeck.reset === 'function') {
        complimentDeck.reset();
      }
      if (insultDeck && typeof insultDeck.reset === 'function') {
        insultDeck.reset();
      }

      const originalText = btnResetDecks.textContent;
      btnResetDecks.textContent = 'Decks Reset!';
      btnResetDecks.disabled = true;
      setTimeout(() => {
        btnResetDecks.textContent = originalText;
        btnResetDecks.disabled = false;
      }, 1500);
    });
  }

  // Handle awards rows interaction inside dialog
  if (awardsRowsContainer) {
    awardsRowsContainer.addEventListener('input', (e) => {
      const row = e.target.closest('.partner-row');
      if (!row) return;
      const idx = parseInt(row.getAttribute('data-index'), 10);
      if (e.target.classList.contains('award-offer')) {
        currentAwards[idx].offer = e.target.value;
      } else if (e.target.classList.contains('award-quantity')) {
        currentAwards[idx].dailyQuantity = e.target.value;
      }
    });

    awardsRowsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-award')) {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        currentAwards.splice(idx, 1);
        renderAwardRows();
      }
    });
  }

  if (btnAddAward) {
    btnAddAward.addEventListener('click', () => {
      currentAwards.push({ id: generateUUID(), offer: '', dailyQuantity: 0 });
      renderAwardRows();
    });
  }

  // Handle partner rows interaction inside dialog
  if (partnerRowsContainer) {
    partnerRowsContainer.addEventListener('input', (e) => {
      const row = e.target.closest('.partner-row');
      if (!row) return;
      const idx = parseInt(row.getAttribute('data-index'), 10);
      if (e.target.classList.contains('partner-vendor')) {
        currentPartners[idx].vendor = e.target.value;
      } else if (e.target.classList.contains('partner-offer')) {
        currentPartners[idx].offer = e.target.value;
      } else if (e.target.classList.contains('partner-quantity')) {
        currentPartners[idx].dailyQuantity = e.target.value;
      }
    });

    partnerRowsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-partner')) {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        currentPartners.splice(idx, 1);
        renderPartnerRows();
      }
    });
  }

  if (btnAddPartner) {
    btnAddPartner.addEventListener('click', () => {
      currentPartners.push({ id: generateUUID(), vendor: '', offer: '', dailyQuantity: 0 });
      renderPartnerRows();
    });
  }

  if (btnSaveSettings && settingsDialog) {
    btnSaveSettings.addEventListener('click', () => {
      const opensInput = document.getElementById('expo-opens');
      const closesInput = document.getElementById('expo-closes');

      const configToValidate = {
        openingTime: opensInput ? opensInput.value : '08:00',
        closingTime: closesInput ? closesInput.value : '17:00',
        awards: currentAwards,
        partners: currentPartners
      };

      const result = validateConfig(configToValidate);
      const errDiv = document.getElementById('settings-error');
      const succDiv = document.getElementById('settings-success');

      if (errDiv) {
        errDiv.textContent = '';
        errDiv.style.display = 'none';
      }
      if (succDiv) {
        succDiv.textContent = '';
        succDiv.style.display = 'none';
      }

      if (!result.valid) {
        if (errDiv) {
          errDiv.innerHTML = result.errors.join('<br>');
          errDiv.style.display = 'block';
        }
        return;
      }

      const normalized = normalizeConfig(configToValidate);
      prizeConfig = normalized;
      try {
        localStorage.setItem('rivet-roulette-prize-config', JSON.stringify(prizeConfig));

        // Reconcile immediately on save
        loadAndReconcileSchedule();

        if (succDiv) {
          succDiv.textContent = 'Settings saved successfully!';
          succDiv.style.display = 'block';
        }
        setTimeout(() => {
          settingsDialog.close();
        }, 1000);
      } catch (e) {
        if (errDiv) {
          errDiv.textContent = 'Failed to save settings locally: ' + e.message;
          errDiv.style.display = 'block';
        }
      }
    });
  }

  // Initial status configuration
  const list = loadVoices();
  updateVoiceDropdown(list);
  const activeVoice = list.find(v => v.name === selectedVoiceName) || getBestFallbackVoice(list);
  updateVoiceStatusText(activeVoice);

  // Setup recovery checks
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkSessionLock();
      loadAndReconcileSchedule();
    }
  });

  window.addEventListener('focus', () => {
    checkSessionLock();
    loadAndReconcileSchedule();
  });
});

// Update voices asynchronously if browser fires voiceschanged
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    const list = loadVoices();
    updateVoiceDropdown(list);
    const activeVoice = list.find(v => v.name === selectedVoiceName) || getBestFallbackVoice(list);
    updateVoiceStatusText(activeVoice);
  };
}

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Service Worker registered:', reg.scope);
      })
      .catch(err => {
        console.error('Service Worker registration failed:', err);
      });
  });
}
