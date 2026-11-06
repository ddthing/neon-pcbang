const layer = document.getElementById("window-view");
const badge = document.getElementById("window-weather");

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
    <pattern id="cafe-rain-pattern" width="67" height="32" patternUnits="userSpaceOnUse">
      <path fill="#e3e9ea" d="M8 3h1v5H8z M22 22h1v8h-1z M40 12h1v6h-1z M55 3h1v9h-1z M64 24h1v6h-1z"/>
    </pattern>
    <pattern id="cafe-snow-pattern" width="95" height="48" patternUnits="userSpaceOnUse">
      <path fill="#f4f1e7" d="M4 6h2v2H4z M19 33h1v1h-1z M34 19h2v2h-2z M53 6h2v2h-2z
        M64 30h3v3h-3z M82 14h1v2h-1z M91 44h2v2h-2z"/>
    </pattern>
    <path id="city-bird" d="M0 2h3v2h3V2h3V0h2v4H8v2H4V4H0z"/>
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
      <g class="sky-flock">
        <use href="#city-bird" x="45" y="24"/><use href="#city-bird" x="66" y="17"/><use href="#city-bird" x="77" y="29"/>
      </g>
      <g class="city-traffic">
        <path class="city-car car-east" fill="#edd6ac" d="M27 87h8v1h-8z M96 88h6v1h-6z M191 87h6v1h-6z M322 88h9v1h-9z M524 87h7v1h-7z"/>
        <path class="city-car car-west" fill="#dc9c8b" d="M192 88h6v1h-6z M455 89h7v1h-7z M601 89h8v1h-8z M808 88h6v1h-6z M993 88h10v1h-10z"/>
      </g>
      <g class="sky-fog"><path d="M-65 53h115v3h80v-2h183v4h238v-3h140v3h192v-4h192v12H-65z"/>
        <path d="M-65 73H70v-4h125v3h186v-5h143v3h211v5h197v-5h143v16H-65z"/></g>
      <g class="sky-rain" transform="skewX(-10)">
        <rect class="sky-rain-near" x="-31" y="-32" width="1107" height="154" fill="url(#cafe-rain-pattern)"/>
        <rect class="sky-rain-far" x="-4" y="-47" width="1107" height="154" fill="url(#cafe-rain-pattern)"/>
      </g>
      <rect class="sky-snow" x="-28" y="-48" width="1094" height="170" fill="url(#cafe-snow-pattern)"/>
      <path class="sky-storm-flash" d="M0 0h1040v90H0z" fill="#e2e4ef"/>
    </g>
  </defs>
  <svg class="hall-sky" x="244" y="40" width="1050" height="93" viewBox="0 0 1040 90" preserveAspectRatio="none"><use href="#cafe-sky"/></svg>
  <svg class="room-sky" x="0" y="0" width="398" height="699" viewBox="26 0 302 90" transform="skewY(-8)" preserveAspectRatio="none"><use href="#cafe-sky"/></svg>
  <svg class="room-transom" x="420" y="0" width="1010" height="55" viewBox="10 0 1010 36" preserveAspectRatio="none"><use href="#cafe-sky"/></svg>
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
