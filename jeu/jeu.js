/*
 * Jeu d'entraînement : écrans, interactions, sons, sauvegarde de la progression.
 */
'use strict';

const SETTINGS_KEY = 'piano-jeu-reglages-v1';
const PROGRESS_KEY = 'piano-jeu-progression-v1';
const DEFAULT_SETTINGS = {
  types: { A: true, B: true, C: true, D: true, E: true },
  clefs: { sol: true, fa: true },
  accidentals: false,
  sound: true,
  length: 10,
};
const DEFAULT_PROGRESS = { xp: 0, streak: 0, lastDay: null, bestCombo: 0, sessions: 0, questions: {} };
const XP_FIRST_TRY = 10;
const XP_RETRY = 5;
const PRAISES = ['Bravo !', 'Excellent !', 'Parfait !', 'Bien joué !', 'Super !'];

// Portée cliquable des exercices « nom → portée » : un peu plus large pour afficher la correction.
const PICKER = { width: 110, top: -22, bottom: 62 };

const $ = (selector) => document.querySelector(selector);

let settings = load(SETTINGS_KEY, DEFAULT_SETTINGS);
let progress = load(PROGRESS_KEY, DEFAULT_PROGRESS);
let session = null;

/* ---------- Sauvegarde ---------- */

function load(key, defaults) {
  const base = structuredClone(defaults);
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved === 'object') {
      for (const [k, v] of Object.entries(saved)) {
        const isObject = v && typeof v === 'object' && !Array.isArray(v);
        base[k] = isObject && base[k] && typeof base[k] === 'object' ? { ...base[k], ...v } : v;
      }
    }
  } catch (e) {
    // stockage illisible : on repart des valeurs par défaut
  }
  return base;
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // stockage indisponible (navigation privée) : le jeu fonctionne quand même
  }
}

/* ---------- Sons (synthétisés, aucun fichier à télécharger) ---------- */

let audioCtx = null;

function audio() {
  if (!settings.sound) return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = audioCtx || new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, start, duration, { type = 'sine', volume = 0.2 } = {}) {
  const ctx = audio();
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// Son proche d'une corde frappée : fondamentale + deux harmoniques qui s'éteignent.
function playNote(midi, start = 0) {
  const f = 440 * 2 ** ((midi - 69) / 12);
  tone(f, start, 1.6, { type: 'triangle', volume: 0.28 });
  tone(f * 2, start, 0.9, { volume: 0.07 });
  tone(f * 3, start, 0.45, { volume: 0.03 });
}

function playSuccess() {
  tone(1046.5, 0, 0.14, { volume: 0.1 });
  tone(1568, 0.08, 0.3, { volume: 0.1 });
}

function playError() {
  tone(220, 0, 0.18, { type: 'square', volume: 0.04 });
  tone(165, 0.12, 0.3, { type: 'square', volume: 0.04 });
}

function playFanfare() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.1, 0.4, { type: 'triangle', volume: 0.15 }));
}

/* ---------- Navigation ---------- */

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.hidden = el.id !== `screen-${name}`;
  });
  window.scrollTo(0, 0);
}

/* ---------- Accueil ---------- */

function buildHome() {
  $('#exercise-list').innerHTML = EXERCISE_ORDER.map((type) => {
    const ex = EXERCISES[type];
    return '<label class="exercise">'
      + `<span class="ex-badge ex-${type}">${type}</span>`
      + `<span class="ex-text"><span class="ex-title">${ex.label}</span><span class="ex-desc">${ex.desc}</span></span>`
      + `<input type="checkbox" data-type="${type}"><span class="checkbox" aria-hidden="true"></span>`
      + '</label>';
  }).join('');
  $('#chip-sol').innerHTML = `${clefIconSVG('sol')}Clé de sol`;
  $('#chip-fa').innerHTML = `${clefIconSVG('fa')}Clé de fa`;

  document.querySelectorAll('[data-type]').forEach((el) => {
    el.addEventListener('change', () => { settings.types[el.dataset.type] = el.checked; settingsChanged(); });
  });
  document.querySelectorAll('[data-clef]').forEach((el) => {
    el.addEventListener('change', () => { settings.clefs[el.dataset.clef] = el.checked; settingsChanged(); });
  });
  $('#opt-acc').addEventListener('change', (e) => { settings.accidentals = e.target.checked; settingsChanged(); });
  $('#opt-sound').addEventListener('change', (e) => { settings.sound = e.target.checked; settingsChanged(); });
  document.querySelectorAll('[name="length"]').forEach((el) => {
    el.addEventListener('change', () => { settings.length = Number(el.value); settingsChanged(); });
  });

  // Le conseil d'installation n'a de sens que pour la version en ligne (pas pour le fichier téléchargé).
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  $('#install-hint').hidden = Boolean(standalone) || !location.protocol.startsWith('http');
}

function settingsChanged() {
  save(SETTINGS_KEY, settings);
  renderHome();
}

function renderHome() {
  document.querySelectorAll('[data-type]').forEach((el) => { el.checked = settings.types[el.dataset.type]; });
  document.querySelectorAll('[data-clef]').forEach((el) => { el.checked = settings.clefs[el.dataset.clef]; });
  $('#opt-acc').checked = settings.accidentals;
  $('#opt-sound').checked = settings.sound;
  document.querySelectorAll('[name="length"]').forEach((el) => { el.checked = Number(el.value) === settings.length; });

  $('#stat-streak').textContent = currentStreak(progress, dayKey());
  $('#stat-xp').textContent = progress.xp;

  const pool = buildPool(settings);
  $('#btn-start').disabled = pool.length === 0;
  $('#home-hint').textContent = pool.length
    ? ''
    : 'Choisis au moins un exercice (et une clé pour les exercices avec portée).';
}

/* ---------- Séance ---------- */

function startSession() {
  const pool = buildPool(settings);
  if (!pool.length) return;
  const questions = pickQuestions(pool, settings.length, progress.questions);
  session = {
    queue: questions.map((q) => ({ q, retry: false })),
    total: questions.length,
    done: 0,
    firstTry: 0,
    combo: 0,
    maxCombo: 0,
    xp: 0,
    mistakes: new Map(),
    current: null,
    answer: null,
    checked: false,
  };
  audio();   // débloque le son sur iPhone (il faut un geste de l'utilisateur)
  showScreen('quiz');
  nextQuestion();
}

function nextQuestion() {
  if (!session.queue.length) {
    finishSession();
    return;
  }
  session.current = session.queue.shift();
  session.answer = emptyAnswer();
  session.checked = false;
  renderQuestion();
  renderQuizHeader();
  renderFooter();
}

function renderQuizHeader() {
  $('#progress-fill').style.width = `${(session.done / session.total) * 100}%`;
  const combo = $('#combo');
  combo.textContent = session.combo >= 2 ? `🔥 ${session.combo}` : '';
  combo.classList.toggle('visible', session.combo >= 2);
}

/* ---------- Affichage d'une question ---------- */

function letterKeypad(withAccidentals) {
  const letters = NOTE_NAMES.map((name, i) =>
    `<button type="button" class="choice" data-letter="${i}">${name}</button>`).join('');
  let html = `<div class="keypad">${letters}</div>`;
  if (withAccidentals) {
    html += '<div class="acc-row">'
      + `<button type="button" class="choice small" data-acc="-1">${accidentalHTML(-1)} bémol</button>`
      + '<button type="button" class="choice small" data-acc="0">naturel</button>'
      + `<button type="button" class="choice small" data-acc="1">${accidentalHTML(1)} dièse</button>`
      + '</div>';
  }
  return html;
}

function staffPicker(q, notes) {
  const svg = staffSVG(q.clef, notes, PICKER);
  const zones = [];
  for (let step = 0; step < STAFF_STEPS; step++) {
    zones.push(`<rect class="zone" data-step="${step}" x="30" y="${stepY(step) - SPACE / 4}" `
      + `width="${PICKER.width - 30}" height="${SPACE / 2}"/>`);
  }
  return svg.replace('</svg>', `${zones.join('')}</svg>`);
}

function renderPicker(notes) {
  $('#q-answer .picker').innerHTML = staffPicker(session.current.q, notes);
}

function renderQuestion() {
  const { q } = session.current;
  const visual = $('#q-visual');
  const answer = $('#q-answer');
  $('#q-title').textContent = EXERCISES[q.type].title;
  visual.className = `q-visual type-${q.type}`;
  answer.className = `q-answer type-${q.type}`;

  switch (q.type) {
    case 'A':
      visual.innerHTML = staffSVG(q.clef, [{ step: q.step, acc: q.acc }]);
      answer.innerHTML = letterKeypad(settings.accidentals);
      break;
    case 'B':
      visual.innerHTML = keyboardSVG({ ...GENERIC_KEYBOARD, highlight: q.midi, whiteHeight: 60 });
      answer.innerHTML = letterKeypad(settings.accidentals);
      break;
    case 'C':
      visual.innerHTML = staffSVG(q.clef, [{ step: q.step, acc: q.acc }]);
      answer.innerHTML = keyboardSVG({ ...CLEFS[q.clef].keyboard, markMiddleC: true, whiteHeight: 75 })
        + '<p class="legend"><span class="dot"></span>do central</p>';
      break;
    case 'D':
      visual.innerHTML = `<div class="prompt-name">${noteNameHTML(q.letter, q.acc)}</div>`
        + `<div class="prompt-clef">${clefIconSVG(q.clef)}${CLEFS[q.clef].label}</div>`;
      answer.innerHTML = '<div class="picker"></div><p class="legend">Touche une ligne ou un interligne</p>';
      renderPicker([]);
      break;
    case 'E':
      visual.innerHTML = '<div class="slots">'
        + '<button type="button" class="slot" data-slot="0"><small>avant</small><span>?</span></button>'
        + `<span class="slot-note">${NOTE_NAMES[q.letter]}</span>`
        + '<button type="button" class="slot" data-slot="1"><small>après</small><span>?</span></button>'
        + '</div>';
      answer.innerHTML = letterKeypad(false);
      break;
    default:
      break;
  }
  refreshSelection();
}

// Met à jour l'affichage de ce que le joueur a choisi (avant vérification).
function refreshSelection() {
  const { q } = session.current;
  const a = session.answer;
  document.querySelectorAll('#q-answer [data-letter]').forEach((el) => {
    const letter = Number(el.dataset.letter);
    el.classList.toggle('selected', q.type !== 'E' && a.letter === letter);
  });
  document.querySelectorAll('#q-answer [data-acc]').forEach((el) => {
    el.classList.toggle('selected', a.acc === Number(el.dataset.acc));
  });
  document.querySelectorAll('#q-answer [data-midi]').forEach((el) => {
    el.classList.toggle('sel', a.midi === Number(el.dataset.midi));
  });
  document.querySelectorAll('#q-visual [data-slot]').forEach((el) => {
    const value = a.slots[Number(el.dataset.slot)];
    el.querySelector('span').textContent = value === null ? '?' : NOTE_NAMES[value];
    el.classList.toggle('filled', value !== null);
  });
  $('#btn-check').disabled = !isAnswerComplete(q, a);
}

/* ---------- Réponses du joueur ---------- */

function onAnswerTap(event) {
  if (!session || session.checked) return;
  const { q } = session.current;
  const a = session.answer;
  const target = event.target.closest('[data-letter], [data-acc], [data-midi], [data-step], [data-slot]');
  if (!target) return;
  const data = target.dataset;

  if (data.letter !== undefined) {
    const letter = Number(data.letter);
    if (q.type === 'E') {
      const free = a.slots.indexOf(null);
      a.slots[free === -1 ? 1 : free] = letter;
    } else {
      a.letter = letter;
    }
  } else if (data.acc !== undefined) {
    a.acc = Number(data.acc);
  } else if (data.midi !== undefined && q.type === 'C') {
    a.midi = Number(data.midi);
    playNote(a.midi);
  } else if (data.step !== undefined) {
    a.step = Number(data.step);
    renderPicker([{ step: a.step, acc: q.acc, cls: 'sel', x: 60 }]);
    playNote(midiOf(CLEFS[q.clef].bottomDia + a.step, q.acc));
  } else if (data.slot !== undefined) {
    a.slots[Number(data.slot)] = null;
  }
  refreshSelection();
}

/* ---------- Vérification ---------- */

function explanation(q) {
  switch (q.type) {
    case 'A': {
      const middleC = q.acc === 0 && q.midi === MIDDLE_C_MIDI ? ' (le do central)' : '';
      return `<b>${noteNameHTML(q.letter, q.acc)}</b> · ${positionLabel(q.step)}${middleC}`;
    }
    case 'B': {
      const pc = q.midi % 12;
      const name = q.black
        ? BLACK_KEY_SPELLINGS[pc].map(([l, acc]) => noteNameHTML(l, acc)).join(' / ')
        : NOTE_NAMES[q.letter];
      return `<b>${name}</b> · ${KEY_HINTS[pc]}`;
    }
    case 'C':
      return `<b>${noteNameHTML(q.letter, q.acc)}</b> · ${positionLabel(q.step)} : la touche en vert`;
    case 'D':
      return `<b>${noteNameHTML(q.letter, q.acc)}</b> · ${q.steps.map(positionLabel).join(' ou ')}`;
    case 'E':
      return `<b>${NOTE_NAMES[noteBefore(q.letter)]}</b> · ${NOTE_NAMES[q.letter]} · <b>${NOTE_NAMES[noteAfter(q.letter)]}</b>`;
    default:
      return '';
  }
}

// Colore les réponses : en vert ce qui était juste, en rouge l'erreur du joueur.
function showCorrection(q, a, ok) {
  const mark = (selector, cls) => document.querySelectorAll(selector).forEach((el) => el.classList.add(cls));

  if (q.type === 'A' || q.type === 'B') {
    if (!q.black || ok) {
      const letter = ok ? a.letter : q.letter;
      const acc = ok ? a.acc : q.acc;
      mark(`#q-answer [data-letter="${letter}"]`, 'correct');
      mark(`#q-answer [data-acc="${acc}"]`, 'correct');
    }
    if (!ok) {
      if (a.letter !== (q.black ? null : q.letter)) mark(`#q-answer [data-letter="${a.letter}"]`, 'wrong');
      if (q.acc !== null && a.acc !== q.acc) mark(`#q-answer [data-acc="${a.acc}"]`, 'wrong');
    }
  }
  if (q.type === 'C') {
    mark(`#q-answer [data-midi="${q.midi}"]`, 'right');
    if (!ok) mark(`#q-answer [data-midi="${a.midi}"]`, 'wrong');
  }
  if (q.type === 'D') {
    const notes = ok
      ? q.steps.map((step, i) => ({ step, acc: q.acc, cls: 'right', x: 56 + i * 28 }))
      : [{ step: a.step, acc: q.acc, cls: 'wrong', x: 44 },
        ...q.steps.map((step, i) => ({ step, acc: q.acc, cls: 'right', x: 70 + i * 26 }))];
    renderPicker(notes);
  }
  if (q.type === 'E') {
    const expected = [noteBefore(q.letter), noteAfter(q.letter)];
    document.querySelectorAll('#q-visual [data-slot]').forEach((el) => {
      const i = Number(el.dataset.slot);
      el.classList.add(a.slots[i] === expected[i] ? 'correct' : 'wrong');
    });
  }
  // Les réponses restent affichées mais ne réagissent plus (voir session.checked).
  $('#q-answer').classList.add('locked');
  $('#q-visual').classList.add('locked');
}

function checkCurrent() {
  const item = session.current;
  const { q } = item;
  const a = session.answer;
  const ok = checkAnswer(q, a);
  session.checked = true;

  const stat = progress.questions[q.id] || { ok: 0, ko: 0 };
  if (ok) stat.ok++; else stat.ko++;
  progress.questions[q.id] = stat;
  save(PROGRESS_KEY, progress);

  if (ok) {
    session.done++;
    session.combo++;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    session.xp += item.retry ? XP_RETRY : XP_FIRST_TRY;
    if (!item.retry) session.firstTry++;
    playSuccess();
  } else {
    session.combo = 0;
    session.mistakes.set(q.id, q);
    session.queue.push({ q, retry: true });   // la question reviendra en fin de séance
    playError();
    if (navigator.vibrate) navigator.vibrate(120);
  }
  questionSound(q, a).forEach((midi, i) => playNote(midi, 0.35 + i * 0.35));

  showCorrection(q, a, ok);
  $('#feedback-title').textContent = ok ? PRAISES[Math.floor(Math.random() * PRAISES.length)] : 'Pas tout à fait…';
  $('#feedback-detail').innerHTML = (ok ? '' : 'Réponse : ') + explanation(q);
  renderQuizHeader();
  renderFooter(ok);
}

function renderFooter(ok) {
  const footer = $('#quiz-footer');
  const button = $('#btn-check');
  const checked = session.checked;
  footer.classList.toggle('ok', checked && ok);
  footer.classList.toggle('ko', checked && !ok);
  $('#feedback').hidden = !checked;
  button.textContent = checked ? 'Continuer' : 'Vérifier';
  button.classList.toggle('btn-danger', checked && !ok);
  if (checked) button.disabled = false;
  else button.disabled = !isAnswerComplete(session.current.q, session.answer);
}

/* ---------- Fin de séance ---------- */

function finishSession() {
  progress.xp += session.xp;
  progress.bestCombo = Math.max(progress.bestCombo, session.maxCombo);
  progress.sessions++;
  recordPracticeDay(progress, dayKey());
  save(PROGRESS_KEY, progress);

  const accuracy = Math.round((session.firstTry / session.total) * 100);
  $('#results-emoji').textContent = accuracy === 100 ? '🏆' : accuracy >= 70 ? '🎉' : '💪';
  $('#results-title').textContent = accuracy === 100 ? 'Sans faute !' : 'Séance terminée !';
  $('#res-accuracy').textContent = `${accuracy} %`;
  $('#res-xp').textContent = `+${session.xp}`;
  $('#res-combo').textContent = session.maxCombo;

  const mistakes = [...session.mistakes.values()];
  $('#res-review').hidden = mistakes.length === 0;
  $('#res-mistakes').innerHTML = mistakes.map((q) => {
    const where = EXERCISES[q.type].usesClef ? ` · ${CLEFS[q.clef].label}` : '';
    return `<li><span class="ex-badge ex-${q.type}">${q.type}</span><span>${explanation(q)}${where}</span></li>`;
  }).join('');

  showScreen('results');
  playFanfare();
}

function quitSession() {
  if (session && session.done > 0 && !window.confirm('Quitter la séance ? Les points de cette séance seront perdus.')) return;
  session = null;
  renderHome();
  showScreen('home');
}

/* ---------- Démarrage ---------- */

function init() {
  buildHome();
  renderHome();

  $('#btn-start').addEventListener('click', startSession);
  $('#btn-again').addEventListener('click', startSession);
  $('#btn-home').addEventListener('click', () => { renderHome(); showScreen('home'); });
  $('#btn-quit').addEventListener('click', quitSession);
  $('#btn-check').addEventListener('click', () => {
    if (session.checked) nextQuestion();
    else if (isAnswerComplete(session.current.q, session.answer)) checkCurrent();
  });
  $('#q-answer').addEventListener('click', onAnswerTap);
  $('#q-visual').addEventListener('click', onAnswerTap);

  if ('serviceWorker' in navigator && window.isSecureContext && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
