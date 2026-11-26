/*
 * Logique du jeu, sans affichage : questions possibles, tirage d'une séance,
 * vérification des réponses, série de jours d'entraînement.
 *
 * Réutilise les données musicales des cartes (js/musique.js).
 */
'use strict';

const EXERCISES = {
  A: {
    label: 'Portée → nom',
    desc: 'Lis la note sur la portée',
    title: 'Quelle est cette note ?',
    usesClef: true,
  },
  B: {
    label: 'Clavier → nom',
    desc: 'Nomme la touche colorée',
    title: 'Quelle est cette touche ?',
    usesClef: false,
  },
  C: {
    label: 'Portée → clavier',
    desc: 'Touche la note sur le clavier',
    title: 'Touche cette note sur le clavier',
    usesClef: true,
  },
  D: {
    label: 'Nom → portée',
    desc: 'Place la note sur la portée',
    title: 'Place cette note sur la portée',
    usesClef: true,
  },
  E: {
    label: 'Note avant / après',
    desc: "Révise l'ordre des notes",
    title: 'Quelle note vient avant ? Et après ?',
    usesClef: false,
  },
};
const EXERCISE_ORDER = ['A', 'B', 'C', 'D', 'E'];

function pitchClass(letter, acc) {
  return (((SEMITONES[letter] + acc) % 12) + 12) % 12;
}

function noteBefore(letter) {
  return (letter + 6) % 7;
}

function noteAfter(letter) {
  return (letter + 1) % 7;
}

/*
 * Toutes les questions possibles pour les réglages choisis.
 * Chaque question a un identifiant stable (pour retenir les erreurs d'une séance à l'autre).
 */
function buildPool({ types, clefs, accidentals }) {
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
          pool.push({ id: `D-${clefKey}-${letter}-${acc}`, type: 'D', clef: clefKey, letter, acc, steps });
        }
      }
    }
  }

  if (types.B) {
    const { from, to } = GENERIC_KEYBOARD;
    for (let dia = from; dia <= to; dia++) {
      const letter = letterOf(dia);
      const midi = midiOf(dia);
      pool.push({ id: `B-${midi}`, type: 'B', letter, acc: 0, midi, black: false });
      if (accidentals && dia < to && [0, 1, 3, 4, 5].includes(letter)) {
        pool.push({ id: `B-${midi + 1}`, type: 'B', letter: null, acc: null, midi: midi + 1, black: true });
      }
    }
  }

  if (types.E) {
    for (let letter = 0; letter < 7; letter++) {
      pool.push({ id: `E-${letter}`, type: 'E', letter });
    }
  }

  return pool;
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
    case 'B': return a.letter !== null;
    case 'C': return a.midi !== null;
    case 'D': return a.step !== null;
    case 'E': return a.slots[0] !== null && a.slots[1] !== null;
    default: return false;
  }
}

function checkAnswer(q, a) {
  switch (q.type) {
    // Sur la portée, l'orthographe compte : Do♯ écrit n'est pas Ré♭.
    case 'A': return a.letter === q.letter && a.acc === q.acc;
    // Sur le clavier, une touche noire a deux noms : les deux sont acceptés.
    case 'B': return a.letter !== null && pitchClass(a.letter, a.acc) === q.midi % 12;
    case 'C': return a.midi === q.midi;
    case 'D': return q.steps.includes(a.step);
    case 'E': return a.slots[0] === noteBefore(q.letter) && a.slots[1] === noteAfter(q.letter);
    default: return false;
  }
}

// Note à faire entendre après la réponse (numéros MIDI, joués l'un après l'autre).
function questionSound(q, a) {
  switch (q.type) {
    case 'A':
    case 'B':
    case 'C':
      return [q.midi];
    case 'D': {
      const step = q.steps.includes(a.step) ? a.step : q.steps[0];
      return [midiOf(CLEFS[q.clef].bottomDia + step, q.acc)];
    }
    case 'E': {
      const dia = 4 * 7 + q.letter;
      return [midiOf(dia - 1), midiOf(dia), midiOf(dia + 1)];
    }
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
