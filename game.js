(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');

  // ---------- 설정 ----------
  const BALLS = 10;                            // 스테이지당 공 개수
  const WIN = { hr: 45, hit: 85, foul: 130 };  // 타이밍 판정 범위 (ms)
  const DEPTH = 5;                             // 원근감 세기
  const FONT = '"Black Han Sans", system-ui, sans-serif';
  const PSCALE = 78;                           // 투수 그림 크기 (작을수록 큼)

  // mix: 구종별 출현 가중치. 가장 큰 가중치의 구종이 첫 공으로 나온다.
  const STAGES = [
    { name: '김정직', title: '정직한 신인', color: '#3b82f6', T: 0.9, need: 3, mix: { straight: 1 },
      intro: '난 정직하게 던진다. 진짜야. 믿어 봐.', hint: '공이 홈플레이트에 닿는 순간 스윙!' },
    { name: '정지맨', title: '시간을 멈추는 투수', color: '#a855f7', T: 0.85, need: 3, mix: { stop: 6, straight: 4 },
      intro: '공이 멈추면... 넌 언제 칠래?', hint: '멈췄던 공은 다시 출발할 때 더 빠르다.' },
    { name: '뻥카', title: '페이크의 달인', color: '#f97316', T: 0.85, need: 3, mix: { fake: 6, straight: 2, stop: 2 },
      intro: '던질까~ 말까~', hint: '중간에 사라지는 공은 가짜다. 진짜 공을 기다려라.' },
    { name: '거북토끼', title: '느림보 → 총알', color: '#22c55e', T: 0.8, need: 3, mix: { slowfast: 6, fake: 2, stop: 2 },
      intro: '천천히~ 천천히~ ...슝!', hint: '느린 공은 마지막에 갑자기 빨라진다.' },
    { name: '분신술사', title: '하나가 셋으로', color: '#ec4899', T: 0.8, need: 3, mix: { clone: 6, straight: 2, slowfast: 2 },
      intro: '셋 중에 진짜는 하나뿐~', hint: '진짜 공에만 그림자가 있다!' },
    { name: '부메랑', title: '돌아오는 공', color: '#14b8a6', T: 0.78, need: 3, mix: { boomerang: 6, clone: 2, stop: 2 },
      intro: '갔다가~ 다시 온다~', hint: '공이 되돌아갔다가 더 빠르게 날아온다.' },
    { name: '텔레포터', title: '순간이동 마구', color: '#6366f1', T: 0.76, need: 3, mix: { teleport: 6, boomerang: 2, fake: 2 },
      intro: '어디로 갔게?', hint: '공이 사라졌다가 더 가까운 곳에서 나타난다.' },
    { name: '투명인간', title: '보이지 않는 공', color: '#94a3b8', T: 0.75, need: 3, mix: { invisible: 6, teleport: 2, clone: 2 },
      intro: '공? 무슨 공?', hint: '공이 안 보이면 그림자를 봐라!' },
    { name: '춤신춤왕', title: '흔들리는 공', color: '#eab308', T: 0.72, need: 3, mix: { zigzag: 6, invisible: 2, slowfast: 2 },
      intro: '내 공은 춤을 춘다~', hint: '흔들려도 그림자는 거짓말을 안 한다.' },
    { name: '트롤킹', title: '모든 마구의 왕', color: '#ef4444', T: 0.7, need: 4, boss: true,
      mix: { straight: 1, stop: 1, fake: 1, slowfast: 1, clone: 1, boomerang: 1, teleport: 1, invisible: 1, zigzag: 1 },
      intro: '지금까지 본 건 연습이었다.', hint: '모든 마구가 섞여 나온다. 이번엔 홈런 4개!' },
  ];

  const LINES = {
    taunt: ['칠 수 있으면 쳐 봐~', '이번엔 진짜 던진다', '눈 감고 던질게', '내 공은 못 쳐', '집중해~', '긴장되지?'],
    strike: ['ㅋㅋㅋㅋ', '그걸 못 쳐?', '헛스윙 장인', '배트는 장식이야?', '다음 공도 못 칠걸'],
    hr: ['어...?', '운이야 운!', '다시 해!', '말도 안 돼...', '방금 건 연습이었어'],
    fool: ['속았지~ ㅋㅋ', '뻥이야~', '그걸 믿냐?', '낚였다!'],
  };

  // ---------- 유틸 ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // ---------- 저장 ----------
  const SAVE_KEY = 'troll-pitcher-v1';
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && Array.isArray(s.stars) && Array.isArray(s.best)) return s;
    } catch (e) { /* 저장소를 못 쓰면 새로 시작 */ }
    return { unlocked: 1, stars: [], best: [], muted: false };
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 무시 */ }
  }
  const save = loadSave();

  // ---------- 사운드 ----------
  let actx = null;
  let muted = !!save.muted;
  function audio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function noise(dur, { freq = 1000, q = 1, gain = 0.3, type = 'bandpass', sweep = null } = {}) {
    const a = audio();
    if (!a || muted) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, a.currentTime + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    src.connect(f);
    f.connect(g);
    g.connect(a.destination);
    src.start();
  }
  function tone(freq, dur, { type = 'sine', gain = 0.2, to = null, delay = 0 } = {}) {
    const a = audio();
    if (!a || muted) return;
    const t0 = a.currentTime + delay;
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  const SFX = {
    swing() { noise(0.18, { freq: 600, sweep: 2500, q: 0.8, gain: 0.22 }); },
    pitch() { noise(0.25, { freq: 900, sweep: 300, q: 1, gain: 0.07 }); },
    crack() { noise(0.08, { freq: 2500, q: 0.7, gain: 0.6, type: 'highpass' }); tone(900, 0.06, { type: 'square', gain: 0.08 }); },
    foul() { noise(0.06, { freq: 1800, q: 0.7, gain: 0.35, type: 'highpass' }); },
    homerun() {
      SFX.crack();
      noise(1.6, { freq: 900, q: 0.4, gain: 0.22 });
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', gain: 0.12, delay: 0.1 + i * 0.09 }));
    },
    mitt() { tone(110, 0.12, { gain: 0.35, to: 60 }); noise(0.05, { freq: 400, gain: 0.25 }); },
    strike() { tone(220, 0.25, { type: 'sawtooth', gain: 0.07, to: 110 }); },
    laugh() { [660, 590, 520, 470].forEach((f, i) => tone(f, 0.09, { type: 'square', gain: 0.05, delay: i * 0.1 })); },
    poof() { noise(0.15, { freq: 1500, q: 2, gain: 0.18 }); },
    stop() { tone(300, 0.15, { type: 'square', gain: 0.05 }); },
    zoom() { tone(400, 0.2, { type: 'sawtooth', gain: 0.05, to: 1200 }); },
    clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.12, delay: i * 0.12 })); },
    fail() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.1, delay: i * 0.18 })); },
    click() { tone(700, 0.05, { type: 'triangle', gain: 0.08 }); },
  };

  // ---------- 화면 / 원근 ----------
  let W = 0, H = 0;
  const V = { cx: 0, horizon: 0, S: 0, XS: 0 };
  let crowd = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    V.cx = W / 2;
    V.horizon = H * 0.3;
    V.S = H * 0.86 - V.horizon;
    V.XS = Math.min(W * 0.95, H * 0.75);
    buildCrowd();
  }

  // 월드 좌표(x: 좌우, h: 높이, z: 0=홈플레이트 ~ 1=투수) → 화면 좌표
  function proj(x, h, z) {
    const p = 1 / (1 + Math.max(z, -0.18) * DEPTH);
    return { x: V.cx + x * p * V.XS, y: V.horizon + (1 - h) * p * V.S, p };
  }

  function buildCrowd() {
    crowd = [];
    const top = V.horizon * 0.38, bottom = V.horizon * 0.94;
    const colors = ['#f87171', '#fbbf24', '#60a5fa', '#f1f5f9', '#34d399', '#f472b6'];
    const n = Math.min(1500, Math.floor((W * (bottom - top)) / 80));
    for (let i = 0; i < n; i++) {
      crowd.push({ x: Math.random() * W, y: rand(top, bottom), c: colors[i % colors.length], ph: rand(0, 6) });
    }
  }

  // ---------- 게임 상태 ----------
  const G = {
    mode: 'menu', // menu | intro | play | paused | over
    stageIdx: 0,
    stage: STAGES[clamp(save.unlocked, 1, STAGES.length) - 1],
    phase: 'ready', phaseT: 0, phaseDur: 1,
    time: 0, releaseT: -9,
    pitchNo: 0, pitch: null,
    results: [], homers: 0, score: 0, combo: 0,
    balls: [], real: null, hit: null,
    swung: false, swingTime: 0, swingAnim: -1,
    resolved: false, arrival: null,
    popups: [], fx: [], bubble: null,
    cheer: 0, shake: 0, laughT: 0, sadT: 0,
    clock: 0,
  };
  G.stageIdx = STAGES.indexOf(G.stage);

  function say(text, life = 1.4) { G.bubble = { text, t: 0, life }; }
  function popup(text, sub, color, size, life) { G.popups = [{ text, sub, color, size, life, t: 0 }]; }
  function puff(b) {
    const p = ballPos(b);
    G.fx.push({ x: p.x, h: p.h, z: b.z, t: 0 });
    SFX.poof();
  }
  function setPhase(ph, dur) { G.phase = ph; G.phaseT = dur; G.phaseDur = dur; }

  // ---------- 공 ----------
  function makeBall(type, base) {
    const b = {
      type, z: 1, base, speed: base, real: true, visible: true, shadow: true,
      xo: 0, ho: 0, xs: 0, xsT: 0, t: 0,
      x0: (-22 * V.S) / (PSCALE * V.XS), h0: 112 / PSCALE,   // 투수 손 위치
      xt: rand(-0.07, 0.07), ht: rand(0.38, 0.52), // 스트라이크존 안 도착 지점
      s: {}, gone: false, arrived: false,
    };
    const s = b.s;
    if (type === 'stop') { s.at = rand(0.35, 0.65); s.dur = rand(0.3, 1.1); }
    if (type === 'slowfast') b.speed = base * 0.33;
    if (type === 'boomerang') s.n = 1;
    if (type === 'teleport') s.at = rand(0.55, 0.7);
    if (type === 'zigzag') s.ph = rand(0, 6);
    if (type === 'fakeball') { b.real = false; s.at = rand(0.08, 0.3); }
    return b;
  }

  function ballPos(b) {
    const u = 1 - b.z;
    const uc = clamp(u, 0, 1);
    return {
      x: b.x0 + (b.xt - b.x0) * u + b.xo + b.xs,
      h: b.h0 + (b.ht - b.h0) * u + Math.sin(uc * Math.PI) * 0.06 + b.ho,
    };
  }

  function updateBall(b, dt) {
    const s = b.s;
    b.t += dt;
    switch (b.type) {
      case 'stop':
        if (!s.done && b.z <= s.at) {
          if (!s.on) { s.on = true; s.left = s.dur; b.speed = 0; say('멈춰!', 0.8); SFX.stop(); }
          s.left -= dt;
          b.xo = Math.sin(b.t * 60) * 0.006;
          if (s.left <= 0) { s.done = true; b.xo = 0; b.speed = b.base * 1.7; }
        }
        break;
      case 'slowfast':
        if (!s.done && b.z <= 0.42) { s.done = true; b.speed = b.base * 2.3; say('슝!', 0.7); SFX.zoom(); }
        break;
      case 'clone':
        if (!s.done && b.z <= 0.72) {
          s.done = true;
          SFX.poof();
          say('분신술!', 0.8);
          const mults = shuffle([0.72, 1, 1.4]);
          const offs = shuffle([-0.17, 0, 0.17]);
          const realIdx = Math.floor(Math.random() * 3);
          for (let i = 0; i < 3; i++) {
            if (i === realIdx) {
              b.speed = b.base * mults[i];
              b.xsT = offs[i];
            } else {
              G.balls.push(Object.assign({}, b, {
                type: 'ghost', real: false, shadow: false, s: {},
                speed: b.base * mults[i], xsT: offs[i],
              }));
            }
          }
        }
        break;
      case 'boomerang':
        if (!s.back && s.n > 0 && b.z <= 0.3) { s.back = true; b.speed = -b.base * 1.3; say('돌아와~', 0.8); SFX.zoom(); }
        else if (s.back && b.z >= 0.8) { s.back = false; s.n--; b.speed = b.base * 1.6; }
        break;
      case 'teleport':
        if (!s.done && b.z <= s.at) {
          if (!s.on) {
            s.on = true; s.left = rand(0.25, 0.6);
            puff(b);
            b.visible = false; b.shadow = false; b.speed = 0;
          }
          s.left -= dt;
          if (s.left <= 0) {
            s.done = true;
            b.z = rand(0.22, 0.36);
            b.visible = true; b.shadow = true; b.speed = b.base * 1.05;
            puff(b);
          }
        }
        break;
      case 'invisible':
        b.visible = !(b.z < 0.78 && b.z > 0.2);
        break;
      case 'zigzag': {
        const k = Math.max(0, b.z);
        b.xo = Math.sin(b.t * 11) * 0.16 * k;
        b.ho = Math.cos(b.t * 8) * 0.1 * k;
        b.speed = b.base * (1 + 0.55 * Math.sin(b.t * 6 + s.ph));
        break;
      }
      case 'fakeball':
        if (b.z <= s.at) { b.gone = true; puff(b); onFakeVanish(); return; }
        break;
    }
    b.xs += (b.xsT - b.xs) * Math.min(1, dt * 8);

    const z0 = b.z;
    b.z -= b.speed * dt;
    if (!b.arrived && z0 > 0 && b.z <= 0) {
      b.arrived = true;
      // 프레임 사이 정확한 도착 시각을 보간
      const at = G.time - dt + dt * (z0 / (z0 - b.z));
      if (b.real) onRealArrive(at);
      else { b.gone = true; puff(b); }
    }
    if (b.z < -0.12 && !b.gone) {
      b.gone = true;
      if (b.real) SFX.mitt();
    }
  }

  // ---------- 진행 ----------
  function choosePitch() {
    const mix = G.stage.mix;
    const keys = Object.keys(mix);
    let type;
    if (G.pitchNo === 0) {
      type = keys.reduce((a, k) => (mix[k] > mix[a] ? k : a), keys[0]);
    } else {
      let r = Math.random() * keys.reduce((t, k) => t + mix[k], 0);
      type = keys.find((k) => (r -= mix[k]) < 0) || keys[0];
    }
    const throwable = keys.filter((k) => k !== 'fake');
    const throwType = type === 'fake' ? pick(throwable.length ? throwable : ['straight']) : type;
    const fakes = type === 'fake' ? (G.stage.boss && Math.random() < 0.4 ? 2 : 1) : 0;
    return { type, throwType, fakes, base: 1 / (G.stage.T * rand(0.92, 1.08)) };
  }

  function startStage() {
    Object.assign(G, {
      mode: 'play', pitchNo: 0, results: [], homers: 0, score: 0, combo: 0,
      popups: [], fx: [], bubble: null, hit: null, swingAnim: -1, laughT: 0, sadT: 0,
    });
    show(null);
    preparePitch();
    say(G.stage.intro, 1.8);
  }

  function preparePitch() {
    G.balls = [];
    G.real = null;
    G.hit = null;
    G.swung = false;
    G.resolved = false;
    G.arrival = null;
    G.pitch = choosePitch();
    setPhase('ready', G.pitchNo === 0 ? 1.4 : rand(0.6, 1.1));
    if (G.pitchNo > 0 && Math.random() < 0.35) say(pick(LINES.taunt), 1.1);
  }

  function release() {
    G.releaseT = G.time;
    SFX.pitch();
    if (G.pitch.fakes > 0) {
      G.pitch.fakes--;
      G.balls.push(makeBall('fakeball', G.pitch.base));
      setPhase('fakeflight', 99);
    } else {
      G.real = makeBall(G.pitch.throwType, G.pitch.base);
      G.balls.push(G.real);
      setPhase('flight', 99);
    }
  }

  function onFakeVanish() {
    if (G.phase !== 'fakeflight') return;
    say(pick(LINES.fool), 1.0);
    SFX.laugh();
    setPhase('fakeout', 0.6);
  }

  function onRealArrive(at) {
    G.arrival = at;
    if (G.swung && !G.resolved) judge(G.swingTime - at);
  }

  function swing() {
    if (G.mode !== 'play' || G.swung) return;
    const ph = G.phase;
    if (ph !== 'windup' && ph !== 'fakeflight' && ph !== 'fakeout' && ph !== 'flight') return;
    G.swung = true;
    G.swingTime = G.time + (performance.now() - G.clock) / 1000;
    G.swingAnim = 0;
    SFX.swing();
    if (ph === 'fakeflight' || ph === 'fakeout' || (ph === 'windup' && G.pitch.fakes > 0)) {
      say(pick(LINES.fool), 1.2);
      SFX.laugh();
      resolve('strike', null, '가짜 공에 속았다!');
      return;
    }
    if (G.arrival !== null && !G.resolved) judge(G.swingTime - G.arrival);
  }

  function judge(diffSec) {
    const ms = diffSec * 1000;
    const ad = Math.abs(ms);
    if (ad <= WIN.hr) resolve('hr', ms);
    else if (ad <= WIN.hit) resolve('hit', ms);
    else if (ad <= WIN.foul) resolve('foul', ms);
    else {
      const amount = ad < 1000 ? ` (${Math.round(ad)}ms)` : '';
      resolve('strike', ms, (ms < 0 ? '헛스윙! 너무 빨라요' : '헛스윙! 너무 늦어요') + amount);
    }
  }

  function timingText(ms) {
    const a = Math.round(Math.abs(ms));
    if (a <= 12) return '완벽한 타이밍!';
    return ms < 0 ? `조금 빨라요 (${a}ms)` : `조금 늦어요 (${a}ms)`;
  }

  function resolve(kind, ms, label) {
    if (G.resolved) return;
    G.resolved = true;
    G.results.push(kind);
    if (kind === 'hr') {
      G.homers++;
      G.combo++;
      G.score += 100 * G.combo;
      const dist = Math.round(clamp(152 - Math.abs(ms) * 0.8 + rand(-6, 6), 105, 160));
      popup('홈런!!', `${dist}m · ${timingText(ms)}`, '#facc15', 66, 1.9);
      G.cheer = 1.6;
      G.shake = 0.5;
      G.sadT = 1.8;
      SFX.homerun();
      say(pick(LINES.hr), 1.6);
      launch(ms, kind);
      setPhase('result', 2.0);
    } else if (kind === 'hit') {
      G.combo = 0;
      G.score += 30;
      popup('안타!', timingText(ms), '#60a5fa', 54, 1.3);
      G.cheer = 0.5;
      SFX.crack();
      launch(ms, kind);
      setPhase('result', 1.4);
    } else if (kind === 'foul') {
      G.combo = 0;
      G.score += 5;
      popup('파울', timingText(ms), '#e2e8f0', 48, 1.2);
      SFX.foul();
      launch(ms, kind);
      setPhase('result', 1.2);
    } else {
      G.combo = 0;
      popup('스트라이크!', label || '보기만 했네...', '#f87171', 54, 1.3);
      SFX.strike();
      G.laughT = 1.0;
      if (!G.bubble || G.bubble.t > 0.3) say(pick(LINES.strike), 1.2);
      setPhase('result', 1.3);
    }
  }

  // 맞은 공을 날려 보낸다
  function launch(ms, kind) {
    const b = G.real;
    if (!b) return;
    const p = ballPos(b);
    b.gone = true;
    const dir = ms < 0 ? -1 : 1; // 빠르면 당겨쳐서 왼쪽, 늦으면 밀어쳐서 오른쪽
    const hit = { x: p.x, h: p.h, z: Math.max(b.z, 0), t: 0 };
    if (kind === 'hr') Object.assign(hit, { vz: 4.5, vh: 2.8, vx: (ms / WIN.hr) * 0.6 });
    else if (kind === 'hit') Object.assign(hit, { vz: 2.6, vh: 0.9, vx: (ms / WIN.hit) * 1.2 + rand(-0.3, 0.3) });
    else Object.assign(hit, { vz: -0.3, vh: 2.2, vx: dir * 2.5 });
    G.hit = hit;
  }

  function afterResult() {
    const remaining = BALLS - G.results.length;
    if (remaining <= 0 || G.homers + remaining < G.stage.need) endStage();
    else { G.pitchNo++; preparePitch(); }
  }

  function endStage() {
    const st = G.stage;
    const i = G.stageIdx;
    const clear = G.homers >= st.need;
    const stars = clear ? 1 + (G.homers >= st.need + 2) + (G.homers >= st.need + 4) : 0;
    const newBest = clear && G.score > (save.best[i] || 0);
    if (clear) {
      save.unlocked = Math.max(save.unlocked, Math.min(STAGES.length, i + 2));
      save.stars[i] = Math.max(save.stars[i] || 0, stars);
      save.best[i] = Math.max(save.best[i] || 0, G.score);
      writeSave();
    }
    G.mode = 'over';
    const last = i === STAGES.length - 1;
    $('res-title').textContent = clear ? (last ? '트롤킹 격파!' : '클리어!') : '실패...';
    $('res-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const lines = [`홈런 ${G.homers}/${st.need} · 점수 ${G.score}`];
    if (!clear && G.results.length < BALLS) lines.push('남은 공으로는 홈런이 모자라!');
    if (!clear) lines.push(`힌트: ${st.hint}`);
    if (newBest) lines.push('🎉 최고 기록!');
    if (clear && last) lines.push('모든 트롤 투수를 이겼다!');
    $('res-detail').innerHTML = lines.map(escapeHtml).join('<br>');
    const canNext = clear && !last;
    $('btn-next').classList.toggle('hidden', !canNext);
    $('btn-retry').className = canNext ? 'secondary' : 'primary';
    if (clear) { SFX.clear(); say(pick(LINES.hr), 2); } else { SFX.fail(); say(pick(LINES.strike), 2); }
    setTimeout(() => { if (G.mode === 'over') show('scr-result'); }, 700);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function updatePlay(dt) {
    G.phaseT -= dt;
    switch (G.phase) {
      case 'ready':
        if (G.phaseT <= 0) setPhase('windup', 0.55);
        break;
      case 'windup':
        if (G.phaseT <= 0) release();
        break;
      case 'fakeout':
        if (G.phaseT <= 0) setPhase('windup', 0.4);
        break;
      case 'flight':
        if (G.arrival !== null && !G.resolved && !G.swung && G.time - G.arrival > WIN.foul / 1000) resolve('strike', null);
        break;
      case 'result':
        if (G.phaseT <= 0) afterResult();
        break;
    }
    for (let i = 0; i < G.balls.length; i++) {
      const b = G.balls[i];
      if (!b.gone) updateBall(b, dt);
    }
  }

  function updateFx(dt) {
    for (const p of G.popups) p.t += dt;
    G.popups = G.popups.filter((p) => p.t < p.life);
    for (const f of G.fx) f.t += dt;
    G.fx = G.fx.filter((f) => f.t < 0.4);
    if (G.bubble) { G.bubble.t += dt; if (G.bubble.t > G.bubble.life) G.bubble = null; }
    if (G.swingAnim >= 0) { G.swingAnim += dt; if (G.swingAnim > 0.75) G.swingAnim = -1; }
    if (G.hit) {
      const h = G.hit;
      h.t += dt;
      h.x += h.vx * dt; h.z += h.vz * dt; h.h += h.vh * dt;
      h.vh -= 2.2 * dt;
      if (h.h < 0 && h.vh < 0) { h.h = 0; h.vh *= -0.35; h.vz *= 0.6; h.vx *= 0.6; }
    }
    G.cheer = Math.max(0, G.cheer - dt);
    G.shake = Math.max(0, G.shake - dt * 1.5);
    G.laughT = Math.max(0, G.laughT - dt);
    G.sadT = Math.max(0, G.sadT - dt);
  }

  // ---------- 그리기 ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function groundPoly(pts) {
    ctx.beginPath();
    pts.forEach(([x, z], i) => {
      const p = proj(x, 0, z);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
  }

  function groundEllipse(z, rx, rz) {
    const c = proj(0, 0, z);
    const top = proj(0, 0, z + rz).y, bottom = proj(0, 0, z - rz).y;
    ctx.beginPath();
    ctx.ellipse(c.x, (top + bottom) / 2, rx * c.p * V.XS, (bottom - top) / 2, 0, 0, Math.PI * 2);
  }

  function drawField() {
    const hz = V.horizon;
    // 하늘
    let g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#08142e');
    g.addColorStop(1, '#1d3f8f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hz);
    // 조명
    for (const lx of [W * 0.1, W * 0.9]) {
      const lg = ctx.createRadialGradient(lx, hz * 0.14, 0, lx, hz * 0.14, hz * 0.5);
      lg.addColorStop(0, 'rgba(255,250,220,0.55)');
      lg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(lx - hz * 0.5, 0, hz, hz);
    }
    // 관중석
    const st = hz * 0.36;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, st, W, hz - st);
    const jump = G.cheer > 0 ? Math.min(1, G.cheer) : 0;
    for (const c of crowd) {
      const dy = jump ? Math.abs(Math.sin(G.clock / 90 + c.ph)) * 4 * jump : 0;
      ctx.fillStyle = c.c;
      ctx.fillRect(c.x, c.y - dy, 3, 3);
    }
    // 펜스
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, hz - hz * 0.07, W, hz * 0.07);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, hz - hz * 0.07, W, 2);
    // 잔디 줄무늬
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, hz, W, H - hz);
    for (let z = 8; z > -0.2; z -= 0.5) {
      if (Math.round(z * 2) % 2 !== 0) continue;
      const y1 = proj(0, 0, z).y, y2 = proj(0, 0, Math.max(z - 0.5, -0.18)).y;
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(0, y1, W, y2 - y1 + 1);
    }
    // 내야
    ctx.fillStyle = '#c2884d';
    groundPoly([[0, -0.05], [1.85, 1.5], [0, 3.4], [-1.85, 1.5]]);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    groundPoly([[0, 0.14], [1.3, 1.5], [0, 2.7], [-1.3, 1.5]]);
    ctx.fill();
    // 파울 라인
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      const a = proj(0, 0, 0), b = proj(s * 8, 0, 8);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // 마운드, 홈 주변 흙
    ctx.fillStyle = '#c2884d';
    groundEllipse(1, 0.28, 0.14);
    ctx.fill();
    groundEllipse(0, 0.3, 0.06);
    ctx.fill();
    // 베이스
    ctx.fillStyle = '#fff';
    for (const [bx, bz] of [[1.3, 1.5], [0, 2.7], [-1.3, 1.5]]) {
      groundPoly([[bx - 0.06, bz], [bx, bz + 0.06], [bx + 0.06, bz], [bx, bz - 0.06]]);
      ctx.fill();
    }
    groundPoly([[-0.07, 0.02], [0.07, 0.02], [0.07, 0.005], [0, -0.012], [-0.07, 0.005]]);
    ctx.fill();
    // 타석
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    for (const s of [-1, 1]) {
      groundPoly([[s * 0.11, -0.03], [s * 0.3, -0.03], [s * 0.3, 0.05], [s * 0.11, 0.05]]);
      ctx.stroke();
    }
  }

  function drawZone() {
    const a = proj(-0.1, 0.62, 0), b = proj(0.1, 0.32, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.setLineDash([]);
  }

  function pitcherPose() {
    if (G.mode === 'menu' || G.mode === 'intro') return { arm: 1.9, ball: true, face: 'smirk' };
    if (G.phase === 'fakeout' || G.laughT > 0) return { arm: 1.9, ball: G.phase === 'fakeout', face: 'laugh' };
    if (G.sadT > 0) return { arm: 1.9, ball: false, face: 'sad' };
    if (G.phase === 'windup') {
      const q = 1 - G.phaseT / G.phaseDur;
      return { arm: lerp(1.9, -2.3, easeOut(clamp(q, 0, 1))), ball: true, face: 'focus' };
    }
    if ((G.phase === 'flight' || G.phase === 'fakeflight') && G.time - G.releaseT < 0.3) return { arm: 0.9, ball: false, face: 'focus' };
    return { arm: 1.9, ball: G.phase === 'ready', face: 'smirk' };
  }

  function drawPitcher() {
    const st = G.stage;
    const foot = proj(0, 0, 1);
    const u = (foot.p * V.S) / PSCALE;
    const pose = pitcherPose();
    const t = G.clock / 1000;
    const bob = pose.face === 'laugh' ? Math.sin(t * 40) * 1.5 : Math.sin(t * 3) * 1.2;
    ctx.save();
    ctx.translate(foot.x, foot.y);
    ctx.scale(u, u);
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
    // 다리
    ctx.fillStyle = '#334155';
    ctx.fillRect(-14, -38, 11, 36);
    ctx.fillRect(3, -38, 11, 36);
    ctx.fillStyle = '#111827';
    ctx.fillRect(-16, -4, 14, 5);
    ctx.fillRect(2, -4, 14, 5);
    ctx.translate(pose.face === 'laugh' ? bob : 0, pose.face === 'laugh' ? 0 : bob);
    // 몸통
    ctx.fillStyle = st.color;
    rr(-19, -82, 38, 48, 9); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(G.stageIdx + 1), 0, -58);
    // 글러브 팔
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    const gA = pose.arm < 0 ? -0.4 : 1.2;
    ctx.beginPath(); ctx.moveTo(17, -74); ctx.lineTo(17 + Math.cos(gA) * 30, -74 + Math.sin(gA) * 30); ctx.stroke();
    ctx.fillStyle = '#92400e';
    ctx.beginPath(); ctx.arc(17 + Math.cos(gA) * 32, -74 + Math.sin(gA) * 32, 8, 0, Math.PI * 2); ctx.fill();
    // 던지는 팔
    const hx = -17 + Math.cos(pose.arm) * 36, hy = -74 + Math.sin(pose.arm) * 36;
    ctx.strokeStyle = st.color;
    ctx.beginPath(); ctx.moveTo(-17, -74); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#f5c9a0';
    ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
    if (pose.ball) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(hx, hy - 3, 4, 0, Math.PI * 2); ctx.fill();
    }
    // 머리
    ctx.fillStyle = '#f5c9a0';
    ctx.beginPath(); ctx.arc(0, -100, 17, 0, Math.PI * 2); ctx.fill();
    // 모자
    ctx.fillStyle = st.color;
    ctx.beginPath(); ctx.arc(0, -104, 17, Math.PI, 0); ctx.fill();
    ctx.fillRect(-20, -106, 40, 5);
    // 얼굴
    ctx.strokeStyle = '#1f2937';
    ctx.fillStyle = '#1f2937';
    ctx.lineWidth = 2.5;
    if (pose.face === 'laugh') {
      ctx.beginPath(); ctx.moveTo(-10, -98); ctx.lineTo(-4, -96); ctx.moveTo(10, -98); ctx.lineTo(4, -96); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -92, 7, 0, Math.PI); ctx.fill();
    } else if (pose.face === 'sad') {
      ctx.beginPath(); ctx.arc(-6, -97, 2, 0, Math.PI * 2); ctx.arc(6, -97, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -86, 6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath(); ctx.arc(14, -104, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(-6, -97, 2, 0, Math.PI * 2); ctx.arc(6, -97, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-11, -103); ctx.lineTo(-3, -101); ctx.moveTo(11, -103); ctx.lineTo(3, -101); ctx.stroke();
      ctx.beginPath();
      if (pose.face === 'focus') { ctx.moveTo(-5, -90); ctx.lineTo(5, -90); }
      else ctx.arc(2, -93, 6, 0.2, Math.PI - 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShadow(b) {
    if (b.gone || !b.shadow) return;
    const pos = ballPos(b);
    const P = proj(pos.x, 0, b.z);
    const r = Math.max(1.5, 0.028 * V.XS * P.p);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(P.x, P.y, r * 1.1, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawBallAt(x, h, z) {
    const P = proj(x, h, z);
    const r = Math.max(1.5, 0.028 * V.XS * P.p);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, Math.PI * 2); ctx.fill();
    if (r > 6) {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath(); ctx.arc(P.x - r * 1.1, P.y, r * 0.8, -0.8, 0.8); ctx.stroke();
      ctx.beginPath(); ctx.arc(P.x + r * 1.1, P.y, r * 0.8, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke();
    }
  }

  function batterGeom() {
    const k = V.XS / 600;
    const zone = proj(0, 0.47, 0);
    return { k, hx: zone.x - 0.27 * V.XS, hy: zone.y + 0.03 * V.XS, L: 0.3 * V.XS };
  }

  function drawBatterBody() {
    const { k, hx, hy } = batterGeom();
    const s = G.swingAnim >= 0 ? clamp(G.swingAnim / 0.13, 0, 1) : 0;
    const twist = G.swingAnim >= 0 && G.swingAnim < 0.45 ? s * 14 * k : 0;
    ctx.save();
    ctx.lineCap = 'round';
    // 다리
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 26 * k;
    ctx.beginPath();
    ctx.moveTo(hx - 80 * k, hy + 80 * k); ctx.lineTo(hx - 130 * k, hy + 240 * k);
    ctx.moveTo(hx - 60 * k, hy + 80 * k); ctx.lineTo(hx - 10 * k, hy + 240 * k);
    ctx.stroke();
    // 몸통
    ctx.fillStyle = '#e5e7eb';
    rr(hx - 112 * k + twist, hy - 40 * k, 74 * k, 125 * k, 22 * k); ctx.fill();
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `${30 * k}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('7', hx - 75 * k + twist, hy + 15 * k);
    // 헬멧
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath(); ctx.arc(hx - 75 * k + twist * 1.3, hy - 68 * k, 30 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(hx - 86 * k + twist * 1.3, hy - 80 * k, 9 * k, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function batAngle() {
    const a0 = -2.0, a1 = 0.45;
    const t = G.swingAnim;
    if (t < 0) return { a: a0, sy: 1 };
    if (t < 0.13) { const p = easeOut(t / 0.13); return { a: lerp(a0, a1, p), sy: lerp(1, 0.35, Math.min(1, (t / 0.13) * 1.5)) }; }
    if (t < 0.45) return { a: a1, sy: 0.35 };
    const p = clamp((t - 0.45) / 0.3, 0, 1);
    return { a: lerp(a1, a0, p), sy: lerp(0.35, 1, p) };
  }

  function drawBat() {
    const { k, hx, hy, L } = batterGeom();
    const { a, sy } = batAngle();
    const ex = hx + Math.cos(a) * L, ey = hy + Math.sin(a) * L * sy;
    ctx.save();
    ctx.lineCap = 'round';
    // 팔
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 18 * k;
    ctx.beginPath(); ctx.moveTo(hx - 60 * k, hy - 20 * k); ctx.lineTo(hx, hy); ctx.stroke();
    // 배트
    ctx.strokeStyle = '#7c4a1e';
    ctx.lineWidth = 9 * k;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lerp(hx, ex, 0.45), lerp(hy, ey, 0.45)); ctx.stroke();
    ctx.strokeStyle = '#d6a35c';
    ctx.lineWidth = 15 * k;
    ctx.beginPath(); ctx.moveTo(lerp(hx, ex, 0.4), lerp(hy, ey, 0.4)); ctx.lineTo(ex, ey); ctx.stroke();
    // 장갑
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.arc(hx, hy, 9 * k, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawFx() {
    for (const f of G.fx) {
      const P = proj(f.x, f.h, f.z);
      const r = (0.04 + f.t * 0.3) * V.XS * P.p;
      ctx.strokeStyle = `rgba(255,255,255,${1 - f.t / 0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawPopups() {
    for (const p of G.popups) {
      const intro = Math.min(1, p.t / 0.15);
      const alpha = Math.min(intro, clamp((p.life - p.t) / 0.3, 0, 1));
      const scale = p.t < 0.15 ? 0.6 + intro * 0.5 : 1.1 - Math.min(0.1, p.t - 0.15);
      const y = V.horizon + V.S * 0.2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2, y);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const size = Math.min(p.size, W / (p.text.length * 0.9));
      ctx.font = `${size}px ${FONT}`;
      ctx.lineWidth = 8;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(2,6,23,0.85)';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      if (p.sub) {
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.lineWidth = 5;
        ctx.strokeText(p.sub, 0, size * 0.75);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(p.sub, 0, size * 0.75);
      }
      ctx.restore();
    }
  }

  function drawBubble() {
    const b = G.bubble;
    if (!b) return;
    const head = proj(0, 140 / PSCALE, 1);
    ctx.save();
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(b.text).width;
    const w = tw + 24, h = 34;
    const x = clamp(head.x + 20, 8, W - w - 8);
    const y = Math.max(8, head.y - 44);
    ctx.globalAlpha = Math.min(1, b.t / 0.1, (b.life - b.t) / 0.2);
    ctx.fillStyle = '#fff';
    rr(x, y, w, h, 12); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 10, y + h - 2); ctx.lineTo(head.x + 4, head.y - 4); ctx.lineTo(x + 26, y + h - 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text, x + 12, y + h / 2 + 1);
    ctx.restore();
  }

  function drawHUD() {
    const st = G.stage;
    const x = 14, y = 14;
    ctx.save();
    ctx.fillStyle = 'rgba(2,6,23,0.6)';
    rr(x - 4, y - 4, 232, 76, 12); ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = `16px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(`STAGE ${G.stageIdx + 1} · ${st.name}`, x + 6, y + 4);
    const colors = { hr: '#facc15', hit: '#60a5fa', foul: '#cbd5e1', strike: '#ef4444' };
    for (let i = 0; i < BALLS; i++) {
      const r = G.results[i];
      ctx.beginPath();
      ctx.arc(x + 13 + i * 21, y + 37, 7, 0, Math.PI * 2);
      ctx.fillStyle = colors[r] || 'rgba(255,255,255,0.14)';
      ctx.fill();
      if (i === G.results.length && G.mode === 'play') {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    const combo = G.combo >= 2 ? `   🔥${G.combo}연속` : '';
    ctx.fillText(`홈런 ${G.homers}/${st.need}   점수 ${G.score}${combo}`, x + 6, y + 52);
    ctx.restore();

    let hint = null;
    if (G.mode === 'play' && G.pitchNo < 3) hint = G.stageIdx === 0 ? '화면을 탭하거나 스페이스바로 스윙!' : st.hint;
    if (hint) {
      ctx.save();
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(2,6,23,0.8)';
      ctx.strokeText(hint, W / 2, H - 18);
      ctx.fillStyle = '#fef08a';
      ctx.fillText(hint, W / 2, H - 18);
      ctx.restore();
    }
  }

  function draw() {
    ctx.save();
    if (G.shake > 0) ctx.translate(rand(-1, 1) * G.shake * 10, rand(-1, 1) * G.shake * 10);
    drawField();
    drawPitcher();
    drawZone();
    const live = G.balls.filter((b) => !b.gone).sort((a, b) => b.z - a.z);
    live.forEach(drawShadow);
    drawBatterBody();
    for (const b of live) {
      if (!b.visible) continue;
      const p = ballPos(b);
      drawBallAt(p.x, p.h, b.z);
    }
    if (G.hit) drawBallAt(G.hit.x, G.hit.h, G.hit.z);
    drawFx();
    drawBat();
    ctx.restore();
    drawPopups();
    drawBubble();
    if (G.mode === 'play' || G.mode === 'paused' || G.mode === 'over') drawHUD();
  }

  // ---------- 루프 ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    G.clock = now;
    if (G.mode !== 'paused') {
      if (G.mode === 'play') { G.time += dt; updatePlay(dt); }
      else if (G.mode === 'over') { G.time += dt; for (const b of G.balls) if (!b.gone) updateBall(b, dt); }
      updateFx(dt);
    }
    draw();
    requestAnimationFrame(frame);
  }

  // ---------- 화면 전환 ----------
  function show(id) {
    document.querySelectorAll('.overlay').forEach((el) => el.classList.toggle('hidden', el.id !== id));
    $('btn-pause').classList.toggle('hidden', !(id === null && G.mode === 'play'));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function buildSelect() {
    const grid = $('stage-grid');
    grid.innerHTML = '';
    STAGES.forEach((st, i) => {
      const btn = document.createElement('button');
      btn.className = 'stage-btn';
      const locked = i + 1 > save.unlocked;
      btn.disabled = locked;
      const stars = save.stars[i] || 0;
      btn.innerHTML = `<span class="n">${i + 1}</span><span class="nm">${locked ? '🔒' : escapeHtml(st.name)}</span>` +
        `<span class="st">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
      btn.addEventListener('click', () => { SFX.click(); openIntro(i); });
      grid.appendChild(btn);
    });
  }

  function openSelect() {
    G.mode = 'menu';
    buildSelect();
    show('scr-select');
  }

  function openIntro(i) {
    G.stageIdx = i;
    G.stage = STAGES[i];
    G.mode = 'intro';
    G.balls = []; G.hit = null; G.results = []; G.popups = []; G.bubble = null;
    const st = G.stage;
    $('intro-num').textContent = `STAGE ${i + 1}`;
    $('intro-name').textContent = st.name;
    $('intro-title').textContent = st.title;
    $('intro-line').textContent = `“${st.intro}”`;
    $('intro-mission').textContent = `공 ${BALLS}개 중 홈런 ${st.need}개!`;
    $('intro-hint').textContent = `💡 ${st.hint}`;
    show('scr-intro');
  }

  function pause() {
    if (G.mode !== 'play') return;
    G.mode = 'paused';
    show('scr-pause');
  }
  function resume() {
    if (G.mode !== 'paused') return;
    G.mode = 'play';
    show(null);
  }

  function bind(id, fn) {
    $(id).addEventListener('click', (e) => { SFX.click(); e.currentTarget.blur(); fn(); });
  }
  bind('btn-start', openSelect);
  bind('btn-back', () => { G.mode = 'menu'; show('scr-title'); });
  bind('btn-play', startStage);
  bind('btn-intro-back', openSelect);
  bind('btn-next', () => openIntro(G.stageIdx + 1));
  bind('btn-retry', startStage);
  bind('btn-res-select', openSelect);
  bind('btn-pause', pause);
  bind('btn-resume', resume);
  bind('btn-pause-retry', startStage);
  bind('btn-pause-select', openSelect);

  function updateMuteBtn() {
    $('btn-mute').textContent = muted ? '🔇' : '🔊';
    $('btn-mute').setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
  }
  $('btn-mute').addEventListener('click', (e) => {
    muted = !muted;
    save.muted = muted;
    writeSave();
    updateMuteBtn();
    e.currentTarget.blur();
  });
  updateMuteBtn();

  // ---------- 입력 ----------
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio();
    swing();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'KeyJ') {
      if (G.mode === 'play') {
        e.preventDefault();
        if (!e.repeat) swing();
      }
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (G.mode === 'play') pause();
      else if (G.mode === 'paused') resume();
    } else if (e.code === 'Enter') {
      const btn = document.querySelector('.overlay:not(.hidden) .primary:not(.hidden)');
      if (btn) { e.preventDefault(); btn.click(); }
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('resize', resize);

  resize();
  requestAnimationFrame(frame);
})();
