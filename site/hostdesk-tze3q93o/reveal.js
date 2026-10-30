/**
 * Reveal overlay (Concept A look) + "The lantern draw" (Concept B mechanics).
 *
 * open({team, practice, n, stat, prepare}) plays the reveal straight away and,
 * in parallel, runs prepare() → {pool, bonusPool, winners, save}. In a practice
 * run prepare() returns fake names and save is null, so nothing is written.
 *
 * Winners are picked with crypto.getRandomValues BEFORE the reel animates; the
 * animation only presents the result. All guest text is set with textContent.
 */
import { cryptoInt, drawable } from './lib.js';
import { createFx, COLORS } from './fx.js';

const MIN_N = 1;
const MAX_N = 10;
const TEAM = {
  sun: { word: 'Sun!', label: 'Sun ☀️', team: 'Team Sun', sub: "It's a baby boy 💙", live: "It's a Sun! A baby boy." },
  shine: { word: 'Shine!', label: 'Shine ✨', team: 'Team Shine', sub: "It's a baby girl 💖", live: "It's a Shine! A baby girl." },
};

const $ = (sel, root = document) => root.querySelector(sel);
const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* not supported */ } };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

export function createReveal({ root, reducedMotion, toast, onN, onClose }) {
  const fx = createFx($('#rvFx', root), { reducedMotion });
  const stage = $('#rvStage', root);
  const draw = $('#rvDraw', root);
  const titleEl = $('#rvTitle', root);
  const reelName = $('#reelName', root);
  const lantern = $('#bigLantern', root);
  const drawBtn = $('#drSpin', root);
  const absentBtn = $('#drAbsentBtn', root);
  const nOut = $('#drN', root);
  const nMinus = $('#drMinus', root);
  const nPlus = $('#drPlus', root);
  const notice = $('#drNotice', root);
  const winList = $('#drWinners', root);
  const absentRow = $('#drAbsent', root);
  const saveEl = $('#drSave', root);
  const live = $('#drLive', root);
  const stageErr = $('#rvErr', root);
  const toDraw = $('#rvToDraw', root);
  const restartBtn = $('#drRestart', root);

  let s = null;          // current session state
  let tl = null;         // GSAP timeline
  let lastFocus = null;
  let tickTimer = null;

  // Sun rays (static decoration).
  (function rays() {
    const g = $('#rvRays', root);
    const NS = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r1 = 64, r2 = i % 2 ? 84 : 98;
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', (100 + Math.cos(a) * r1).toFixed(1));
      line.setAttribute('y1', (100 + Math.sin(a) * r1).toFixed(1));
      line.setAttribute('x2', (100 + Math.cos(a) * r2).toFixed(1));
      line.setAttribute('y2', (100 + Math.sin(a) * r2).toFixed(1));
      g.append(line);
    }
  })();

  const motion = () => !reducedMotion() && !!window.gsap;

  /* ───────────── open / close ───────────── */

  function open({ team, practice, n, stat, prepare }) {
    if (s) close(true);
    lastFocus = document.activeElement;
    s = {
      team, practice, n: clampN(n), stat, prepare,
      ready: null, error: null,
      pool: [], bonusPool: [], winners: [], absent: [],
      bonus: false, kept: false, spinning: false, save: null, saveState: '',
      poolTokens: new Set(),
    };
    root.dataset.team = team;
    root.hidden = false;
    root.classList.remove('final', 'drawing');
    root.classList.toggle('practice', !!practice);
    document.body.classList.add('rv-open');
    $('#rvMode', root).textContent = practice ? 'Practice run · nothing is saved' : 'Live · results are saved';
    stage.hidden = false;
    draw.hidden = true;
    stageErr.hidden = true;
    toDraw.disabled = false;
    splitChars(titleEl, TEAM[team].word);
    $('#rvSub', root).textContent = TEAM[team].sub;
    $('#rvStat', root).textContent = stat || '';
    $('#rvAnnounce', root).textContent = '';
    fx.size();
    fx.clear();
    $('#rvClose', root).focus({ preventScroll: true });
    runPrepare();
    play(team);
  }

  function close(silent) {
    if (!s) return;
    if (tl) { tl.kill(); tl = null; }
    clearTimeout(tickTimer);
    fx.clear();
    if (window.gsap) window.gsap.killTweensOf(root.querySelectorAll('*'));
    root.hidden = true;
    root.classList.remove('final', 'drawing');
    document.body.classList.remove('rv-open');
    const done = s;
    s = null;
    if (!silent) {
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      onClose && onClose({ practice: done.practice, winners: done.winners.slice(), team: done.team });
    }
  }

  function runPrepare() {
    const cur = s;
    cur.error = null;
    cur.ready = Promise.resolve()
      .then(() => cur.prepare())
      .then((res) => {
        if (s !== cur) return;
        cur.pool = res.pool || [];
        cur.bonusPool = res.bonusPool || [];
        cur.poolTokens = new Set(cur.pool.map((p) => p.token));
        cur.save = res.save || null;
        cur.winners = (res.winners || []).map((w) => ({ token: w.token, name: w.name, bonus: !!w.bonus }));
        if (cur.winners.length > cur.n) cur.n = clampN(cur.winners.length);
        cur.bonus = cur.winners.some((w) => w.bonus);
        cur.resumed = cur.winners.length > 0;
        stageErr.hidden = true;
      })
      .catch((err) => {
        if (s !== cur) return;
        cur.error = err;
        showStageError(err);
        throw err;
      });
    cur.ready.catch(() => {});
  }

  function showStageError(err) {
    stageErr.hidden = false;
    stageErr.replaceChildren(
      el('span', { text: `Couldn't save the reveal: ${err && err.message ? err.message : 'unknown error'} ` }),
      el('button', { type: 'button', class: 'btn btn-light btn-sm', text: 'Try again', onclick: () => runPrepare() }),
    );
  }

  /* ───────────── the reveal sequence ───────────── */

  function splitChars(node, text) {
    node.replaceChildren(...[...text].map((c) => el('span', { class: 'ch', text: c })));
    node.setAttribute('aria-label', text);
  }

  function finalState(team) {
    root.classList.add('final');
    $('#rvAnnounce', root).textContent = `${TEAM[team].live} ${$('#rvStat', root).textContent}`;
  }

  function play(team) {
    const G = window.gsap;
    if (!motion()) {
      finalState(team);
      return;
    }
    const sel = (q) => root.querySelector(q);
    const orb = sel('.rv-orb');
    const pre = sel('.rv-pre');
    const chars = root.querySelectorAll('#rvTitle .ch');
    G.set([sel('.rv-sky.sun'), sel('.rv-sky.shine'), sel('.rv-stars'), sel('.rv-sun'), sel('.rv-flash')], { opacity: 0, clearProps: 'transform' });
    G.set([sel('.rv-kicker'), sel('.rv-sub'), sel('.rv-stat'), sel('.rv-next')], { opacity: 0 });
    G.set(chars, { opacity: 0 });
    G.set([pre, orb], { display: 'block', opacity: 0, scale: 1, y: 0 });
    tl = G.timeline();
    tl.to(pre, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0.3)
      .fromTo(orb, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: 'back.out(2)' }, 0.6)
      .call(() => { const [x, y] = centerOf(orb); fx.converge(x, y, 80); }, null, 0.7)
      // three heartbeats, each bigger: the drum roll
      .to(orb, { scale: 1.3, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 1.7)
      .call(() => buzz(30), null, 1.7)
      .to(orb, { scale: 1.5, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 2.4)
      .call(() => buzz(40), null, 2.4)
      .to(orb, { scale: 1.75, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 3.05)
      .call(() => buzz(60), null, 3.05)
      .to(pre, { opacity: 0, y: -12, duration: 0.4 }, 3.35)
      .to(orb, { scale: 16, opacity: 0, duration: 0.65, ease: 'power3.in' }, 3.6)
      .to(sel('.rv-flash'), { opacity: 1, duration: 0.14 }, 4.1)
      .call(() => { G.set([pre, orb], { display: 'none' }); fx.boom(team); buzz([30, 60, 30, 60, 120]); }, null, 4.24)
      .set(sel('.rv-sky.' + team), { opacity: 1 }, 4.24)
      .to(sel('.rv-flash'), { opacity: 0, duration: 1.3, ease: 'power2.out' }, 4.3);
    if (team === 'sun') tl.fromTo(sel('.rv-sun'), { opacity: 1, yPercent: 70 }, { yPercent: 0, duration: 2.4, ease: 'power3.out' }, 4.24);
    else tl.fromTo(sel('.rv-stars'), { opacity: 0 }, { opacity: 0.9, duration: 1.6 }, 4.3);
    tl.fromTo(sel('.rv-kicker'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6 }, 4.35)
      .fromTo(chars, { yPercent: 120, opacity: 0, rotation: () => -25 + Math.random() * 50, scale: 0.6 },
        { yPercent: 0, opacity: 1, rotation: 0, scale: 1, stagger: 0.07, duration: 1.1, ease: 'back.out(2.2)' }, 4.45)
      .fromTo(sel('.rv-sub'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 5.2)
      .fromTo(sel('.rv-stat'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 }, 5.6)
      .fromTo(sel('.rv-next'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6 }, 5.9)
      .call(() => { finalState(team); fx.startRain(team); }, null, 4.6)
      .call(() => { G.set([sel('.rv-kicker'), sel('.rv-sub'), sel('.rv-stat'), sel('.rv-next'), chars], { clearProps: 'all' }); }, null, 6.6);
  }

  /* ───────────── the lantern draw ───────────── */

  async function goDraw() {
    if (!s) return;
    const cur = s;
    toDraw.disabled = true;
    try {
      await cur.ready;
    } catch {
      toDraw.disabled = false;
      return;
    }
    if (s !== cur) return;
    // Skip the rest of the reveal timeline if the host is quick.
    if (tl) { tl.progress(1); tl.kill(); tl = null; }
    finalState(cur.team);
    root.classList.add('drawing');
    fx.startRain(cur.team, 0.35);
    const show = () => {
      stage.hidden = true;
      draw.hidden = false;
      reelName.textContent = cur.winners.length ? 'Welcome back' : 'Ready?';
      reelName.className = '';
      render();
      drawBtn.focus({ preventScroll: true });
    };
    if (!motion()) return show();
    window.gsap.to(stage, {
      opacity: 0, y: -30, duration: 0.45, ease: 'power2.in',
      onComplete: () => {
        show();
        window.gsap.set(stage, { clearProps: 'opacity,transform' });
        window.gsap.fromTo(draw, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', clearProps: 'opacity,transform' });
      },
    });
  }

  const clampN = (n) => Math.max(MIN_N, Math.min(MAX_N, Math.round(Number(n) || 5)));
  const available = () => drawable({ pool: s.pool, bonusPool: s.bonusPool, winners: s.winners, absent: s.absent, bonus: s.bonus });

  function setN(n) {
    if (!s || s.spinning) return;
    s.n = Math.max(clampN(n), s.winners.length, MIN_N);
    s.n = Math.min(s.n, MAX_N);
    onN && onN(s.n);
    render();
  }

  function render() {
    if (!s) return;
    const { team, n, winners } = s;
    nOut.textContent = String(n);
    nMinus.disabled = s.spinning || n <= Math.max(MIN_N, winners.length);
    nPlus.disabled = s.spinning || n >= MAX_N;
    const teamLabel = TEAM[team].label;
    $('#drTitle', root).textContent = s.bonus ? 'Bonus round' : 'The lantern draw';
    $('#drSub', root).textContent = s.bonus
      ? `Everyone else who's here is in the lantern now · ${available().length} in the draw`
      : `Drawing from ${s.pool.length} ${s.pool.length === 1 ? 'guest' : 'guests'} who guessed ${teamLabel} · one entry per RSVP`;

    // Winner slots: N bulbs that light up one by one.
    const items = [];
    for (let i = 0; i < Math.max(n, winners.length); i++) {
      const w = winners[i];
      const li = el('li', { class: w ? (w.bonus ? 'on bonus' : 'on') : '' },
        el('span', { class: 'bulb', 'aria-hidden': 'true' }),
        el('span', { class: 'wname', text: w ? w.name : `Gift ${i + 1}` }),
        w && w.bonus ? el('span', { class: 'tagb', text: 'Bonus' }) : null);
      items.push(li);
    }
    winList.replaceChildren(...items);

    // People marked "not here" can be put back.
    absentRow.hidden = !s.absent.length;
    absentRow.replaceChildren(
      el('span', { class: 'absent-l', text: 'Not here (tap to put back):' }),
      ...s.absent.map((a, i) => el('button', {
        type: 'button', class: 'chip-back', 'aria-label': `Put ${a.name} back in the draw`,
        onclick: () => { if (!s || s.spinning) return; s.absent.splice(i, 1); live.textContent = `${a.name} is back in the draw.`; render(); },
      }, el('span', { text: a.name }), el('span', { 'aria-hidden': 'true', text: ' ↺' }))),
    );

    absentBtn.disabled = s.spinning || !winners.length;
    restartBtn.hidden = !winners.length || s.spinning;
    renderNotice();
    renderSave();
  }

  function renderNotice() {
    const { team, n, winners, pool } = s;
    const left = n - winners.length;
    const av = available().length;
    const teamWord = team === 'sun' ? 'Sun' : 'Shine';
    const btn = (text, cls, onclick) => el('button', { type: 'button', class: `btn ${cls}`, text, onclick });
    const startBonus = () => { s.bonus = true; s.kept = false; live.textContent = 'Bonus round! Everyone else who is here is in the draw.'; render(); drawBtn.focus({ preventScroll: true }); };
    const keep = () => { s.kept = true; render(); };
    let parts = null;
    let canSpin = !s.spinning;
    let label = winners.length ? 'Draw the next gift' : 'Draw gift 1';
    if (winners.length < n) label = `Draw gift ${winners.length + 1} of ${n}`;

    if (s.spinning) {
      parts = null;
    } else if (winners.length >= n) {
      parts = [el('p', { text: `All ${n} gifts drawn! 🎉 Congratulations, lucky lanterns.` })];
      canSpin = false;
      label = `All ${n} gifts drawn 🎉`;
    } else if (s.kept) {
      parts = [el('p', { text: `Leftover ${left === 1 ? 'gift' : 'gifts'} saved for later 💛` }), btn('Start a bonus round after all', 'btn-ghost-light', startBonus)];
      canSpin = false;
    } else if (!s.bonus && pool.length === 0) {
      parts = [el('p', { text: `Nobody guessed ${teamWord}! What a surprise 🙈 Draw the ${n === 1 ? 'gift' : n + ' gifts'} from everyone who's here instead?` }),
        btn('Start a bonus round', 'btn-glow', startBonus), btn('Keep them for later', 'btn-ghost-light', keep)];
      canSpin = false;
    } else if (!s.bonus && av === 0 && left > 0) {
      parts = [el('p', { text: `Every correct guesser has a gift! ${left} ${left === 1 ? 'gift' : 'gifts'} left.` }),
        btn('Bonus round: draw from everyone else here', 'btn-glow', startBonus), btn('Keep them for later', 'btn-ghost-light', keep)];
      canSpin = false;
    } else if (s.bonus && av === 0) {
      parts = [el('p', { text: "Everyone's been drawn. Thanks for playing!" })];
      canSpin = false;
    } else if (!s.bonus && pool.length < n && winners.length === 0) {
      parts = [el('p', { text: `Only ${pool.length} guessed right, so ${pool.length === 1 ? 'they win' : 'they all win'}! Spin to reveal them one by one.` })];
    } else if (s.resumed && winners.length) {
      parts = [el('p', { text: `Picked up where you left off: ${winners.length} ${winners.length === 1 ? 'winner' : 'winners'} already drawn.` })];
    }
    notice.hidden = !parts;
    if (parts) notice.replaceChildren(...parts);
    drawBtn.disabled = !canSpin || s.spinning;
    if (!s.spinning) drawBtn.textContent = label;
  }

  function renderSave() {
    saveEl.replaceChildren();
    if (s.practice) { saveEl.textContent = 'Practice run: winners are not saved.'; return; }
    if (!s.save) return;
    if (s.saveState === 'saving') saveEl.textContent = 'Saving…';
    else if (s.saveState === 'saved') saveEl.textContent = 'Saved to the Sheet ✓';
    else if (s.saveState === 'error') {
      saveEl.append(el('span', { text: "Couldn't save the winners. " }),
        el('button', { type: 'button', class: 'linkish', text: 'Retry', onclick: () => persist() }));
    }
  }

  let saveChain = Promise.resolve();
  function persist() {
    if (!s || s.practice || !s.save) return;
    const cur = s;
    const snapshot = cur.winners.map((w) => (w.bonus ? { token: w.token, name: w.name, bonus: true } : { token: w.token, name: w.name }));
    cur.saveState = 'saving';
    renderSave();
    saveChain = saveChain
      .then(() => cur.save(snapshot))
      .then(() => { cur.saveState = 'saved'; }, (err) => { cur.saveState = 'error'; toast && toast(`Couldn't save the winners: ${err.message}`); })
      .then(() => { if (s === cur) renderSave(); });
  }

  function spin() {
    if (!s || s.spinning || s.winners.length >= s.n) return;
    const av = available();
    if (!av.length) { render(); return; }
    s.resumed = false;
    // The winner is chosen now, before any animation.
    const win = av[cryptoInt(av.length)];
    const entry = { token: win.token, name: win.name, bonus: !s.poolTokens.has(win.token) };
    s.spinning = true;
    render();
    drawBtn.textContent = 'Drawing…';
    const cur = s;
    animateReel(av, win, () => {
      if (s !== cur) return;
      cur.winners.push(entry);
      cur.spinning = false;
      persist();
      render();
      const li = winList.children[cur.winners.length - 1];
      if (li && motion()) window.gsap.fromTo(li, { scale: 0.7, opacity: 0.3 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2.4)', clearProps: 'transform,opacity' });
      live.textContent = `${entry.name} wins a gift!${entry.bonus ? ' (bonus round)' : ''}`;
      lantern.classList.remove('flare');
      void lantern.offsetWidth;
      lantern.classList.add('flare');
      const [x, y] = centerOf(lantern);
      fx.burst(x, y, { n: 80, colors: COLORS[cur.team], speed: 10, gravity: 0.08, shape: 'spark', life: 90 });
      buzz([20, 40, 60]);
      drawBtn.focus({ preventScroll: true });
    });
  }

  function fitName(name) {
    const len = [...name].length;
    reelName.dataset.len = len > 22 ? 'xl' : len > 15 ? 'l' : len > 10 ? 'm' : 's';
  }

  function animateReel(av, win, done) {
    const land = () => {
      reelName.textContent = win.name;
      fitName(win.name);
      reelName.className = 'land';
      done();
    };
    if (reducedMotion()) { land(); return; }
    let delay = 40;
    let prev = '';
    const step = () => {
      if (!s) return;
      let nm = win.name;
      if (av.length > 1) {
        let guard = 0;
        do { nm = av[Math.floor(Math.random() * av.length)].name; } while ((nm === prev) && guard++ < 10);
      } else {
        nm = prev === '· · ·' ? win.name : '· · ·';
      }
      prev = nm;
      reelName.textContent = nm;
      fitName(nm);
      reelName.className = '';
      void reelName.offsetWidth;
      reelName.className = 'tick';
      delay *= 1.12; // each tick 12% slower: ~3.3 s in all
      if (delay > 420) { tickTimer = setTimeout(land, 260); return; }
      tickTimer = setTimeout(step, delay);
    };
    step();
  }

  function respin() {
    if (!s || s.spinning || !s.winners.length) return;
    const w = s.winners.pop();
    s.absent.push(w);
    live.textContent = `${w.name} isn't here. Re-spinning.`;
    persist();
    render();
    spin();
  }

  async function restart() {
    if (!s || s.spinning || !s.winners.length) return;
    if (!window.confirm(s.practice ? 'Start the practice draw over?' : 'Start over? This clears the saved winners.')) return;
    s.winners = [];
    s.absent = [];
    s.bonus = false;
    s.kept = false;
    reelName.textContent = 'Ready?';
    persist();
    render();
  }

  /* ───────────── wiring ───────────── */

  toDraw.addEventListener('click', goDraw);
  drawBtn.addEventListener('click', spin);
  absentBtn.addEventListener('click', respin);
  restartBtn.addEventListener('click', restart);
  nMinus.addEventListener('click', () => s && setN(s.n - 1));
  nPlus.addEventListener('click', () => s && setN(s.n + 1));
  $('#rvClose', root).addEventListener('click', () => close());

  root.addEventListener('keydown', (e) => {
    if (!s) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
    if (!draw.hidden && e.key === ' ' && (e.target === root || e.target === document.body || e.target === draw)) { e.preventDefault(); spin(); }
  });
  window.addEventListener('resize', () => { if (s) fx.size(); });

  return {
    open,
    close: () => close(),
    isOpen: () => !!s,
  };
}
