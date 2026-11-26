/*
 * Définition de toutes les cartes de révision.
 *
 * Chaque carte a une partie « question » (en haut) et une partie « réponse »
 * (en bas). qRatio = part de la hauteur donnée à la question (en %), le reste
 * va à la réponse : elle varie selon l'exercice pour que tout soit lisible.
 */
'use strict';

const CARD_TYPES = {
  A: { label: 'Portée → nom', title: 'Quelle est cette note ?', qRatio: 66 },
  B: { label: 'Clavier → nom', title: 'Quelle est cette touche ?', qRatio: 56 },
  C: { label: 'Portée → clavier', title: 'Où est cette note sur le clavier ?', qRatio: 46 },
  D: { label: 'Nom → portée', title: 'Où est cette note sur la portée ?', qRatio: 36 },
  E: { label: 'Note avant / après', title: 'Quelle note vient avant ? Et après ?', qRatio: 50 },
};
const TYPE_ORDER = ['A', 'B', 'C', 'D', 'E'];
const CLEF_ORDER = ['sol', 'fa'];

function visual(svg, extraClass = '') {
  return `<div class="visual ${extraClass}">${svg}</div>`;
}

function middleCLegend() {
  return '<div class="legend"><span class="dot"></span>do central</div>';
}

// Appelle fn pour chaque note (naturelle puis altérée) entre deux positions de la portée.
function forEachStaffNote(from, to, clefIndex, clef, fn) {
  for (let step = from; step <= to; step++) {
    const dia = clef.bottomDia + step;
    const letter = letterOf(dia);
    for (const acc of [0, ...accidentalsFor(letter)]) {
      fn({
        step,
        dia,
        acc,
        name: noteNameHTML(letter, acc),
        sort: clefIndex * 1000 + step * 3 + acc + 1,
      });
    }
  }
}

function buildStaffCards(cards) {
  CLEF_ORDER.forEach((clefKey, clefIndex) => {
    const clef = CLEFS[clefKey];

    // Portée → nom : un peu au-delà de la portée, jusqu'au do central.
    const { from, to } = clef.readingRange;
    forEachStaffNote(from, to, clefIndex, clef, ({ step, dia, acc, name, sort }) => {
      const isMiddleC = acc === 0 && midiOf(dia) === MIDDLE_C_MIDI;
      cards.push({
        type: 'A',
        clef: clefKey,
        acc: acc !== 0,
        sort,
        question: visual(staffSVG(clefKey, [{ step, acc }])),
        answer: `<div class="name">${name}</div><div class="sub">${positionLabel(step)}`
          + `${isMiddleC ? '<br>c\'est le do central' : ''}</div>`,
      });
    });

    // Portée → clavier : notes sur les 5 lignes uniquement.
    forEachStaffNote(0, STAFF_STEPS - 1, clefIndex, clef, ({ step, dia, acc, name, sort }) => {
      const keyboard = keyboardSVG({ ...clef.keyboard, highlight: midiOf(dia, acc), markMiddleC: true });
      cards.push({
        type: 'C',
        clef: clefKey,
        acc: acc !== 0,
        sort,
        question: visual(staffSVG(clefKey, [{ step, acc }])),
        answer: visual(keyboard, 'kbd') + `<div class="name name-sm">${name}</div>` + middleCLegend(),
      });
    });
  });
}

function buildKeyboardCards(cards) {
  const { from, to } = GENERIC_KEYBOARD;
  for (let dia = from; dia <= to; dia++) {
    const letter = letterOf(dia);
    const midi = midiOf(dia);
    cards.push({
      type: 'B',
      clef: null,
      acc: false,
      sort: midi,
      question: visual(keyboardSVG({ from, to, highlight: midi })),
      answer: `<div class="name">${NOTE_NAMES[letter]}</div><div class="sub">${KEY_HINTS[SEMITONES[letter]]}</div>`,
    });
    if (dia < to && [0, 1, 3, 4, 5].includes(letter)) {
      const pc = (SEMITONES[letter] + 1) % 12;
      cards.push({
        type: 'B',
        clef: null,
        acc: true,
        sort: midi + 1,
        question: visual(keyboardSVG({ from, to, highlight: midi + 1 })),
        answer: `<div class="name name-md">${BLACK_KEY_SPELLINGS[pc].map(([l, a]) => noteNameHTML(l, a)).join(' / ')}</div>`
          + `<div class="sub">${KEY_HINTS[pc]}</div>`,
      });
    }
  }
}

function buildPlacementCards(cards) {
  CLEF_ORDER.forEach((clefKey, clefIndex) => {
    const clef = CLEFS[clefKey];
    for (let letter = 0; letter < 7; letter++) {
      // Une même note peut apparaître deux fois sur la portée (ex. Mi grave et Mi aigu).
      const steps = [];
      for (let step = 0; step < STAFF_STEPS; step++) {
        if (letterOf(clef.bottomDia + step) === letter) steps.push(step);
      }
      for (const acc of [0, ...accidentalsFor(letter)]) {
        const name = noteNameHTML(letter, acc);
        cards.push({
          type: 'D',
          clef: clefKey,
          acc: acc !== 0,
          sort: clefIndex * 1000 + letter * 3 + acc + 1,
          question: `<div class="prompt"><div class="name name-lg">${name}</div>`
            + `<div class="clef-line">${clefIconSVG(clefKey)}<span>${clef.label}</span></div></div>`,
          answer: visual(staffSVG(clefKey, steps.map((step) => ({ step, acc }))))
            + `<div class="sub">${steps.map(positionLabel).join(' et ')}</div>`,
        });
      }
    }
  });
}

// Note avant / après : la gamme tourne en boucle (avant Do vient Si, après Si revient Do).
function buildNeighborCards(cards) {
  const at = (letter, offset) => NOTE_NAMES[(letter + offset + 7) % 7];
  for (let letter = 0; letter < 7; letter++) {
    const column = (tag, name, cls = '') => `<div class="neighbor ${cls}"><div class="tag">${tag}</div>`
      + `<div class="name name-md">${name}</div></div>`;
    // Rappel de la gamme centrée sur la note : 3 notes avant, 3 notes après.
    const cycle = [-3, -2, -1, 0, 1, 2, 3]
      .map((o) => (Math.abs(o) <= 1 ? `<b>${at(letter, o)}</b>` : at(letter, o)))
      .join(' ');
    cards.push({
      type: 'E',
      clef: null,
      acc: false,
      sort: letter,
      question: '<div class="prompt"><div class="neighbors-q"><span class="blank">?</span>'
        + `<span class="name name-lg">${NOTE_NAMES[letter]}</span><span class="blank">?</span></div></div>`,
      answer: '<div class="neighbors">'
        + column('avant', at(letter, -1))
        + column('&nbsp;', NOTE_NAMES[letter], 'current')
        + column('après', at(letter, 1))
        + `</div><div class="cycle">${cycle}</div>`,
    });
  }
}

/*
 * Toutes les cartes, triées par exercice, puis par clé, puis par hauteur.
 * Les numéros (A01, A02…) restent stables : notes naturelles d'abord,
 * puis les notes altérées, pour qu'activer les altérations ne renumérote rien.
 */
function buildAllCards() {
  const cards = [];
  buildStaffCards(cards);
  buildKeyboardCards(cards);
  buildPlacementCards(cards);
  buildNeighborCards(cards);

  cards.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.sort - b.sort);

  for (const type of TYPE_ORDER) {
    const ofType = cards.filter((c) => c.type === type);
    const numbered = [...ofType.filter((c) => !c.acc), ...ofType.filter((c) => c.acc)];
    numbered.forEach((card, i) => {
      card.id = type + String(i + 1).padStart(2, '0');
      card.qRatio = CARD_TYPES[type].qRatio;
      card.title = CARD_TYPES[type].title;
    });
  }
  return cards;
}
