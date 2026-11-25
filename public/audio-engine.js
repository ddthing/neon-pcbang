// Spatial WebAudio Soundscape, Zone Filter & Mechanical Switch Synthesizer for Gilmotungi PC Bang
(() => {
  const sfxKey = "neon-pcbang-sfx-enabled";
  let sfxEnabled = true;
  try {
    const stored = localStorage.getItem(sfxKey);
    if (stored !== null) sfxEnabled = stored !== "0";
  } catch {}

  let ctx = null;
  let humNode = null;
  let humGain = null;
  let currentZone = "hall";

  function ensureCtx() {
    if (!sfxEnabled) return null;
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return null;
    if (!ctx) {
      try { ctx = new AudioEngine(); } catch { return null; }
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, duration, type = "triangle", gainPeak = 0.08, slideTo = null) {
    const audio = ensureCtx();
    if (!audio || audio.state !== "running") return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.015);
  }

  // Mechanical Keyboard Switch Synthesizer (청축 Blue / 갈축 Brown / 적축 Red)
  window.cafeAudioKeySwitch = (switchType = "blue") => {
    const audio = ensureCtx();
    if (!audio || audio.state !== "running") return;
    const now = audio.currentTime;
    if (switchType === "blue") {
      // Crisp high-pitched click jacket + bottom-out thock
      tone(2350 + Math.random() * 180, 0.022, "square", 0.045, 1100);
      setTimeout(() => tone(320, 0.03, "triangle", 0.05, 140), 11);
    } else if (switchType === "brown") {
      tone(980 + Math.random() * 90, 0.026, "triangle", 0.045, 420);
    } else {
      // Creamy linear Red switch thock
      tone(410 + Math.random() * 50, 0.032, "sine", 0.055, 180);
    }
    // Resume context on user gesture if just unlocked
    if (audio.state !== "running") audio.resume().catch(() => {});
  };

  window.cafeAudioPlay = (kind) => {
    const audio = ensureCtx();
    if (!audio) return;
    switch (kind) {
      case "tick":
        tone(680, 0.035, "triangle", 0.045, 520);
        break;
      case "pop":
        tone(520, 0.065, "sine", 0.075, 880);
        break;
      case "thud":
        tone(190, 0.11, "sawtooth", 0.06, 85);
        break;
      case "wave":
        tone(587.33, 0.08, "sine", 0.06, 783.99);
        break;
      case "eat":
        tone(440, 0.07, "triangle", 0.07, 660);
        setTimeout(() => tone(587, 0.08, "triangle", 0.07, 784), 85);
        break;
      case "door":
        // Sliding glass booth / terrace door swoosh + latch
        tone(310, 0.12, "sine", 0.05, 190);
        setTimeout(() => tone(820, 0.04, "triangle", 0.035, 620), 90);
        break;
      case "chime":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          setTimeout(() => tone(f, 0.16, "sine", 0.065), idx * 70);
        });
        break;
    }
  };

  // Subtle negative-pressure exhaust fan hum inside Smoking Booth & night breeze on Terrace
  function syncZoneAmbience(zone) {
    currentZone = zone;
    window.cafeAudioPlay?.("door");
    if (!ctx || !sfxEnabled) return;
    if (zone === "booth") {
      if (!humNode) {
        humNode = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 160;
        humGain = ctx.createGain();
        humGain.gain.value = 0.0001;
        humNode.type = "sawtooth";
        humNode.frequency.value = 68;
        humNode.connect(filter).connect(humGain).connect(ctx.destination);
        humNode.start();
      }
      humGain.gain.setTargetAtTime(0.022, ctx.currentTime, 0.25);
    } else if (humGain && ctx) {
      humGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
    }
  }

  window.cafeAudioSetZone = syncZoneAmbience;

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("sfx-toggle");
    if (!btn) return;
    const renderBtn = () => {
      btn.setAttribute("aria-pressed", String(sfxEnabled));
      btn.textContent = sfxEnabled ? "🔊" : "🔇";
      btn.title = sfxEnabled ? "효과음 켜짐 (누르면 끄기)" : "효과음 꺼짐 (누르면 켜기)";
    };
    renderBtn();
    btn.addEventListener("click", () => {
      sfxEnabled = !sfxEnabled;
      try { localStorage.setItem(sfxKey, sfxEnabled ? "1" : "0"); } catch {}
      if (!sfxEnabled && humGain && ctx) {
        humGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
      } else if (sfxEnabled) {
        ensureCtx();
        tone(659.25, 0.08, "sine", 0.06, 880);
        if (currentZone === "booth") syncZoneAmbience("booth");
      }
      renderBtn();
    });
  });
})();
