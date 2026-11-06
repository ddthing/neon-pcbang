const layer = document.getElementById("window-view");
const badge = document.getElementById("window-weather");

// Artwork coordinates match the hall image and each enlarged room tile.
const hallPanes = [[277, 35], [319, 70], [397, 62], [469, 73], [550, 64], [622, 63],
  [693, 60], [761, 70], [839, 61], [908, 50], [966, 67], [1041, 61], [1109, 59], [1176, 45], [1228, 34]];
const lamps = [355, 548, 789, 965, 1157];
const roomPanes = {
  solo: "M0 12L92 49V451l-20-22-28-4-21 20L0 450z M114 57l66 22v400l-66 72z",
  duo: "M0 12l63 36v377L0 434z M78 51l88 29v328l-64 63-24-54z",
  team: "M0 45l50 20v396L0 478z M73 72l41 15v204l-41 32z",
  squad: "M0 40l60 22v382L0 472z M76 69l35 13v202l-35 26z",
};

let buildings = "";
let lights = "";
for (let index = 0, x = -7; x < 1030; index++) {
  const width = 22 + index * 17 % 23;
  const y = 47 + index * 13 % 18;
  buildings += `<path fill="var(--building-${index % 3})" d="M${x} 90V${y + 4}h5v-4h${width - 10}v4h5v${86 - y}z"/>`;
  for (let i = x + 6; i < x + width - 3; i += 8) {
    for (let j = y + 8; j < 88; j += 8) {
      if ((i + j + index) % 7 < 5) {
        const phase = (i + j) % 11;
        lights += `<rect x="${i}" y="${j}" width="3" height="4"${phase < 2 ? ` class="sky-lit-room" style="--offset:${-i % 23}s"` : ""}/>`;
      }
    }
  }
  x += width + 2 + index % 6;
}

layer.innerHTML = `<svg viewBox="0 0 1536 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="hall-panes" x="0" y="0" width="1536" height="1024" maskUnits="userSpaceOnUse">
      ${hallPanes.map(([x, w]) => `<rect fill="white" x="${x}" y="43" width="${w}" height="87"/>`).join("")}
      ${lamps.map(x => `<path d="M${x - 4} 41h8v7h5v4h7l6 5v12l-7 5h-30l-7-5V57l6-5h7v-4h5z"/>`).join("")}
      <path d="M277 42h17v12h-7v22h-6v24h-7v30h-17z M1251 42h26v88h-24v-24h8V83h-7z
        M466 128v-9h9v-9h8v4h6v-7h8v9h9v8h7v9z M774 131v-11h7v-8h10v4h8v-8h8v11h10v12z
        M1024 131v-11h8v-8h10v4h6v-7h8v10h8v13z M1251 131v-13h9v-10h8v23z"/>
    </mask>
    ${Object.entries(roomPanes).map(([space, path]) =>
      `<clipPath id="panes-${space}"><path d="${path}" transform="scale(2 1)"/></clipPath>`).join("")}
    <pattern id="cafe-rain-pattern" width="67" height="32" patternUnits="userSpaceOnUse">
      <path fill="#e3e9ea" d="M8 3h1v5H8z M22 22h1v8h-1z M40 12h1v6h-1z M55 3h1v9h-1z M64 24h1v6h-1z"/>
    </pattern>
    <pattern id="cafe-snow-pattern" width="95" height="48" patternUnits="userSpaceOnUse">
      <path fill="#f4f1e7" d="M4 6h2v2H4z M19 33h1v1h-1z M34 19h2v2h-2z M53 6h2v2h-2z
        M64 30h3v3h-3z M82 14h1v2h-1z M91 44h2v2h-2z"/>
    </pattern>
    <clipPath id="cafe-pendant-glass">
      ${lamps.map(x => `<path d="M${x - 3} 41h6v6h5v4h5v2h5v4h3v5h1v8h-4v3h-37v-3h-4v-8h2v-5h3v-4h5v-2h5v-4h5z"/>`).join("")}
    </clipPath>
    <g id="cafe-sky" shape-rendering="crispEdges">
      <path class="sky-top" d="M0 0h1040v90H0z"/>
      <path class="sky-band" d="M0 28h1040v62H0z"/>
      <path class="sky-horizon" d="M0 44h1040v46H0z"/>
      <g class="sky-stars" fill="#f1e6d2">
        <path d="M37 12h2v2h-2z M106 29h2v2h-2z M145 8h2v2h-2z M229 19h2v2h-2z M314 11h2v2h-2z M371 24h2v2h-2z
          M413 12h2v2h-2z M476 23h2v2h-2z M552 13h2v2h-2z M628 27h2v2h-2z M699 17h2v2h-2z M785 8h2v2h-2z M878 28h2v2h-2z M948 14h2v2h-2z"/>
      </g>
      <path class="sky-sun" d="M195 20h12v3h4v4h3v12h-3v4h-4v3h-12v-3h-4v-4h-3V27h3v-4h4z"/>
      <path class="sky-moon" fill="#e9e0cc" d="M178 12h8v3h-3v4h-2v7h2v3h4v3h-9v-2h-4v-4h-2V18h2v-4h4z"/>
      <path class="sky-cloud" d="M-65 29h13v-4h13v-3h16v3h11v4H8v3h-73z
        M57 23h13v-4h16v-3h21v3h15v4h19v3H57z M305 35h16v-4h17v-3h24v3h12v4h24v3h-93z
        M514 22h24v-4h25v-3h23v3h11v4h21v3H514z M757 28h15v-4h18v-3h25v3h13v4h20v3h-91z
        M958 21h13v-4h13v-3h16v3h11v4h20v3h-73z"/>
      <path class="sky-ridge" d="M0 65h24v-6h24v-5h32v-4h35v-5h44v4h28v5h42v4h36v6h30v-7h27v-6h32v-5h48v5h38v7h44v5h22v-5h25v-5h37v-6h33v-6h35v3h32v5h29v5h30v-5h22v-6h28v-6h31v-4h30v4h28v4h27v8h38v7h41v-5h44v-4h30v33H0z"/>
      <path class="sky-tower" d="M815 10h2v10h2v3h2v5h-3v14h4v3h-12v-3h4V28h-3v-5h2v-3h2z"/>
      ${buildings}
      <g class="sky-lights">${lights}</g>
      <g class="sky-fog"><path d="M-65 53h115v3h80v-2h183v4h238v-3h140v3h192v-4h192v12H-65z"/>
        <path d="M-65 73H70v-4h125v3h186v-5h143v3h211v5h197v-5h143v16H-65z"/></g>
      <g class="sky-rain" transform="skewX(-10)">
        <rect class="sky-rain-near" x="-31" y="-32" width="1107" height="154" fill="url(#cafe-rain-pattern)"/>
        <rect class="sky-rain-far" x="-4" y="-47" width="1107" height="154" fill="url(#cafe-rain-pattern)"/>
      </g>
      <rect class="sky-snow" x="-28" y="-48" width="1094" height="170" fill="url(#cafe-snow-pattern)"/>
    </g>
  </defs>
  <g class="hall-sky" mask="url(#hall-panes)">
    <svg x="275" y="43" width="1005" height="90" viewBox="0 0 1040 90" preserveAspectRatio="none"><use href="#cafe-sky"/></svg>
  </g>
  <image class="hall-sky" href="./pcbang-hall-pastel.png" width="1536" height="1024" clip-path="url(#cafe-pendant-glass)"/>
  ${Object.keys(roomPanes).map(space => `<g class="room-sky ${space}" clip-path="url(#panes-${space})">
    <svg x="0" y="0" width="370" height="555" viewBox="38 0 218 90" preserveAspectRatio="none"><use href="#cafe-sky"/></svg>
  </g>`).join("")}
</svg>`;

const seoulHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const names = { clear: "맑음", cloud: "흐림", rain: "비", snow: "눈", storm: "뇌우", fog: "안개" };
const phaseNames = { dawn: "아침", day: "낮", dusk: "노을", night: "밤" };
let weather = null;
let updated = 0;
let pending = false;
let retryAt = 0;

function kind(code) {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  return "unknown";
}

function minutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function paintSky() {
  const now = new Date();
  const localMinutes = minutes(seoulHour.format(now));
  const daylight = (event, fallback) => {
    const at = Date.parse((weather?.[event] || "") + "+09:00");
    return Number.isFinite(at) && Math.abs(at - now) < 18 * 3600000
      ? minutes(seoulHour.format(at))
      : fallback;
  };
  const sunrise = daylight("sunrise", 420);
  const sunset = daylight("sunset", 1080);
  const phase = localMinutes < sunrise - 35 || localMinutes >= sunset + 35 ? "night"
    : localMinutes < sunrise + 40 ? "dawn"
    : localMinutes >= sunset - 45 ? "dusk" : "day";
  const current = Date.now() - updated < 30 * 60000 ? weather : null;
  const condition = current ? kind(current.code) : "unknown";
  const label = condition === "unknown"
    ? `서울 · ${phaseNames[phase]} · 날씨 미연결`
    : `서울 · ${names[condition]} ${Math.round(current.temperature)}°`;
  layer.dataset.phase = phase;
  layer.dataset.weather = condition;
  document.body.dataset.cafeLight = phase;
  badge.textContent = label;
  badge.setAttribute("aria-label", `${label} (날씨 출처: Open-Meteo)`);
}

async function refresh() {
  if (document.hidden || pending || Date.now() < retryAt) return;
  pending = true;
  try {
    const response = await fetch("./api/weather", { signal: AbortSignal.timeout(6500) });
    if (!response.ok) throw new Error("Weather unavailable");
    const data = await response.json();
    if (!Number.isInteger(data.code) || !Number.isFinite(data.temperature)) throw new Error("Invalid weather");
    weather = data;
    updated = Date.now();
    retryAt = updated + 5 * 60000;
  } catch {
    retryAt = Date.now() + 60000;
  } finally {
    pending = false;
    paintSky();
  }
}

paintSky();
refresh();
setInterval(() => {
  if (document.hidden) return;
  paintSky();
  refresh();
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { paintSky(); refresh(); }
});
