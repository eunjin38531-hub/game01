(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const buf = document.createElement('canvas'); // 픽셀아트를 그리는 저해상도 버퍼
  const g = buf.getContext('2d');

  // ---------- 설정 ----------
  const BALLS = 5;                             // 스테이지당 공 개수
  const WIN = { hr: 45, hit: 85, foul: 130 };  // 타이밍 판정 범위 (ms)
  const CAM = 2.5;                             // 카메라가 홈플레이트 뒤로 떨어진 거리
  const KH = 63;                               // 높이 1 → 픽셀 (p=1 기준)
  const FENCE_Z = 4.4;
  const FONT = '"Galmuri11", monospace';
  const BASES = [[1.06, 1.06], [0, 2.12], [-1.06, 1.06]];
  const FIELDERS = [[0.98, 1.3], [0.5, 1.85], [-0.5, 1.85], [-0.98, 1.3], [-1.7, 3.1], [0, 3.6], [1.7, 3.1]];
  const BATTER = { x: -0.17, z: 0.03 };

  const PAL = {
    outline: '#1d1530', skin: '#f4c39a', skinD: '#d8946a', pants: '#f3f3f7', pantsD: '#c4c4d4',
    shoe: '#2a2838', glove: '#a0602e', eye: '#24192c', white: '#ffffff', mouth: '#8a2e3c',
    sweat: '#8fd3ff', bat: '#e0a95e', batD: '#8b5a2b', red: '#e5413b', redD: '#a82a2a', redL: '#ff7b6b',
    belt: '#3a3350',
  };

  // mix: 구종별 출현 가중치. 가장 큰 가중치의 구종이 첫 공으로 나온다.
  const STAGES = [
    { name: '김정직', title: '정직한 신인', color: '#3b82f6', T: 0.9, need: 2, mix: { straight: 1 },
      intro: '난 정직하게 던진다. 진짜야.', hint: '공이 홈플레이트에 닿는 순간 스윙!' },
    { name: '정지맨', title: '시간을 멈추는 투수', color: '#a855f7', T: 0.85, need: 2, mix: { stop: 6, straight: 4 },
      intro: '공이 멈추면... 넌 언제 칠래?', hint: '멈췄던 공은 다시 출발할 때 더 빠르다.' },
    { name: '뻥카', title: '페이크의 달인', color: '#f97316', T: 0.85, need: 2, mix: { fake: 6, straight: 2, stop: 2 },
      intro: '던질까~ 말까~', hint: '중간에 사라지는 공은 가짜다. 진짜 공을 기다려라.' },
    { name: '거북토끼', title: '느림보 → 총알', color: '#22c55e', T: 0.8, need: 2, mix: { slowfast: 6, fake: 2, stop: 2 },
      intro: '천천히~ 천천히~ ...슝!', hint: '느린 공은 마지막에 갑자기 빨라진다.' },
    { name: '분신술사', title: '하나가 셋으로', color: '#ec4899', T: 0.8, need: 2, mix: { clone: 6, straight: 2, slowfast: 2 },
      intro: '셋 중에 진짜는 하나뿐~', hint: '진짜 공에만 그림자가 있다!' },
    { name: '부메랑', title: '돌아오는 공', color: '#14b8a6', T: 0.78, need: 2, mix: { boomerang: 6, clone: 2, stop: 2 },
      intro: '갔다가~ 다시 온다~', hint: '공이 되돌아갔다가 더 빠르게 날아온다.' },
    { name: '텔레포터', title: '순간이동 마구', color: '#6366f1', T: 0.76, need: 2, mix: { teleport: 6, boomerang: 2, fake: 2 },
      intro: '어디로 갔게?', hint: '공이 사라졌다가 더 가까운 곳에서 나타난다.' },
    { name: '투명인간', title: '보이지 않는 공', color: '#94a3b8', T: 0.75, need: 2, mix: { invisible: 6, teleport: 2, clone: 2 },
      intro: '공? 무슨 공?', hint: '공이 안 보이면 그림자를 봐라!' },
    { name: '춤신춤왕', title: '흔들리는 공', color: '#eab308', T: 0.72, need: 2, mix: { zigzag: 6, invisible: 2, slowfast: 2 },
      intro: '내 공은 춤을 춘다~', hint: '흔들려도 그림자는 거짓말을 안 한다.' },
    { name: '트롤킹', title: '모든 마구의 왕', color: '#ef4444', T: 0.7, need: 3, boss: true,
      mix: { straight: 1, stop: 1, fake: 1, slowfast: 1, clone: 1, boomerang: 1, teleport: 1, invisible: 1, zigzag: 1 },
      intro: '지금까지 본 건 연습이었다.', hint: '모든 마구가 섞여 나온다. 이번엔 홈런 3개!' },
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
  function seeded(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, amt) {
    const [r, gg, b] = hexRgb(hex).map((v) => clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255));
    return '#' + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
  }

  // ---------- 저장 ----------
  const SAVE_KEY = 'troll-pitcher-v1';
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && Array.isArray(s.stars) && Array.isArray(s.best)) return s;
    } catch (e) { /* 저장소를 못 쓰면 새로 시작 */ }
    return { stars: [], best: [], muted: false };
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
    const nb = a.createBuffer(1, len, a.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = nb;
    const f = a.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, a.currentTime + dur);
    const gn = a.createGain();
    gn.gain.setValueAtTime(gain, a.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    src.connect(f);
    f.connect(gn);
    gn.connect(a.destination);
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
    const gn = a.createGain();
    gn.gain.setValueAtTime(gain, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(gn);
    gn.connect(a.destination);
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
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'square', gain: 0.06, delay: 0.1 + i * 0.09 }));
    },
    pop() { noise(0.12, { freq: 700, q: 1.5, gain: 0.2 }); tone(180, 0.15, { type: 'triangle', gain: 0.08, to: 90 }); },
    mitt() { tone(110, 0.12, { gain: 0.35, to: 60 }); noise(0.05, { freq: 400, gain: 0.25 }); },
    strike() { tone(220, 0.25, { type: 'sawtooth', gain: 0.07, to: 110 }); },
    laugh() { [660, 590, 520, 470].forEach((f, i) => tone(f, 0.09, { type: 'square', gain: 0.05, delay: i * 0.1 })); },
    poof() { noise(0.15, { freq: 1500, q: 2, gain: 0.18 }); },
    stop() { tone(300, 0.15, { type: 'square', gain: 0.05 }); },
    zoom() { tone(400, 0.2, { type: 'sawtooth', gain: 0.05, to: 1200 }); },
    clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'square', gain: 0.06, delay: i * 0.12 })); },
    fail() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.1, delay: i * 0.18 })); },
    click() { tone(700, 0.05, { type: 'square', gain: 0.04 }); },
  };

  // ---------- 화면 / 원근 ----------
  let W = 0, H = 0, DPR = 1, PX = 2, LW = 0, LH = 0, U = 2;
  const L = { cx: 0, hz: 0, KX: 0, KY: 0, fenceY: 0, wallTop: 0, standsTop: 0 };
  let bg = null;
  let crowd = [];
  let lights = [];

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    PX = Math.max(2, Math.floor(Math.min(W, H) / 200)); // 픽셀 하나 = CSS PX픽셀
    U = PX >= 4 ? 2 : 1.5;                               // UI 글자 단위
    LW = Math.ceil(W / PX);
    LH = Math.ceil(H / PX);
    buf.width = LW;
    buf.height = LH;
    L.cx = Math.floor(LW / 2);
    const span = Math.min(LW * 0.44, LH * 0.62);         // 1루까지의 화면 거리
    L.KX = span / (1.06 / (1.06 + CAM));
    L.KY = Math.min(LH * 2.2, L.KX * 1.25);
    const homeY = LH * (LW >= LH ? 0.76 : 0.68);
    L.hz = homeY - L.KY / CAM;
    L.fenceY = Math.round(L.hz + L.KY / (FENCE_Z + CAM));
    L.wallTop = L.fenceY - 6;
    L.standsTop = Math.max(6, Math.round(Math.max(L.fenceY - 80, L.fenceY * 0.2)));
    buildBackground();
    buildCrowd();
  }

  // 월드 좌표(x: 좌우, h: 높이, z: 0=홈플레이트 ~ 1=마운드) → 버퍼 좌표
  function proj(x, h, z) {
    const p = 1 / (Math.max(z, -1.2) + CAM);
    return { x: L.cx + x * p * L.KX, y: L.hz + p * L.KY - h * p * KH, p };
  }

  // ---------- 배경 (픽셀 단위로 직접 칠함) ----------
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const C = {
    sky0: hexRgb('#141c44'), sky1: hexRgb('#2b4590'), star: hexRgb('#cfd8ff'),
    stands: hexRgb('#2a2346'), standsD: hexRgb('#1f1a36'),
    wall: hexRgb('#22603d'), wallL: hexRgb('#2b7a4c'), wallTop: hexRgb('#f5d142'),
    ads: [hexRgb('#e5413b'), hexRgb('#2f80ed'), hexRgb('#f5d142'), hexRgb('#ffffff')],
    g1: hexRgb('#3e9e4a'), g2: hexRgb('#4cb258'), gD: hexRgb('#358a40'),
    dirt: hexRgb('#cf8350'), dirtD: hexRgb('#b86e40'), dirtL: hexRgb('#dc9862'), mound: hexRgb('#d88f5b'),
    track: hexRgb('#a8673f'), chalk: hexRgb('#f7f3ea'),
  };

  function groundColor(sx, sy, rnd) {
    const p = (sy + 0.5 - L.hz) / L.KY;
    const z = 1 / p - CAM;
    const x = (sx + 0.5 - L.cx) / (p * L.KX);
    const pxw = 1 / (p * L.KX);        // 픽셀 하나의 가로 월드 크기
    const pzw = 1 / (p * p * L.KY);    // 픽셀 하나의 세로 월드 크기
    const ax = Math.abs(x);
    // 하얀 선과 베이스
    if (ax <= 0.065 && z <= 0.03 && z >= ax * 0.5 - 0.05) return C.chalk;              // 홈플레이트
    for (const [bx, bz] of BASES) if (Math.abs(x - bx) + Math.abs(z - bz) < 0.055) return C.chalk;
    if (ax < 0.045 && Math.abs(z - 1) < pzw * 0.8) return C.chalk;                       // 투수판
    if (z > 0.06 && z < FENCE_Z && Math.abs(ax - z) < pxw * 0.7) return C.chalk;        // 파울 라인
    const inBox = ax > 0.1 - pxw && ax < 0.26 + pxw && z > -0.12 - pzw && z < 0.14 + pzw;
    if (inBox && (Math.abs(ax - 0.1) < pxw * 0.6 || Math.abs(ax - 0.26) < pxw * 0.6 ||
      Math.abs(z + 0.12) < pzw * 0.6 || Math.abs(z - 0.14) < pzw * 0.6)) return C.chalk;  // 타석
    // 흙
    const dirt = () => { const r = rnd(); return r < 0.08 ? C.dirtD : r < 0.12 ? C.dirtL : C.dirt; };
    if (x * x + (z - 1) * (z - 1) < 0.17 * 0.17) return rnd() < 0.08 ? C.dirtD : C.mound;
    if (x * x + z * z < 0.27 * 0.27) return dirt();
    const innerGrass = ax + Math.abs(z - 1.06) <= 0.8;
    if (!innerGrass && z > -0.05 && ax <= z + 0.09 && x * x + (z - 1) * (z - 1) < 1.58 * 1.58) return dirt();
    if (z > FENCE_Z - 0.3) return rnd() < 0.1 ? C.dirtD : C.track;
    // 잔디 (체크무늬)
    const chk = (Math.floor((x + z) / 0.42) + Math.floor((z - x) / 0.42)) & 1;
    if (rnd() < 0.03) return C.gD;
    return chk ? C.g1 : C.g2;
  }

  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = LW;
    bg.height = LH;
    const c = bg.getContext('2d');
    const img = c.createImageData(LW, LH);
    const d = img.data;
    const rnd = seeded(7);
    for (let y = 0; y < LH; y++) {
      for (let x = 0; x < LW; x++) {
        let col;
        if (y < L.standsTop) {
          // 하늘: 4x4 바이어 디더링으로 두 색을 섞는다
          const t = y / Math.max(1, L.standsTop);
          col = t > BAYER[(y & 3) * 4 + (x & 3)] / 16 ? C.sky1 : C.sky0;
          if (t < 0.85 && rnd() < 0.004) col = C.star;
        } else if (y < L.wallTop) {
          col = (y - L.standsTop) % 4 === 3 ? C.standsD : C.stands;
        } else if (y < L.fenceY) {
          if (y === L.wallTop) col = C.wallTop;
          else {
            const seg = Math.floor(x / 26);
            const inner = x % 26 > 1 && x % 26 < 24 && y > L.wallTop + 1 && y < L.fenceY - 1;
            col = seg % 3 === 1 && inner ? C.ads[((seg / 3) | 0) % C.ads.length] : (inner ? C.wallL : C.wall);
          }
        } else {
          col = groundColor(x, y, rnd);
        }
        const i = (y * LW + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    // 조명탑
    lights = [];
    const ly = Math.max(1, L.standsTop - 9);
    for (const fx of [0.1, 0.32, 0.68, 0.9]) {
      const lx = Math.round(LW * fx);
      c.fillStyle = '#4a4466';
      c.fillRect(lx - 1, ly + 5, 2, Math.max(0, L.standsTop + 4 - ly));
      c.fillStyle = PAL.outline;
      c.fillRect(lx - 7, ly - 1, 14, 7);
      c.fillStyle = '#fffbe0';
      c.fillRect(lx - 6, ly, 12, 5);
      c.fillStyle = '#e8dfb0';
      for (let i = -4; i <= 4; i += 4) c.fillRect(lx + i, ly, 1, 5);
      lights.push({ x: lx, y: ly + 2 });
    }
  }

  function buildCrowd() {
    crowd = [];
    const rnd = seeded(11);
    const skins = ['#f4c39a', '#e0a878', '#b77b52', '#8a5a3c', '#ffd9b5'];
    const shirts = ['#e5413b', '#ffcd3c', '#3b82f6', '#ffffff', '#22c55e', '#ec4899', '#a855f7', '#f97316'];
    let row = 0;
    for (let y = L.standsTop + 3; y < L.wallTop - 1; y += 4, row++) {
      for (let x = (row % 2) * 2; x < LW - 1; x += 4) {
        if (rnd() < 0.08) continue;
        crowd.push({ x, y, skin: skins[(rnd() * skins.length) | 0], shirt: shirts[(rnd() * shirts.length) | 0], ph: rnd() });
      }
    }
  }

  // ---------- 스프라이트 ----------
  const spriteCache = new Map();
  function makeSprite(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w + 2;
    c.height = h + 2;
    const sc = c.getContext('2d');
    draw((x, y, ww, hh, col) => { sc.fillStyle = col; sc.fillRect(x + 1, y + 1, ww, hh); });
    // 1픽셀 외곽선
    const img = sc.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < c.width && y < c.height && d[(y * c.width + x) * 4 + 3] > 0;
    const edge = [];
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push((y * c.width + x) * 4);
      }
    }
    const oc = hexRgb(PAL.outline);
    for (const i of edge) { d[i] = oc[0]; d[i + 1] = oc[1]; d[i + 2] = oc[2]; d[i + 3] = 255; }
    sc.putImageData(img, 0, 0);
    return c;
  }
  function sprite(key, w, h, draw) {
    let s = spriteCache.get(key);
    if (!s) { s = makeSprite(w, h, draw); spriteCache.set(key, s); }
    return s;
  }

  // 정면을 보는 선수 (투수, 수비수). 14x22
  function paintFront(R, team, teamD, pose) {
    const oy = pose === 'crouch' ? 2 : 0;
    // 다리
    if (pose === 'kick') {
      R(4, 17, 2, 3, PAL.pants); R(3, 20, 3, 2, PAL.shoe);
      R(8, 14, 4, 2, PAL.pants); R(11, 15, 2, 2, PAL.pants); R(11, 17, 2, 2, PAL.shoe);
    } else if (pose === 'crouch' || pose === 'throw') {
      R(3, 17, 2, 3, PAL.pants); R(9, 17, 2, 3, PAL.pants); R(2, 20, 3, 2, PAL.shoe); R(9, 20, 3, 2, PAL.shoe);
    } else {
      R(4, 17, 2, 3, PAL.pants); R(8, 17, 2, 3, PAL.pants); R(3, 20, 3, 2, PAL.shoe); R(8, 20, 3, 2, PAL.shoe);
    }
    // 몸통
    R(4, 14 + oy, 6, 3, PAL.pants); R(4, 16 + oy, 6, 1, PAL.pantsD);
    R(4, 14 + oy, 6, 1, PAL.belt);
    R(4, 9 + oy, 6, 5, team); R(4, 13 + oy, 6, 1, teamD); R(6, 9 + oy, 2, 1, PAL.white);
    // 머리
    R(3, 4 + oy, 8, 5, PAL.skin); R(2, 5 + oy, 1, 2, PAL.skin); R(11, 5 + oy, 1, 2, PAL.skin);
    R(3, 8 + oy, 8, 1, PAL.skinD);
    R(3, 0 + oy, 8, 3, team); R(5, 0 + oy, 2, 1, shade(team, 0.35)); R(2, 3 + oy, 10, 1, teamD);
    // 얼굴
    const face = pose === 'laugh' ? 'laugh' : pose === 'sad' ? 'sad' : pose === 'idle' ? 'smirk' : pose === 'crouch' ? 'plain' : 'focus';
    if (face === 'laugh') {
      R(4, 6 + oy, 1, 1, PAL.eye); R(5, 5 + oy, 1, 1, PAL.eye); R(6, 6 + oy, 1, 1, PAL.eye);
      R(7, 6 + oy, 1, 1, PAL.eye); R(8, 5 + oy, 1, 1, PAL.eye); R(9, 6 + oy, 1, 1, PAL.eye);
      R(5, 7 + oy, 4, 2, PAL.mouth);
    } else {
      R(5, 5 + oy, 1, 2, PAL.eye); R(8, 5 + oy, 1, 2, PAL.eye);
      if (face === 'focus') { R(4, 4 + oy, 2, 1, PAL.eye); R(8, 4 + oy, 2, 1, PAL.eye); R(6, 7 + oy, 2, 1, PAL.mouth); }
      else if (face === 'sad') { R(6, 7 + oy, 2, 1, PAL.mouth); R(5, 8 + oy, 1, 1, PAL.mouth); R(8, 8 + oy, 1, 1, PAL.mouth); R(11, 2 + oy, 1, 2, PAL.sweat); }
      else if (face === 'smirk') { R(6, 7 + oy, 2, 1, PAL.mouth); R(8, 6 + oy, 1, 1, PAL.mouth); }
      else R(6, 7 + oy, 2, 1, PAL.mouth);
    }
    // 팔
    if (pose === 'set') {
      R(3, 9, 1, 3, team); R(10, 9, 1, 3, team); R(5, 10, 4, 3, PAL.glove);
    } else if (pose === 'kick') {
      R(1, 5, 2, 4, team); R(1, 3, 2, 2, PAL.skin); R(1, 2, 2, 1, PAL.white);
      R(10, 9, 1, 2, team); R(10, 8, 3, 3, PAL.glove);
    } else if (pose === 'throw') {
      R(9, 10, 3, 2, team); R(12, 11, 1, 2, PAL.skin);
      R(2, 11, 2, 3, PAL.glove);
    } else if (pose === 'laugh') {
      R(3, 10, 1, 3, team); R(4, 12, 2, 1, PAL.skin); R(9, 11, 2, 2, PAL.glove);
    } else if (pose === 'crouch') {
      R(3, 10 + oy, 1, 3, team); R(10, 10 + oy, 1, 3, team); R(5, 12 + oy, 4, 3, PAL.glove);
    } else {
      R(3, 9, 1, 4, team); R(3, 13, 1, 1, PAL.skin); R(10, 10, 2, 3, PAL.glove);
    }
  }

  // 뒤에서 본 타자 (오른쪽 = 홈플레이트 방향). 14x23
  const BAT_HANDS = { ready: [12, 4], swing: [13, 8], follow: [1, 5] };
  function paintBatter(R, pose) {
    R(2, 16, 3, 5, PAL.pants); R(9, 16, 3, 5, PAL.pants);
    R(1, 21, 4, 2, PAL.shoe); R(9, 21, 4, 2, PAL.shoe);
    R(3, 13, 8, 4, PAL.pants); R(3, 13, 8, 1, PAL.belt); R(3, 16, 8, 1, PAL.pantsD);
    R(3, 6, 8, 7, PAL.red); R(3, 12, 8, 1, PAL.redD);
    if (pose !== 'follow') { R(5, 8, 3, 1, PAL.white); R(7, 9, 1, 3, PAL.white); }
    R(5, 5, 4, 1, PAL.skin);
    R(3, 0, 8, 5, PAL.red); R(4, 0, 5, 1, PAL.redL); R(9, 3, 3, 2, PAL.redD);
    if (pose === 'ready') { R(9, 6, 3, 2, PAL.red); R(11, 4, 2, 2, PAL.shoe); }
    else if (pose === 'swing') { R(10, 8, 3, 2, PAL.red); R(12, 8, 2, 2, PAL.shoe); }
    else { R(1, 6, 3, 2, PAL.red); R(0, 5, 2, 2, PAL.shoe); }
  }

  const pitcherSprite = (st, pose) => sprite(`p:${st.color}:${pose}`, 14, 22, (R) => paintFront(R, st.color, shade(st.color, -0.32), pose));
  const batterSprite = (pose) => sprite(`b:${pose}`, 14, 23, (R) => paintBatter(R, pose));

  function blit(s, fx, fy) { g.drawImage(s, Math.round(fx - s.width / 2), Math.round(fy - s.height + 1)); }

  // 메뉴에 쓸 확대 이미지
  function spriteURL(st, pose, scale = 4) {
    const s = pitcherSprite(st, pose);
    const c = document.createElement('canvas');
    c.width = s.width * scale;
    c.height = s.height * scale;
    const cc = c.getContext('2d');
    cc.imageSmoothingEnabled = false;
    cc.drawImage(s, 0, 0, c.width, c.height);
    return c.toDataURL();
  }

  // ---------- 게임 상태 ----------
  const G = {
    mode: 'menu', // menu | intro | play | paused | over
    stageIdx: 0, stage: STAGES[0],
    phase: 'ready', phaseT: 0, phaseDur: 1,
    time: 0, releaseT: -9,
    pitchNo: 0, pitch: null,
    results: [], homers: 0, score: 0, combo: 0,
    balls: [], real: null, hit: null,
    swung: false, swingTime: 0, swingAnim: -1,
    resolved: false, arrival: null,
    popups: [], fx: [], parts: [], sparks: [], bubble: null, timing: null,
    cheer: 0, shake: 0, laughT: 0, sadT: 0, hitstop: 0, flash: 0,
    clock: 0,
  };

  function say(text, life = 1.4) { G.bubble = { text, t: 0, life }; }
  function popup(text, sub, color, life) { G.popups = [{ text, sub, color, life, t: 0 }]; }
  function puff(b) {
    const p = ballPos(b);
    const P = proj(p.x, p.h, b.z);
    G.fx.push({ x: P.x, y: P.y, t: 0 });
    SFX.poof();
  }
  function setPhase(ph, dur) { G.phase = ph; G.phaseT = dur; G.phaseDur = dur; }

  function firework(x, y, col) {
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, sp = rand(25, 55);
      G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, c: col, t: 0, life: rand(0.6, 1.0), grav: 40 });
    }
  }
  function confetti(n) {
    const cols = ['#ffcd3c', '#e5413b', '#3b82f6', '#22c55e', '#ec4899', '#ffffff'];
    for (let i = 0; i < n; i++) {
      G.parts.push({ x: rand(0, LW), y: rand(-20, 0), vx: rand(-10, 10), vy: rand(20, 45), c: pick(cols), t: 0, life: rand(1.5, 2.5), grav: 0, flutter: rand(0, 6) });
    }
  }

  // ---------- 공 ----------
  function makeBall(type, base) {
    const pm = 1 / (1 + CAM);
    const b = {
      type, z: 1, base, speed: base, real: true, visible: true, shadow: true,
      xo: 0, ho: 0, xs: 0, xsT: 0, t: 0,
      x0: -5.5 / (pm * L.KX), h0: 18.5 / (pm * KH),   // 투수 손 위치
      xt: rand(-0.05, 0.05), ht: rand(0.35, 0.55),    // 스트라이크존 안 도착 지점
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
      h: b.h0 + (b.ht - b.h0) * u + Math.sin(uc * Math.PI) * 0.12 + b.ho,
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
          const offs = shuffle([-0.12, 0, 0.12]);
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
        b.xo = Math.sin(b.t * 11) * 0.12 * k;
        b.ho = Math.cos(b.t * 8) * 0.25 * k;
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
      popups: [], fx: [], parts: [], bubble: null, timing: null, hit: null,
      swingAnim: -1, laughT: 0, sadT: 0, hitstop: 0, flash: 0, cheer: 0,
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
    G.timing = null;
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
    else resolve('strike', ms, ms < 0 ? '헛스윙! 너무 빨라요' : '헛스윙! 너무 늦어요');
  }

  function timingText(ms) {
    const a = Math.round(Math.abs(ms));
    if (a <= 12) return '완벽한 타이밍!';
    return ms < 0 ? `조금 빨라요 ${a}ms` : `조금 늦어요 ${a}ms`;
  }

  function resolve(kind, ms, label) {
    if (G.resolved) return;
    G.resolved = true;
    G.results.push(kind);
    if (ms !== null && ms !== undefined) G.timing = { ms };
    if (kind === 'hr') {
      G.homers++;
      G.combo++;
      G.score += 100 * G.combo;
      const dist = Math.round(clamp(152 - Math.abs(ms) * 0.8 + rand(-6, 6), 105, 160));
      popup('홈런!!', `${dist}m · ${timingText(ms)}`, '#ffcd3c', 2.0);
      G.cheer = 2.0;
      G.shake = 0.5;
      G.sadT = 1.8;
      G.hitstop = 0.12;
      G.flash = 1;
      SFX.homerun();
      say(pick(LINES.hr), 1.6);
      launch(ms, kind);
      setPhase('result', 2.1);
      [0, 0.35, 0.7].forEach((d, i) => setTimeout(() => {
        firework(rand(LW * 0.2, LW * 0.8), rand(L.standsTop * 0.4 + 4, L.wallTop - 4), ['#ffcd3c', '#ec4899', '#3b82f6'][i]);
      }, 250 + d * 1000));
    } else if (kind === 'hit') {
      G.combo = 0;
      G.score += 30;
      popup('안타!', timingText(ms), '#6fb6ff', 1.4);
      G.cheer = 0.6;
      G.hitstop = 0.06;
      SFX.crack();
      launch(ms, kind);
      setPhase('result', 1.5);
    } else if (kind === 'foul') {
      G.combo = 0;
      G.score += 5;
      popup('파울', timingText(ms), '#e6e1f5', 1.2);
      SFX.foul();
      launch(ms, kind);
      setPhase('result', 1.3);
    } else {
      G.combo = 0;
      popup('스트라이크!', label || '보기만 했네...', '#ff6a5f', 1.3);
      SFX.strike();
      G.laughT = 1.0;
      if (!G.bubble || G.bubble.t > 0.3) say(pick(LINES.strike), 1.2);
      setPhase('result', 1.4);
    }
  }

  // 맞은 공을 날려 보낸다
  function launch(ms, kind) {
    const b = G.real;
    if (!b) return;
    const p = ballPos(b);
    b.gone = true;
    const hit = { x: p.x, h: p.h, z: Math.max(b.z, 0), t: 0, bounced: false };
    if (kind === 'hr') Object.assign(hit, { vz: 4.8, vh: 3.2, vx: (ms / WIN.hr) * 0.7 });
    else if (kind === 'hit') Object.assign(hit, { vz: 2.4, vh: 1.3, vx: (ms / WIN.hit) * 1.4 + rand(-0.3, 0.3) });
    else Object.assign(hit, { vz: 0.9, vh: 2.4, vx: (ms < 0 ? -1 : 1) * 2.6 });
    G.hit = hit;
  }

  function afterResult() {
    const remaining = BALLS - G.results.length;
    if (remaining <= 0 || G.homers + remaining < G.stage.need) endStage();
    else { G.pitchNo++; preparePitch(); }
  }

  function starsFor(homers, need) {
    if (homers < need) return 0;
    return 1 + (homers >= need + 1 ? 1 : 0) + (homers >= need + 2 ? 1 : 0);
  }

  function endStage() {
    const st = G.stage;
    const i = G.stageIdx;
    const clear = G.homers >= st.need;
    const stars = starsFor(G.homers, st.need);
    const newBest = clear && G.score > (save.best[i] || 0);
    if (clear) {
      save.stars[i] = Math.max(save.stars[i] || 0, stars);
      save.best[i] = Math.max(save.best[i] || 0, G.score);
      writeSave();
    }
    G.mode = 'over';
    const last = i === STAGES.length - 1;
    $('res-img').src = spriteURL(st, clear ? 'sad' : 'laugh');
    $('res-title').textContent = clear ? (last ? '트롤킹 격파!' : '클리어!') : '실패...';
    $('res-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const lines = [`홈런 ${G.homers}/${st.need} · 점수 ${G.score}`];
    if (!clear && G.results.length < BALLS) lines.push('남은 공으로는 홈런이 모자라!');
    if (!clear) lines.push(`힌트: ${st.hint}`);
    if (newBest) lines.push('최고 기록 갱신!');
    if (clear && last) lines.push('모든 트롤 투수를 이겼다!');
    $('res-detail').innerHTML = lines.map(escapeHtml).join('<br>');
    // 모든 스테이지가 열려 있으므로 실패해도 다음 투수로 넘어갈 수 있다
    $('btn-next').className = clear && !last ? 'primary' : 'secondary';
    $('btn-retry').className = clear && !last ? 'secondary' : 'primary';
    $('btn-next').classList.toggle('hidden', last);
    if (clear) { SFX.clear(); confetti(70); say(pick(LINES.hr), 2); } else { SFX.fail(); say(pick(LINES.strike), 2); }
    setTimeout(() => { if (G.mode === 'over') show('scr-result'); }, 800);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function updatePlay(dt) {
    G.phaseT -= dt;
    switch (G.phase) {
      case 'ready':
        if (G.phaseT <= 0) setPhase('windup', 0.6);
        break;
      case 'windup':
        if (G.phaseT <= 0) release();
        break;
      case 'fakeout':
        if (G.phaseT <= 0) setPhase('windup', 0.45);
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
    G.fx = G.fx.filter((f) => f.t < 0.35);
    for (const p of G.parts) {
      p.t += dt;
      p.vy += p.grav * dt;
      p.x += (p.vx + (p.flutter !== undefined ? Math.sin(p.t * 6 + p.flutter) * 12 : 0)) * dt;
      p.y += p.vy * dt;
    }
    G.parts = G.parts.filter((p) => p.t < p.life);
    // 관중석 카메라 플래시
    const rate = 2 + G.cheer * 30;
    if (Math.random() < rate * dt) G.sparks.push({ x: rand(2, LW - 2), y: rand(L.standsTop + 2, L.wallTop - 2), t: 0 });
    for (const s of G.sparks) s.t += dt;
    G.sparks = G.sparks.filter((s) => s.t < 0.15);
    if (G.bubble) { G.bubble.t += dt; if (G.bubble.t > G.bubble.life) G.bubble = null; }
    if (G.swingAnim >= 0) { G.swingAnim += dt; if (G.swingAnim > 0.75) G.swingAnim = -1; }
    if (G.hit) {
      const h = G.hit;
      h.t += dt;
      h.x += h.vx * dt; h.z += h.vz * dt; h.h += h.vh * dt;
      h.vh -= 2.0 * dt;
      if (h.h < 0 && h.vh < 0) {
        h.h = 0; h.vh *= -0.35; h.vz *= 0.5; h.vx *= 0.5;
        if (!h.bounced) { h.bounced = true; SFX.pop(); }
      }
    }
    G.cheer = Math.max(0, G.cheer - dt);
    G.shake = Math.max(0, G.shake - dt * 1.5);
    G.laughT = Math.max(0, G.laughT - dt);
    G.sadT = Math.max(0, G.sadT - dt);
    G.flash = Math.max(0, G.flash - dt * 6);
  }

  // ---------- 그리기: 픽셀 버퍼 ----------
  function pitcherPose() {
    if (G.mode === 'menu' || G.mode === 'intro') return 'idle';
    if (G.phase === 'fakeout' || G.laughT > 0) return 'laugh';
    if (G.sadT > 0) return 'sad';
    if (G.phase === 'windup') return 1 - G.phaseT / G.phaseDur < 0.4 ? 'set' : 'kick';
    if ((G.phase === 'flight' || G.phase === 'fakeflight') && G.time - G.releaseT < 0.3) return 'throw';
    return 'idle';
  }

  // 배트 각도: 머리 뒤 → 홈플레이트 위 → 반대편 어깨 뒤로 한 바퀴
  function batState() {
    const t = G.swingAnim;
    const A0 = -2.1, A1 = 3.8, AR = Math.PI * 2 - 2.1;
    if (t < 0) return { a: A0, sy: 1, pose: 'ready' };
    if (t < 0.16) {
      const q = t / 0.16;
      return { a: A0 + (A1 - A0) * easeOut(q), sy: lerp(1, 0.45, Math.min(1, q * 4)), pose: q < 0.3 ? 'swing' : 'follow' };
    }
    if (t < 0.5) return { a: A1, sy: 0.45, pose: 'follow' };
    const q = clamp((t - 0.5) / 0.25, 0, 1);
    return { a: lerp(A1, AR, q), sy: lerp(0.45, 1, q), pose: q < 0.6 ? 'follow' : 'ready' };
  }

  function pxLine(x0, y0, x1, y1, w, col) {
    g.fillStyle = col;
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      g.fillRect(Math.round(lerp(x0, x1, t) - (w - 1) / 2), Math.round(lerp(y0, y1, t) - (w - 1) / 2), w, w);
    }
  }

  function drawBatter() {
    const st = batState();
    const P = proj(BATTER.x, 0, BATTER.z);
    const s = batterSprite(st.pose);
    blit(s, P.x, P.y);
    const left = Math.round(P.x - s.width / 2), top = Math.round(P.y - s.height + 1);
    const [hx, hy] = BAT_HANDS[st.pose];
    const px = left + hx + 1.5, py = top + hy + 1.5;
    const plate = proj(0, 0, 0);
    const len = clamp(plate.x + 0.05 * plate.p * L.KX - px, 12, 26);
    const ex = px + Math.cos(st.a) * len, ey = py + Math.sin(st.a) * len * st.sy;
    pxLine(px, py, ex, ey, 4, PAL.outline);
    pxLine(px, py, lerp(px, ex, 0.45), lerp(py, ey, 0.45), 2, PAL.batD);
    pxLine(lerp(px, ex, 0.4), lerp(py, ey, 0.4), ex, ey, 2, PAL.bat);
  }

  function drawBallPx(x, h, z) {
    const P = proj(x, h, z);
    const bx = Math.round(P.x), by = Math.round(P.y);
    if (P.p > 0.37) {
      g.fillStyle = PAL.outline;
      g.fillRect(bx - 1, by - 2, 3, 5); g.fillRect(bx - 2, by - 1, 5, 3);
      g.fillStyle = PAL.white;
      g.fillRect(bx - 1, by - 1, 3, 3);
      g.fillStyle = PAL.red;
      g.fillRect(bx + 1, by - 1, 1, 1);
    } else if (P.p > 0.3) {
      g.fillStyle = PAL.white;
      g.fillRect(bx - 1, by - 1, 3, 3);
    } else if (P.p > 0.16) {
      g.fillStyle = PAL.white;
      g.fillRect(bx - 1, by - 1, 2, 2);
    } else {
      g.fillStyle = PAL.white;
      g.fillRect(bx, by, 1, 1);
    }
  }

  function drawShadow(x, z) {
    const P = proj(x, 0, z);
    const w = P.p > 0.37 ? 5 : 4;
    g.fillStyle = 'rgba(20,10,30,0.55)';
    g.fillRect(Math.round(P.x - w / 2), Math.round(P.y), w, 1);
    g.fillRect(Math.round(P.x - w / 2) + 1, Math.round(P.y) + 1, w - 2, 1);
  }

  function drawCrowd() {
    const jumping = G.cheer > 0;
    const tick = Math.floor(G.clock / 120);
    for (const c of crowd) {
      const up = jumping && ((tick + ((c.ph * 4) | 0)) & 1) ? 1 : 0;
      g.fillStyle = c.skin;
      g.fillRect(c.x, c.y - 2 - up, 2, 2);
      g.fillStyle = c.shirt;
      g.fillRect(c.x, c.y - up, 2, 2);
      if (up && c.ph > 0.5) { g.fillStyle = c.skin; g.fillRect(c.x - 1, c.y - 4, 1, 2); }
    }
    for (const s of G.sparks) {
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 3);
      g.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1);
    }
  }

  function drawLights() {
    for (const l of lights) {
      const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, 26);
      gr.addColorStop(0, 'rgba(255,250,220,0.45)');
      gr.addColorStop(1, 'rgba(255,250,220,0)');
      g.fillStyle = gr;
      g.fillRect(l.x - 26, l.y - 26, 52, 52);
    }
  }

  function drawWorld() {
    g.imageSmoothingEnabled = false;
    g.drawImage(bg, 0, 0);
    drawCrowd();
    drawLights();
    // 수비수 (멀리 있는 선수부터)
    const st = G.stage;
    const fielderPose = G.cheer > 1 ? 'sad' : 'crouch';
    for (const [fx, fz] of [...FIELDERS].sort((a, b) => b[1] - a[1])) {
      const P = proj(fx, 0, fz);
      blit(pitcherSprite(st, fielderPose), P.x, P.y);
    }
    // 투수
    const M = proj(0, 0, 1);
    const pose = pitcherPose();
    const bob = pose === 'laugh' ? (Math.floor(G.clock / 60) & 1) : 0;
    blit(pitcherSprite(st, pose), M.x + bob, M.y);
    // 공
    const live = G.balls.filter((b) => !b.gone).sort((a, b) => b.z - a.z);
    for (const b of live) if (b.shadow) drawShadow(ballPos(b).x, b.z);
    if (G.hit) drawShadow(G.hit.x, G.hit.z);
    for (const b of live) {
      if (!b.visible) continue;
      const p = ballPos(b);
      drawBallPx(p.x, p.h, b.z);
    }
    if (G.hit) drawBallPx(G.hit.x, G.hit.h, G.hit.z);
    drawBatter();
    // 효과
    for (const f of G.fx) {
      const r = 1 + Math.floor(f.t * 20);
      g.fillStyle = '#ffffff';
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.4], [0, 1.4], [-1.4, 0], [1.4, 0]]) {
        g.fillRect(Math.round(f.x + dx * r), Math.round(f.y + dy * r), 1, 1);
      }
    }
    for (const p of G.parts) {
      g.fillStyle = p.c;
      g.globalAlpha = clamp((p.life - p.t) / 0.3, 0, 1);
      g.fillRect(Math.round(p.x), Math.round(p.y), p.flutter !== undefined ? 2 : 1, 1);
    }
    g.globalAlpha = 1;
    if (G.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${G.flash * 0.6})`;
      g.fillRect(0, 0, LW, LH);
    }
  }

  // ---------- 그리기: 글자와 UI (고해상도 캔버스) ----------
  function pxText(text, x, y, size, color, align = 'center') {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const o = Math.max(1, Math.round(size / 12));
    ctx.fillStyle = PAL.outline;
    ctx.fillText(text, x, y + o * 2);
    for (let dx = -o; dx <= o; dx += o) for (let dy = -o; dy <= o; dy += o) if (dx || dy) ctx.fillText(text, x + dx, y + dy);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function panel(x, y, w, h) {
    const o = Math.round(U * 2);
    ctx.fillStyle = PAL.outline;
    ctx.fillRect(x - o, y - o, w + o * 2, h + o * 3);
    ctx.fillStyle = '#2a2148';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3d3166';
    ctx.fillRect(x, y, w, o);
  }

  const BALL_ICON = ['..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..'];
  function ballIcon(x, y, col, ring) {
    const u = U;
    ctx.fillStyle = ring ? '#ffffff' : PAL.outline;
    BALL_ICON.forEach((row, ry) => {
      for (let rx = 0; rx < 7; rx++) if (row[rx] === 'X') ctx.fillRect(x + rx * u - u, y + ry * u - u, u * 3, u * 3);
    });
    ctx.fillStyle = col;
    BALL_ICON.forEach((row, ry) => {
      for (let rx = 0; rx < 7; rx++) if (row[rx] === 'X') ctx.fillRect(x + rx * u, y + ry * u, u, u);
    });
  }

  function drawHUD() {
    const st = G.stage;
    const fs = 12 * U;
    const x = 12, y = 12;
    const combo = G.combo >= 2 ? `  ${G.combo}연속!` : '';
    const line3 = `홈런 ${G.homers}/${st.need}  점수 ${G.score}${combo}`;
    const stageText = `STAGE ${G.stageIdx + 1} `;
    ctx.font = `${fs}px ${FONT}`;
    const stageW = ctx.measureText(stageText).width;
    const w = Math.round(Math.max(stageW + ctx.measureText(st.name).width, ctx.measureText(line3).width, fs * 6.6) + fs);
    const h = Math.round(fs * 4.3);
    panel(x, y, w, h);
    pxText(stageText, x + fs * 0.5, y + fs * 0.85, fs, '#ffcd3c', 'left');
    pxText(st.name, x + fs * 0.5 + stageW, y + fs * 0.85, fs, '#fff7e6', 'left');
    const colors = { hr: '#ffcd3c', hit: '#6fb6ff', foul: '#c9c2dd', strike: '#ff6a5f' };
    for (let i = 0; i < BALLS; i++) {
      const r = G.results[i];
      ballIcon(Math.round(x + fs * 0.6 + i * fs * 1.2), Math.round(y + fs * 1.65), colors[r] || '#4b3c80', i === G.results.length && G.mode === 'play');
    }
    pxText(line3, x + fs * 0.5, y + fs * 3.45, fs, '#fff7e6', 'left');
  }

  function drawPopups() {
    for (const p of G.popups) {
      const intro = Math.min(1, p.t / 0.12);
      const alpha = Math.min(intro, clamp((p.life - p.t) / 0.3, 0, 1));
      const size = Math.min(12 * Math.max(3, PX), Math.floor(W / (p.text.length * 1.15) / 12) * 12) || 24;
      const cy = Math.max(L.fenceY * PX * 0.6, 12 * U * 6 + size * 0.6);
      const bounce = p.t < 0.12 ? (1 - intro) * -20 : 0;
      ctx.save();
      ctx.globalAlpha = alpha;
      pxText(p.text, W / 2, cy + bounce, size, p.color);
      if (p.sub) pxText(p.sub, W / 2, cy + size * 0.9, 12 * U, '#fff7e6');
      if (G.timing && p.t > 0.1) drawTimingBar(W / 2, (proj(0, 0, 0).y + 12) * PX);
      ctx.restore();
    }
  }

  // 빠름 ← | 홈런 | → 늦음 타이밍 막대
  function drawTimingBar(cx, y) {
    const R = 200;
    const o = Math.round(U);
    const bw = Math.round(64 * U) * 2, bh = 4 * o;
    const x0 = Math.round(cx - bw / 2);
    y = Math.round(y);
    ctx.fillStyle = PAL.outline;
    ctx.fillRect(x0 - o, y - o, bw + o * 2, bh + o * 2);
    const seg = (a, b, col) => {
      ctx.fillStyle = col;
      const xa = x0 + Math.round(((a + R) / (2 * R)) * bw), xb = x0 + Math.round(((b + R) / (2 * R)) * bw);
      ctx.fillRect(xa, y, xb - xa, bh);
    };
    seg(-R, R, '#ff6a5f');
    seg(-WIN.foul, WIN.foul, '#c9c2dd');
    seg(-WIN.hit, WIN.hit, '#6fb6ff');
    seg(-WIN.hr, WIN.hr, '#ffcd3c');
    const mx = x0 + Math.round(((clamp(G.timing.ms, -R, R) + R) / (2 * R)) * bw);
    ctx.fillStyle = PAL.outline;
    ctx.fillRect(mx - 2 * o, y - 4 * o, 4 * o, bh + 8 * o);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - o, y - 3 * o, 2 * o, bh + 6 * o);
    pxText('빠름', x0 - 6 * o, y + bh / 2, 12 * U, '#d9ccff', 'right');
    pxText('늦음', x0 + bw + 6 * o, y + bh / 2, 12 * U, '#d9ccff', 'left');
  }

  function drawBubble() {
    const b = G.bubble;
    if (!b) return;
    const s = pitcherSprite(G.stage, 'idle');
    const M = proj(0, 0, 1);
    const headX = M.x * PX, headY = (M.y - s.height) * PX;
    const fs = 12 * U;
    ctx.font = `${fs}px ${FONT}`;
    const tw = ctx.measureText(b.text).width;
    const o = Math.round(U), pad = 4 * o;
    const w = Math.round(tw + pad * 2), h = Math.round(fs + pad * 2);
    const x = Math.round(clamp(headX + 8 * o, 8, W - w - 8));
    const y = Math.round(Math.max(8, headY - h - 8 * o));
    ctx.save();
    ctx.globalAlpha = clamp(Math.min(b.t / 0.08, (b.life - b.t) / 0.2), 0, 1);
    ctx.fillStyle = PAL.outline;
    ctx.fillRect(x - 2 * o, y - 2 * o, w + 4 * o, h + 4 * o);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 4 * o - i * 2 * o, y + h + i * 2 * o, 6 * o, 4 * o);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 2; i++) ctx.fillRect(x + 6 * o - i * 2 * o, y + h + i * 2 * o - o, 2 * o, 3 * o);
    ctx.fillStyle = PAL.outline;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text, x + pad, y + h / 2 + o);
    ctx.restore();
  }

  function drawHint() {
    let hint = null;
    if (G.mode === 'play' && G.pitchNo < 2) hint = G.stageIdx === 0 ? '화면 탭 / 스페이스바로 스윙!' : G.stage.hint;
    if (hint) pxText(hint, W / 2, H - 12 * U * 1.6, 12 * U, '#ffe68a');
  }

  function draw() {
    drawWorld();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#16204a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sx = G.shake > 0 ? Math.round(rand(-1, 1) * G.shake * 3) * PX * DPR : 0;
    const sy = G.shake > 0 ? Math.round(rand(-1, 1) * G.shake * 3) * PX * DPR : 0;
    ctx.drawImage(buf, sx, sy, LW * PX * DPR, LH * PX * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBubble();
    drawPopups();
    if (G.mode === 'play' || G.mode === 'paused' || G.mode === 'over') drawHUD();
    drawHint();
  }

  // ---------- 루프 ----------
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    G.clock = now;
    if (G.mode !== 'paused') {
      if (G.hitstop > 0) { G.hitstop -= dt; dt = 0; }
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

  function buildTitle() {
    const row = $('title-sprites');
    row.innerHTML = '';
    for (const i of [0, 2, 4, 7, 9]) {
      const img = document.createElement('img');
      img.src = spriteURL(STAGES[i], i === 9 ? 'laugh' : 'idle', 2);
      img.alt = '';
      row.appendChild(img);
    }
  }

  function buildSelect() {
    const grid = $('stage-grid');
    grid.innerHTML = '';
    STAGES.forEach((st, i) => {
      const btn = document.createElement('button');
      btn.className = 'stage-btn';
      const stars = save.stars[i] || 0;
      btn.innerHTML = `<img src="${spriteURL(st, 'idle', 2)}" alt=""><span class="n">STAGE ${i + 1}</span>` +
        `<span class="nm">${escapeHtml(st.name)}</span><span class="st">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
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
    G.balls = []; G.hit = null; G.results = []; G.popups = []; G.bubble = null; G.parts = [];
    const st = G.stage;
    $('intro-num').textContent = `STAGE ${i + 1}`;
    $('intro-img').src = spriteURL(st, 'idle', 4);
    $('intro-name').textContent = st.name;
    $('intro-title').textContent = st.title;
    $('intro-line').textContent = `"${st.intro}"`;
    $('intro-mission').textContent = `공 ${BALLS}개 중 홈런 ${st.need}개!`;
    $('intro-hint').textContent = `힌트: ${st.hint}`;
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
  bind('btn-next', () => openIntro(Math.min(STAGES.length - 1, G.stageIdx + 1)));
  bind('btn-retry', startStage);
  bind('btn-res-select', openSelect);
  bind('btn-pause', pause);
  bind('btn-resume', resume);
  bind('btn-pause-retry', startStage);
  bind('btn-pause-select', openSelect);

  function updateMuteBtn() {
    $('btn-mute').classList.toggle('off', muted);
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
  buildTitle();
  if (document.fonts && document.fonts.load) document.fonts.load(`12px ${FONT}`).catch(() => {});
  requestAnimationFrame(frame);
})();
