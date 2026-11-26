/*
 * Génération des images SVG : portée avec notes, clavier, icône de clé.
 * Toutes les images sont vectorielles pour rester nettes à l'impression.
 */
'use strict';

const SPACE = 10;                 // 1 interligne = 10 unités SVG
const GLYPH_SCALE = SPACE / 250;  // conversion unités de police → unités SVG
const STEM_LENGTH = 3.5 * SPACE;
const STEM_WIDTH = 0.12 * SPACE;
const NOTEHEAD_WIDTH = (GLYPHS.noteheadBlack.bounds.xMax / 250) * SPACE;
const LEDGER_EXTENSION = 0.4 * SPACE;   // débord de la ligne supplémentaire de chaque côté de la note

// Coordonnée Y d'une position sur la portée (1re ligne en bas, à y = 40).
function stepY(step) {
  return 4 * SPACE - step * (SPACE / 2);
}

// Positions des lignes supplémentaires nécessaires pour une note hors de la portée.
function ledgerSteps(step) {
  const steps = [];
  for (let s = -2; s >= step; s -= 2) steps.push(s);
  for (let s = 10; s <= step; s += 2) steps.push(s);
  return steps;
}

function glyph(name, x, y, cls = '') {
  const k = GLYPH_SCALE;
  const c = cls ? ` class="${cls}"` : '';
  return `<path${c} transform="translate(${x} ${y}) scale(${k} ${-k})" d="${GLYPHS[name].d}"/>`;
}

/*
 * Portée de 5 lignes avec sa clé et des notes (noires).
 * notes : [{ step, acc, x?, cls? }] où step vaut 0 pour la 1re ligne, 8 pour la 5e ligne,
 * et sort de cet intervalle pour les notes hors de la portée (lignes supplémentaires).
 * x impose la position horizontale de la note, cls ajoute une classe CSS (couleur).
 * options : largeur et cadre vertical minimal de l'image.
 */
function staffSVG(clefKey, notes, { width = 96, top: minTop = -16, bottom: minBottom = 58 } = {}) {
  const clef = CLEFS[clefKey];
  // Cadre commun à toutes les portées (même échelle d'une carte à l'autre),
  // agrandi seulement si une note ou une altération en déborde.
  let top = minTop;
  let bottom = minBottom;
  const parts = [];

  for (let i = 0; i < 5; i++) {
    const y = i * SPACE;
    parts.push(`<line class="staff-line" x1="0" x2="${width}" y1="${y}" y2="${y}"/>`);
  }
  parts.push(glyph(clef.glyph, 3, stepY(clef.glyphStep)));

  const xs = notes.length === 1 ? [57] : notes.map((_, i) => 44 + i * 32);
  notes.forEach((note, i) => {
    const x = note.x ?? xs[i];
    const y = stepY(note.step);
    const ledgers = ledgerSteps(note.step);
    parts.push(`<g class="note ${note.cls || ''}">`);
    for (const s of ledgers) {
      const ly = stepY(s);
      parts.push(`<line class="ledger-line" x1="${x - LEDGER_EXTENSION}" x2="${x + NOTEHEAD_WIDTH + LEDGER_EXTENSION}" y1="${ly}" y2="${ly}"/>`);
    }
    if (note.acc) {
      const accName = note.acc > 0 ? 'accidentalSharp' : 'accidentalFlat';
      const b = GLYPHS[accName].bounds;
      const gap = ledgers.length ? LEDGER_EXTENSION + 1 : 1.5;
      parts.push(glyph(accName, x - gap - b.xMax * GLYPH_SCALE, y));
      top = Math.min(top, y - b.yMax * GLYPH_SCALE - 1);
      bottom = Math.max(bottom, y - b.yMin * GLYPH_SCALE + 1);
    }
    parts.push(glyph('noteheadBlack', x, y));
    // Hampe vers le haut sous la 3e ligne, vers le bas à partir de la 3e ligne.
    const stemUp = note.step < 4;
    const stemX = stemUp ? x + NOTEHEAD_WIDTH - STEM_WIDTH : x;
    const y1 = stemUp ? y - STEM_LENGTH : y + 1.68;
    const y2 = stemUp ? y - 1.68 : y + STEM_LENGTH;
    parts.push(`<rect x="${stemX}" y="${y1}" width="${STEM_WIDTH}" height="${y2 - y1}"/>`, '</g>');
    top = Math.min(top, y1 - 1, y - SPACE / 2 - 1);
    bottom = Math.max(bottom, y2 + 1, y + SPACE / 2 + 1);
  });

  return `<svg class="staff" viewBox="0 ${top} ${width} ${bottom - top}" role="img">${parts.join('')}</svg>`;
}

/*
 * Clavier de piano allant de la touche blanche `from` à `to` (numéros diatoniques).
 * highlight : numéro MIDI de la touche à colorer.
 * markMiddleC : affiche un point sur le do central.
 * whiteHeight : longueur des touches (plus longues = plus faciles à toucher sur téléphone).
 * Chaque touche porte son numéro MIDI (data-midi) pour pouvoir être cliquée.
 */
function keyboardSVG({ from, to, highlight = null, markMiddleC = false, whiteHeight = 46 }) {
  const whiteW = 10;
  const whiteH = whiteHeight;
  const blackW = 6.2;
  const blackH = whiteHeight * 0.63;
  const count = to - from + 1;
  const whites = [];
  const blacks = [];
  const marks = [];

  for (let i = 0; i < count; i++) {
    const dia = from + i;
    const midi = midiOf(dia);
    const x = i * whiteW;
    const cls = midi === highlight ? 'key-white hl' : 'key-white';
    whites.push(`<rect class="${cls}" data-midi="${midi}" x="${x}" y="0" width="${whiteW}" height="${whiteH}" rx="0.8"/>`);
    if (markMiddleC && midi === MIDDLE_C_MIDI) {
      marks.push(`<circle class="middle-c" cx="${x + whiteW / 2}" cy="${whiteH - 5}" r="1.7"/>`);
    }
    // Une touche noire suit Do, Ré, Fa, Sol et La.
    const letter = letterOf(dia);
    if (i < count - 1 && [0, 1, 3, 4, 5].includes(letter)) {
      const bcls = midi + 1 === highlight ? 'key-black hl' : 'key-black';
      blacks.push(`<rect class="${bcls}" data-midi="${midi + 1}" x="${x + whiteW - blackW / 2}" y="0" width="${blackW}" height="${blackH}" rx="0.6"/>`);
    }
  }

  const w = count * whiteW;
  return `<svg class="keyboard" viewBox="-0.6 -0.6 ${w + 1.2} ${whiteH + 1.2}" role="img">`
    + whites.join('') + marks.join('') + blacks.join('') + '</svg>';
}

/*
 * Nom de note en HTML, avec le vrai glyphe de dièse / bémol (les caractères
 * ♯ ♭ des polices courantes sont trop fins à côté d'un texte en gras).
 * Le glyphe est aligné sur le texte : centre du dièse vers mi-hauteur des
 * majuscules, centre du rond du bémol un peu plus bas.
 */
const ACC_EM_PER_UNIT = 0.00112;
const ACC_GLYPH = {
  '1': { glyph: 'accidentalSharp', center: 0.36, label: 'dièse' },
  '-1': { glyph: 'accidentalFlat', center: 0.2, label: 'bémol' },
};

function accidentalHTML(acc) {
  if (!acc) return '';
  const { glyph: name, center, label } = ACC_GLYPH[acc];
  const b = GLYPHS[name].bounds;
  const height = (b.yMax - b.yMin) * ACC_EM_PER_UNIT;
  const bottom = center + b.yMin * ACC_EM_PER_UNIT;
  return `<svg class="acc" viewBox="${b.xMin} ${-b.yMax} ${b.xMax - b.xMin} ${b.yMax - b.yMin}"`
    + ` style="height:${height.toFixed(3)}em;vertical-align:${bottom.toFixed(3)}em" role="img" aria-label="${label}">`
    + `<path transform="scale(1 -1)" d="${GLYPHS[name].d}"/></svg>`;
}

function noteNameHTML(letter, acc = 0) {
  return NOTE_NAMES[letter] + accidentalHTML(acc);
}

// Petite icône de clé seule (pour les cartes « nom → portée »).
function clefIconSVG(clefKey) {
  const b = GLYPHS[CLEFS[clefKey].glyph].bounds;
  const vb = `${b.xMin} ${-b.yMax} ${b.xMax - b.xMin} ${b.yMax - b.yMin}`;
  return `<svg class="clef-icon" viewBox="${vb}" role="img"><path transform="scale(1 -1)" d="${GLYPHS[CLEFS[clefKey].glyph].d}"/></svg>`;
}
