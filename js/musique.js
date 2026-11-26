/*
 * Données musicales : noms des notes, clés, positions sur la portée.
 *
 * Une note « diatonique » est repérée par un entier : octave * 7 + lettre,
 * où lettre = 0 pour Do, 1 pour Ré, … 6 pour Si (octaves en notation
 * scientifique : le do central est C4, donc diatonique 28).
 * L'altération vaut -1 (bémol), 0 (naturel) ou +1 (dièse).
 */
'use strict';

const NOTE_NAMES = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const MIDDLE_C_MIDI = 60;

// step = position sur la portée : 0 = 1re ligne (en bas), 1 = 1er interligne, … 8 = 5e ligne.
// En dehors de 0–8, la note sort de la portée (-1 = sous la 1re ligne, 10 = ligne supplémentaire au-dessus…).
const STAFF_STEPS = 9;

const CLEFS = {
  sol: {
    key: 'sol',
    label: 'clé de sol',
    glyph: 'gClef',
    glyphStep: 2,          // la clé de sol s'enroule autour de la 2e ligne
    bottomDia: 4 * 7 + 2,  // 1re ligne = Mi (juste au-dessus du do central)
    readingRange: { from: -2, to: 9 },      // cartes « portée → nom » : du do central (Do, Ré sous la portée) au Sol au-dessus
    keyboard: { from: 4 * 7, to: 6 * 7 },   // clavier affiché : do central → Do deux octaves plus haut
  },
  fa: {
    key: 'fa',
    label: 'clé de fa',
    glyph: 'fClef',
    glyphStep: 6,          // les deux points de la clé de fa encadrent la 4e ligne
    bottomDia: 2 * 7 + 4,  // 1re ligne = Sol grave
    readingRange: { from: 0, to: 10 },      // cartes « portée → nom » : du Sol au do central (Si, Do au-dessus)
    keyboard: { from: 2 * 7, to: 4 * 7 },   // clavier affiché : Do deux octaves plus bas → do central
  },
};

function letterOf(dia) {
  return ((dia % 7) + 7) % 7;
}

function midiOf(dia, acc = 0) {
  return 12 * (Math.floor(dia / 7) + 1) + SEMITONES[letterOf(dia)] + acc;
}

// Altérations proposées pour une lettre : on évite Mi♯, Si♯, Do♭ et Fa♭.
function accidentalsFor(letter) {
  const accs = [];
  if (letter !== 0 && letter !== 3) accs.push(-1);
  if (letter !== 2 && letter !== 6) accs.push(1);
  return accs;
}

function ordinal(n, feminine) {
  if (n === 1) return feminine ? '1re' : '1er';
  return n + 'e';
}

// « 2e ligne », « 3e interligne », « sous la 1re ligne », « 1re ligne supplémentaire au-dessus »…
function positionLabel(step) {
  if (step >= 0 && step < STAFF_STEPS) {
    if (step % 2 === 0) return ordinal(step / 2 + 1, true) + ' ligne';
    return ordinal((step + 1) / 2, false) + ' interligne';
  }
  const above = step >= STAFF_STEPS;
  const distance = above ? step - (STAFF_STEPS - 1) : -step;   // en demi-interlignes depuis la portée
  if (distance % 2 === 0) {
    return `${ordinal(distance / 2, true)} ligne supplémentaire ${above ? 'au-dessus' : 'en dessous'}`;
  }
  const prep = above ? 'au-dessus de' : 'sous';
  if (distance === 1) return `${prep} la ${above ? '5e' : '1re'} ligne`;
  return `${prep} la ${ordinal((distance - 1) / 2, true)} ligne supplémentaire`;
}

// Clavier générique des exercices « clavier → nom » : deux octaves de Do à Si.
const GENERIC_KEYBOARD = { from: 3 * 7, to: 3 * 7 + 13 };

// Les deux noms d'une touche noire, par classe de hauteur (0–11) : [lettre, altération].
const BLACK_KEY_SPELLINGS = {
  1: [[0, 1], [1, -1]],    // Do♯ / Ré♭
  3: [[1, 1], [2, -1]],    // Ré♯ / Mi♭
  6: [[3, 1], [4, -1]],    // Fa♯ / Sol♭
  8: [[4, 1], [5, -1]],    // Sol♯ / La♭
  10: [[5, 1], [6, -1]],   // La♯ / Si♭
};

// Repères visuels sur le clavier, par classe de hauteur.
const KEY_HINTS = {
  0: 'juste à gauche des 2 touches noires',
  2: 'entre les 2 touches noires',
  4: 'juste à droite des 2 touches noires',
  5: 'juste à gauche des 3 touches noires',
  7: 'entre la 1re et la 2e des 3 touches noires',
  9: 'entre la 2e et la 3e des 3 touches noires',
  11: 'juste à droite des 3 touches noires',
  1: '1re touche noire du groupe de 2',
  3: '2e touche noire du groupe de 2',
  6: '1re touche noire du groupe de 3',
  8: '2e touche noire du groupe de 3',
  10: '3e touche noire du groupe de 3',
};
