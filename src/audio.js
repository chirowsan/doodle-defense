/* Original synthesized sounds for Doodle Defense. Music is a separate CC0 file. */
(function (global) {
  const S = {
    ctx: null,
    master: null,
    sfxGain: null,
    musicEl: null,
    unlocked: false,
    settings: { sfx: true, music: true },
  };

  function ctx() {
    if (S.ctx) return S.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const c = new AC();
    S.ctx = c;
    S.master = c.createGain();
    S.master.gain.value = 0.85;
    S.master.connect(c.destination);
    S.sfxGain = c.createGain();
    S.sfxGain.gain.value = 0.68;
    S.sfxGain.connect(S.master);
    return c;
  }
  function now() {
    const c = ctx();
    return c ? c.currentTime : 0;
  }
  function tone(freq, dur, type, gain, at, slide) {
    const c = ctx();
    if (!c || !S.settings.sfx) return;
    const t0 = at == null ? now() : at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.1, t0 + 0.016);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(S.sfxGain);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function noise(dur, gain, hp) {
    const c = ctx();
    if (!c || !S.settings.sfx) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp || 700;
    const g = c.createGain();
    const t0 = now();
    g.gain.setValueAtTime(gain || 0.07, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(S.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const SFX = {
    tap() { tone(680, 0.06, "sine", 0.07); },
    select() { tone(520, 0.07, "triangle", 0.08); tone(780, 0.08, "sine", 0.05, now() + 0.04); },
    scratch() { noise(0.05, 0.05, 900); },
    drawEnd() { tone(440, 0.1, "triangle", 0.07); tone(660, 0.12, "sine", 0.05, now() + 0.05); },
    hatch() { tone(760, 0.08, "sine", 0.07); tone(980, 0.1, "sine", 0.05, now() + 0.06); },
    bonk() { tone(280, 0.08, "square", 0.05); tone(420, 0.07, "sine", 0.04, now() + 0.03); },
    tickle() { tone(720, 0.08, "sine", 0.06); },
    star() { tone(880, 0.1, "sine", 0.07); tone(1320, 0.12, "sine", 0.06, now() + 0.06); },
    splash() { noise(0.12, 0.06, 400); tone(360, 0.1, "sine", 0.04, now(), 160); },
    erase() { noise(0.1, 0.05, 1200); tone(240, 0.1, "triangle", 0.04, now(), 140); },
    dry() { tone(180, 0.16, "sine", 0.07, now(), 90); },
    house() { tone(200, 0.18, "sine", 0.08, now(), 100); },
    pop() { tone(300, 0.1, "triangle", 0.07, now(), 90); noise(0.06, 0.04, 400); },
    win() {
      const t = now();
      [523, 659, 784, 988].forEach((f, i) => tone(f, 0.2, "sine", 0.08, t + i * 0.09));
    },
    lose() {
      const t = now();
      [392, 330, 262].forEach((f, i) => tone(f, 0.26, "sine", 0.07, t + i * 0.13, f * 0.85));
    },
  };

  function unlock() {
    const c = ctx();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    S.unlocked = true;
    ensureMusic();
    syncMusic();
  }
  function ensureMusic() {
    if (S.musicEl) return;
    const el = new window.Audio("assets/music/doodle.ogg");
    el.loop = true;
    el.preload = "auto";
    el.volume = 0.36;
    S.musicEl = el;
  }
  function syncMusic() {
    ensureMusic();
    const el = S.musicEl;
    if (!el) return;
    const want = S.settings.music && S.unlocked && !document.hidden;
    if (want) {
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    } else el.pause();
  }
  function setSettings(s) {
    if (s.sfx != null) S.settings.sfx = !!s.sfx;
    if (s.music != null) S.settings.music = !!s.music;
    syncMusic();
  }
  document.addEventListener("visibilitychange", syncMusic);

  global.DDAudio = {
    unlock,
    setSettings,
    syncMusic,
    sfx: SFX,
    get settings() { return S.settings; },
  };
})(window);
