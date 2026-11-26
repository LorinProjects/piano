/*
 * Interface : filtres, mélange, mise en page A4 (3 × 3 cartes) et impression.
 */
'use strict';

const CARDS_PER_SHEET = 9;
const STORAGE_KEY = 'cartes-piano-v1';
const DEFAULT_STATE = {
  types: { A: true, B: true, C: true, D: true, E: true },
  clefs: { sol: true, fa: true },
  accidentals: false,
  shuffled: false,
  seed: 1,
};

// Géométrie de la feuille (mm) : 3 × 3 cartes de 63 × 88 mm centrées sur un A4.
const SHEET = { w: 210, h: 297, cardW: 63, cardH: 88, cols: 3, rows: 3 };
SHEET.left = (SHEET.w - SHEET.cols * SHEET.cardW) / 2;
SHEET.top = (SHEET.h - SHEET.rows * SHEET.cardH) / 2;

const ALL_CARDS = buildAllCards();
let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      return {
        ...DEFAULT_STATE,
        ...saved,
        types: { ...DEFAULT_STATE.types, ...saved.types },
        clefs: { ...DEFAULT_STATE.clefs, ...saved.clefs },
      };
    }
  } catch (e) {
    // stockage indisponible (ex. navigation privée) : on garde les valeurs par défaut
  }
  return structuredClone(DEFAULT_STATE);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // sans importance
  }
}

// Générateur pseudo-aléatoire reproductible : le même mélange est conservé
// quand on change un filtre.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, seed) {
  const rand = mulberry32(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function selectedCards() {
  const list = ALL_CARDS.filter((c) =>
    state.types[c.type]
    && (c.clef === null || state.clefs[c.clef])
    && (state.accidentals || !c.acc));
  return state.shuffled ? shuffled(list, state.seed) : list;
}

function cardHTML(card) {
  return `<article class="card card-${card.type}">`
    + `<section class="zone q" style="flex-grow:${card.qRatio}">`
    + `<div class="label">${card.title}</div>${card.question}</section>`
    + `<section class="zone a" style="flex-grow:${100 - card.qRatio}">${card.answer}</section>`
    + `<div class="id">${card.id}</div>`
    + '</article>';
}

// Traits de coupe : lignes fines sur les bords des cartes, prolongées jusqu'au bord de la feuille.
function cutLinesSVG() {
  const lines = [];
  for (let i = 0; i <= SHEET.cols; i++) {
    const x = SHEET.left + i * SHEET.cardW;
    lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="${SHEET.h}"/>`);
  }
  for (let j = 0; j <= SHEET.rows; j++) {
    const y = SHEET.top + j * SHEET.cardH;
    lines.push(`<line x1="0" x2="${SHEET.w}" y1="${y}" y2="${y}"/>`);
  }
  return `<svg class="cutlines" viewBox="0 0 ${SHEET.w} ${SHEET.h}" aria-hidden="true">${lines.join('')}</svg>`;
}

function render() {
  const cards = selectedCards();
  const sheetCount = Math.ceil(cards.length / CARDS_PER_SHEET);
  const cut = cutLinesSVG();
  const html = [];

  for (let s = 0; s < sheetCount; s++) {
    const slice = cards.slice(s * CARDS_PER_SHEET, (s + 1) * CARDS_PER_SHEET);
    const slots = slice.map(cardHTML);
    while (slots.length < CARDS_PER_SHEET) slots.push('<div class="card empty"></div>');
    html.push(
      '<div class="sheet-wrap">'
      + `<div class="page-label">Page ${s + 1} / ${sheetCount}</div>`
      + `<div class="sheet"><div class="grid">${slots.join('')}</div>${cut}</div>`
      + '</div>');
  }

  document.getElementById('sheets').innerHTML = cards.length
    ? html.join('')
    : '<p class="empty-msg">Aucune carte ne correspond aux filtres.</p>';

  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  document.getElementById('summary').textContent =
    `${plural(cards.length, 'carte')} · ${plural(sheetCount, 'page')} A4`
    + (state.shuffled ? ' · ordre mélangé' : ' · ordre trié');
}

function syncControls() {
  document.querySelectorAll('[data-type]').forEach((el) => { el.checked = state.types[el.dataset.type]; });
  document.querySelectorAll('[data-clef]').forEach((el) => { el.checked = state.clefs[el.dataset.clef]; });
  document.getElementById('opt-acc').checked = state.accidentals;
  document.getElementById('btn-sort').disabled = !state.shuffled;
}

function update() {
  saveState();
  syncControls();
  render();
}

function init() {
  // Libellés des exercices et compteurs issus des définitions de cartes.
  document.querySelectorAll('[data-type]').forEach((el) => {
    el.nextElementSibling.textContent = CARD_TYPES[el.dataset.type].label;
    el.addEventListener('change', () => { state.types[el.dataset.type] = el.checked; update(); });
  });
  document.querySelectorAll('[data-clef]').forEach((el) => {
    el.addEventListener('change', () => { state.clefs[el.dataset.clef] = el.checked; update(); });
  });
  document.getElementById('opt-acc').addEventListener('change', (e) => {
    state.accidentals = e.target.checked;
    update();
  });
  document.getElementById('btn-shuffle').addEventListener('click', () => {
    state.shuffled = true;
    state.seed = Math.floor(Math.random() * 2 ** 31);
    update();
  });
  document.getElementById('btn-sort').addEventListener('click', () => {
    state.shuffled = false;
    update();
  });
  document.getElementById('btn-print').addEventListener('click', () => window.print());

  update();
}

init();
