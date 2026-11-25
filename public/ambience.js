const layer = document.getElementById("cafe-ambience");
const scene = layer.closest(".scene");
const motion = matchMedia("(prefers-reduced-motion: reduce)");

// Coordinates use the 1536x1024 scene grid
const lights = {
  hall: [[355,63],[548,63],[789,64],[965,63],[1157,63],[603,875],[901,875],
    [460,726],[685,726],[926,726],[1167,726],[1404,505]],
  solo: [[418,80]], duo: [[310,90],[537,87]],
  team: [[235,90],[415,91],[596,90]], squad: [[266,43],[424,43],[586,44]],
};
const leafTips = {
  hall: [[253,80],[267,95],[484,122],[805,130],[1042,124],[1273,84],[1274,102]],
  solo: [[282,88],[289,109],[624,298],[610,337]],
  duo: [[201,105],[201,138],[623,135],[652,160]],
  team: [[148,83],[168,100],[652,72],[676,112]],
  squad: [[32,259],[40,288],[718,68],[723,104]],
};
const floorLight = {
  hall: "M552 156h55l-8 158h-52z M764 155h55l13 155h-52z M1008 155h50l12 155h-51z",
  solo: "M181 454l89 12 48 44h-195z",
  duo: "M146 449l64 9 44 53H96z",
  team: "M98 428l76 11 75 72H37z",
  squad: "M91 452l61 9 70 50H42z",
};
const strips = {
  solo: "M0 419l178-126 2 1L0 422z",
  duo: "M0 410l138-106 2 1L0 413z",
  squad: "M163 39h520v2H163z",
};
const hallMotes = [
  [243,147],[331,176],[552,229],[790,202],[1075,184],[1245,206],
  [312,288],[567,327],[590,465],[771,374],[795,503],[1015,324],[1024,459],
  [1251,552],[581,680],[797,659],[1030,696],[1226,754],
  [328,767],[467,808],[645,779],[711,841],[888,792],[1074,820],
];
const roomMotes = {
  solo: [[44,110],[106,189],[176,267],[235,352],[314,129],[491,159],[547,419]],
  duo: [[57,117],[124,189],[190,293],[221,372],[351,118],[563,130],[597,408]],
  team: [[36,135],[72,209],[129,268],[219,133],[338,144],[460,125],[576,151],[656,453]],
  squad: [[38,108],[79,164],[120,224],[170,358],[301,133],[463,107],[612,137],[662,452]],
};
const looseLeaves = {
  hall: [[263,89],[488,140],[1043,140],[1274,100]],
  solo: [[284,108],[623,298]], duo: [[201,122],[642,160]],
  team: [[154,114],[673,113]], squad: [[722,103],[47,277]],
};
const halos = (space) => lights[space].map(([x,y], i) =>
  `<ellipse class="ambient-lamp" cx="${x}" cy="${y}" rx="${space === "hall" ? 37 : 46}" ry="27" style="--offset:${-i * 2.13}s"/>`).join("");
const foliage = (space) => leafTips[space].map(([x,y], i) =>
  `<ellipse class="ambient-leaf-tip" cx="${x}" cy="${y}" rx="3.8" ry="1.2" transform="rotate(${i%2 ? -39 : 48} ${x} ${y})" style="--offset:${-i*1.31}s"/>`).join("");
const air = (points, room = false) => points.map(([x,y], i) => {
  const size = i % 4 === 0 && !room ? 4 : 2;
  const drift = (i % 2 ? 1 : -1) * (12 + (i * 13) % 31);
  return `<path class="ambient-mote" d="M${x} ${y}h${size}v${size}h-${size}z"
    style="--offset:${-i * 2.73}s;--duration:${8 + i % 7}s;--drift:${drift}px"/>`;
}).join("");
const fallingLeaves = (space) => looseLeaves[space].map(([x,y], i) =>
  `<path class="ambient-loose-leaf" d="M${x} ${y}h4v2h-2v2h-3v-2h1z"
    style="--offset:${-i * 7.3 - (space === "hall" ? 1 : 3)}s"/>`).join("");
const roomEffects = (space) => `
  <path class="ambient-floor-light" d="${floorLight[space]}" fill="url(#cafe-daylight)"/>
  ${halos(space)}${foliage(space)}`;

// Smoking Booth suction wisps drawn toward the ceiling exhaust fans (x=1070,1175 y=140)
const boothSmoke = Array.from({ length: 14 }, (_, i) => {
  const sx = 660 + (i * 47) % 560;
  const sy = 430 + (i * 29) % 130;
  const dx = 1120 - sx;
  return `<rect class="booth-smoke-wisp" x="${sx}" y="${sy}" width="${6 + (i % 3) * 3}" height="${4 + (i % 2) * 2}"
    style="--offset:${-i * 0.65}s;--suction-x:${Math.round(dx * 0.55)}px"/>`;
}).join("");

// Night Terrace rain droplets & fairy-light warm halos + alley neon shimmer
const terraceFairy = [[260,132],[320,152],[380,164],[440,164],[500,154],[565,142],[622,108],
  [668,142],[728,154],[800,154],[865,142],[925,108],[990,142],[1062,158],[1148,164],[1212,158],[1268,142]]
  .map(([x, y], i) => `<circle class="terrace-bulb" cx="${x}" cy="${y}" r="18" fill="url(#cafe-amber)" style="--offset:${-i * 0.5}s"/>`).join("");

const terraceRain = Array.from({ length: 28 }, (_, i) => {
  const rx = 280 + (i * 39) % 1020;
  const ry = 180 + (i * 31) % 260;
  return `<rect class="terrace-rain-drop" x="${rx}" y="${ry}" width="2" height="14" style="--offset:${-i * 0.21}s"/>`;
}).join("");

layer.innerHTML = `<svg class="cafe-lighting" viewBox="0 0 1536 1024" aria-hidden="true">
    <defs>
      <radialGradient id="cafe-amber">
        <stop stop-color="#ffe7a8" stop-opacity=".55"/><stop offset=".46" stop-color="#f6cf73" stop-opacity=".28"/>
        <stop offset="1" stop-color="#ecc28e" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="cafe-cyan-neon">
        <stop stop-color="#ffe7a8" stop-opacity=".46"/><stop offset=".5" stop-color="#ecc28e" stop-opacity=".18"/>
        <stop offset="1" stop-color="#ecc28e" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="cafe-daylight" x2=".12" y2="1">
        <stop stop-color="#f7dcb7" stop-opacity=".52"/><stop offset="1" stop-color="#fbefcf" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="cafe-kiosk-shine" x1="0" x2="0" y1="0" y2="1">
        <stop stop-color="#e4f9d1" stop-opacity="0"/><stop offset=".7" stop-color="#e4f9d1" stop-opacity=".55"/>
        <stop offset="1" stop-color="#e4f9d1" stop-opacity="0"/>
      </linearGradient>
      <clipPath id="cafe-kiosk-glass"><path d="M384 823l35 8-17 44-34-10z"/></clipPath>
      <clipPath id="cafe-entry-tile"><path d="M0 956h1536v68H0z"/></clipPath>
      <path id="cafe-steam-pixel" d="M0 14h3v-5h3V5h-2V0h3v5h2v6H6v5H0z"/>
    </defs>
    <rect class="cafe-night-veil" width="1536" height="1024"/>
    <g class="hall-ambience">
      ${roomEffects("hall")}${air(hallMotes)}${fallingLeaves("hall")}
      <ellipse class="counter-neon" cx="192" cy="658" rx="55" ry="41" fill="url(#cafe-amber)"/>
      <ellipse class="booth-hall-glow" cx="135" cy="95" rx="95" ry="55" fill="url(#cafe-cyan-neon)"/>
      <ellipse class="terrace-hall-glow" cx="1340" cy="70" rx="85" ry="45" fill="url(#cafe-amber)"/>
      <g clip-path="url(#cafe-kiosk-glass)">
        <rect class="kiosk-glass-scan" x="362" y="798" width="65" height="19" fill="url(#cafe-kiosk-shine)"/>
      </g>
      <g class="counter-steam" fill="#fae7d3" shape-rendering="crispEdges">
        <use href="#cafe-steam-pixel" x="175" y="648" style="--offset:-1.1s"/>
        <use href="#cafe-steam-pixel" x="189" y="644" style="--offset:-3.6s"/>
        <use href="#cafe-steam-pixel" x="204" y="646" style="--offset:-5s"/>
      </g>
      <g class="counter-steam-dots" fill="#ffe9ca">
        <path d="M172 654h3v3h-3z" style="--offset:-.4s"/>
        <path d="M188 646h4v4h-4z" style="--offset:-2.3s"/>
        <path d="M199 652h2v2h-2z" style="--offset:-4.8s"/>
        <path d="M209 649h3v3h-3z" style="--offset:-6.2s"/>
      </g>
      <g clip-path="url(#cafe-entry-tile)">
        <g class="entry-reflections" fill="#f4cea3" shape-rendering="crispEdges">
          <path d="M590 955h20v9h-6v8h-9v-8h-5z M893 956h19v10h-4v7h-8v-8h-7z"/>
          <path d="M594 981h11v5h-11z M600 995h6v4h-6z M896 981h12v5h-12z M900 996h6v5h-6z"/>
        </g>
      </g>
    </g>
    <g class="booth-ambience">
      <ellipse class="booth-neon-halo" cx="975" cy="256" rx="190" ry="78" fill="url(#cafe-amber)"/>
      <ellipse class="ambient-lamp" cx="1315" cy="360" rx="68" ry="58" fill="url(#cafe-amber)"/>
      <g class="booth-fan" transform="translate(1070 140)">
        <circle r="24" fill="#fbe3d322"/>
        <path class="fan-blades" fill="#dfd0d377" d="M-4 -20h8v16h-8z M-4 4h8v16h-8z M-20 -4h16v8h-16z M4 -4h16v8h-16z"/>
      </g>
      <g class="booth-fan" transform="translate(1173 140)">
        <circle r="24" fill="#fbe3d322"/>
        <path class="fan-blades" fill="#dfd0d377" d="M-4 -20h8v16h-8z M-4 4h8v16h-8z M-20 -4h16v8h-16z M4 -4h16v8h-16z"/>
      </g>
      <g class="booth-smoke-layer" fill="#fff5eb" shape-rendering="crispEdges">${boothSmoke}</g>
    </g>
    <g class="terrace-ambience">
      ${terraceFairy}
      <ellipse cx="995" cy="285" rx="95" ry="60" fill="url(#cafe-amber)"/>
      <ellipse cx="195" cy="485" rx="75" ry="65" fill="url(#cafe-amber)"/>
      <g class="terrace-rain-layer" fill="#e4f2f7aa" shape-rendering="crispEdges">${terraceRain}</g>
    </g>
    ${Object.keys(lights).slice(1).map(room =>
      `<g class="room-ambience" data-room="${room}" transform="scale(2)">
        ${roomEffects(room)}${air(roomMotes[room], true)}${fallingLeaves(room)}
        ${strips[room] ? `<path class="room-strip-light" d="${strips[room]}"/>` : ""}
      </g>`).join("")}
  </svg>`;

let visible = false;
function refresh() {
  scene.toggleAttribute("data-ambience-active", !motion.matches && visible && !document.hidden);
}
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  refresh();
}).observe(scene.parentElement);
motion.addEventListener("change", refresh);
document.addEventListener("visibilitychange", refresh);
refresh();
