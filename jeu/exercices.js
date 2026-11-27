/*
 * Logique du jeu, sans affichage : questions possibles, tirage d'une séance,
 * vérification des réponses, série de jours d'entraînement.
 *
 * Réutilise les données musicales des cartes (js/musique.js).
 */
'use strict';

const EXERCISES = {
  A: { label: 'Portée → nom', desc: 'Lis la note sur la portée', title: 'Quelle est cette note ?', usesClef: true },
  B: { label: 'Clavier → nom', desc: 'Nomme la touche colorée', title: 'Quelle est cette touche ?', usesClef: false },
  C: { label: 'Portée → clavier', desc: 'Touche la note sur le clavier', title: 'Touche cette note sur le clavier', usesClef: true },
  D: { label: 'Nom → portée', desc: 'Place la note sur la portée', title: 'Place cette note sur la portée', usesClef: true },
  E: { label: 'Note avant / après', desc: "Révise l'ordre des notes", title: 'Quelle note vient avant ? Et après ?', usesClef: false },
  F: { label: 'Nom → clavier', desc: 'Trouve la touche à partir du nom', title: 'Où est cette note sur le clavier ?', usesClef: false },
  G: { label: 'Clavier → portée', desc: 'Place la touche colorée sur la portée', title: 'Place cette touche sur la portée', usesClef: true },
  H: { label: 'Son → nom', desc: "Reconnais la note à l'oreille", title: 'Quelle note entends-tu ?', usesClef: false },
};
const EXERCISE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Exercice à l'oreille : un Do de référence (le do central), puis une note de l'octave au-dessus.
const REFERENCE_MIDI = MIDDLE_C_MIDI;
const LISTENING_RANGE = { from: 4 * 7, to: 4 * 7 + 6 };
// Clavier affiché pour montrer la réponse de l'exercice à l'oreille (do central → Do aigu).
const LISTENING_KEYBOARD = { from: 4 * 7, to: 5 * 7 };

const ALL_NOTES = [true, true, true, true, true, true, true];

function pitchClass(letter, acc) {
  return (((SEMITONES[letter] + acc) % 12) + 12) % 12;
}

function noteBefore(letter) {
  return (letter + 6) % 7;
}

function noteAfter(letter) {
  return (letter + 1) % 7;
}

function shuffle(list, rand = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Touches d'un clavier (blanches, et noires si les altérations sont activées).
// Une touche noire compte pour ses deux noms (Do♯ / Ré♭ → Do et Ré).
function keyQuestions(type, { from, to }, accidentals) {
  const list = [];
  for (let dia = from; dia <= to; dia++) {
    const letter = letterOf(dia);
    const midi = midiOf(dia);
    list.push({ id: `${type}-${midi}`, type, midi, letter, acc: 0, black: false, letters: [letter] });
    if (accidentals && dia < to && [0, 1, 3, 4, 5].includes(letter)) {
      const letters = BLACK_KEY_SPELLINGS[(midi + 1) % 12].map(([l]) => l);
      list.push({ id: `${type}-${midi + 1}`, type, midi: midi + 1, letter: null, acc: null, black: true, letters });
    }
  }
  return list;
}

/*
 * Toutes les questions possibles pour les réglages choisis.
 * Chaque question a un identifiant stable (pour retenir les erreurs d'une séance à l'autre)
 * et la liste des noms de notes qu'elle concerne (pour le filtre « Notes »).
 */
function buildPool({ types, clefs, accidentals, notes = ALL_NOTES }) {
  const pool = [];
  const accsFor = (letter) => [0, ...(accidentals ? accidentalsFor(letter) : [])];
  const clefKeys = Object.keys(CLEFS).filter((key) => clefs[key]);

  for (const clefKey of clefKeys) {
    const clef = CLEFS[clefKey];
    const staffNotes = (from, to, type) => {
      for (let step = from; step <= to; step++) {
        const dia = clef.bottomDia + step;
        const letter = letterOf(dia);
        for (const acc of accsFor(letter)) {
          pool.push({
            id: `${type}-${clefKey}-${step}-${acc}`,
            type,
            clef: clefKey,
            step,
            letter,
            acc,
            midi: midiOf(dia, acc),
            letters: [letter],
          });
        }
      }
    };
    if (types.A) staffNotes(clef.readingRange.from, clef.readingRange.to, 'A');
    if (types.C) staffNotes(0, STAFF_STEPS - 1, 'C');

    if (types.D) {
      for (let letter = 0; letter < 7; letter++) {
        const steps = [];
        for (let step = 0; step < STAFF_STEPS; step++) {
          if (letterOf(clef.bottomDia + step) === letter) steps.push(step);
        }
        for (const acc of accsFor(letter)) {
          pool.push({ id: `D-${clefKey}-${letter}-${acc}`, type: 'D', clef: clefKey, letter, acc, steps, letters: [letter] });
        }
      }
    }

    // Clavier → portée : une touche peut s'écrire de deux façons (Fa♯ ou Sol♭), les deux sont justes.
    if (types.G) {
      const spellingsByMidi = new Map();
      for (let step = 0; step < STAFF_STEPS; step++) {
        const dia = clef.bottomDia + step;
        const letter = letterOf(dia);
        for (const acc of accsFor(letter)) {
          const midi = midiOf(dia, acc);
          if (!spellingsByMidi.has(midi)) spellingsByMidi.set(midi, []);
          spellingsByMidi.get(midi).push({ step, letter, acc });
        }
      }
      [...spellingsByMidi.entries()].sort((a, b) => a[0] - b[0]).forEach(([midi, spellings]) => {
        const letters = [...new Set(spellings.map((s) => s.letter))];
        pool.push({ id: `G-${clefKey}-${midi}`, type: 'G', clef: clefKey, midi, spellings, letters });
      });
    }
  }

  if (types.B) pool.push(...keyQuestions('B', GENERIC_KEYBOARD, accidentals));
  if (types.H) pool.push(...keyQuestions('H', LISTENING_RANGE, accidentals));

  for (let letter = 0; letter < 7; letter++) {
    if (types.E) pool.push({ id: `E-${letter}`, type: 'E', letter, letters: [letter] });
    if (types.F) {
      for (const acc of accsFor(letter)) {
        pool.push({ id: `F-${letter}-${acc}`, type: 'F', letter, acc, letters: [letter] });
      }
    }
  }

  return pool.filter((q) => q.letters.some((letter) => notes[letter]));
}

/*
 * Poids d'une question pour le tirage : les questions jamais vues ou souvent
 * ratées reviennent plus souvent, celles toujours réussies plus rarement.
 */
function questionWeight(stat) {
  if (!stat) return 1.5;
  return 0.6 + (3 * (stat.ko + 0.5)) / (stat.ok + stat.ko + 1);
}

// Tirage pondéré de `count` questions, sans répéter deux fois de suite la même.
function pickQuestions(pool, count, stats = {}, rand = Math.random) {
  const result = [];
  let bag = [];
  while (result.length < count && pool.length) {
    if (bag.length === 0) bag = [...pool];
    const lastId = result.length ? result[result.length - 1].id : null;
    const candidates = bag.length > 1 ? bag.filter((q) => q.id !== lastId) : bag;
    const weights = candidates.map((q) => questionWeight(stats[q.id]));
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    let index = 0;
    while (index < candidates.length - 1 && r >= weights[index]) {
      r -= weights[index];
      index++;
    }
    const chosen = candidates[index];
    bag.splice(bag.indexOf(chosen), 1);
    result.push(chosen);
  }
  return result;
}

// Une réponse vide, à compléter par le joueur.
function emptyAnswer() {
  return { letter: null, acc: 0, midi: null, step: null, slots: [null, null] };
}

function isAnswerComplete(q, a) {
  switch (q.type) {
    case 'A':
    case 'B':
    case 'H': return a.letter !== null;
    case 'C':
    case 'F': return a.midi !== null;
    case 'D':
    case 'G': return a.step !== null;
    case 'E': return a.slots[0] !== null && a.slots[1] !== null;
    default: return false;
  }
}

function checkAnswer(q, a) {
  switch (q.type) {
    // Sur la portée, l'orthographe compte : Do♯ écrit n'est pas Ré♭.
    case 'A': return a.letter === q.letter && a.acc === q.acc;
    // Une touche (vue ou entendue) a parfois deux noms : les deux sont acceptés.
    case 'B':
    case 'H': return a.letter !== null && pitchClass(a.letter, a.acc) === q.midi % 12;
    case 'C': return a.midi === q.midi;
    case 'D': return q.steps.includes(a.step);
    case 'E': return a.slots[0] === noteBefore(q.letter) && a.slots[1] === noteAfter(q.letter);
    // N'importe quelle touche du bon nom, quelle que soit l'octave.
    case 'F': return a.midi !== null && a.midi % 12 === pitchClass(q.letter, q.acc);
    case 'G': return q.spellings.some((s) => s.step === a.step);
    default: return false;
  }
}

// Notes à faire entendre après la réponse (numéros MIDI, joués l'un après l'autre).
function questionSound(q, a) {
  switch (q.type) {
    case 'A':
    case 'B':
    case 'C':
    case 'G':
    case 'H':
      return [q.midi];
    case 'D': {
      const step = q.steps.includes(a.step) ? a.step : q.steps[0];
      return [midiOf(CLEFS[q.clef].bottomDia + step, q.acc)];
    }
    case 'E': {
      const dia = 4 * 7 + q.letter;
      return [midiOf(dia - 1), midiOf(dia), midiOf(dia + 1)];
    }
    case 'F':
      return [checkAnswer(q, a) ? a.midi : midiOf(GENERIC_KEYBOARD.from) + pitchClass(q.letter, q.acc)];
    default:
      return [];
  }
}

/* ---------- Série de jours ---------- */

function dayKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function previousDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

// À appeler à la fin d'une séance.
function recordPracticeDay(progress, today) {
  if (progress.lastDay === today) return;
  progress.streak = progress.lastDay === previousDayKey(today) ? progress.streak + 1 : 1;
  progress.lastDay = today;
}

// Série affichée : elle tombe à 0 si on a sauté un jour.
function currentStreak(progress, today) {
  const alive = progress.lastDay === today || progress.lastDay === previousDayKey(today);
  return alive ? progress.streak : 0;
}
