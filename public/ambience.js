const layer = document.getElementById("cafe-ambience");
const scene = layer.closest(".scene");
const motion = matchMedia("(prefers-reduced-motion: reduce)");

// Coordinates use the same painting grid as the weather masks and screens.
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
const motes = [[243,147],[331,176],[552,229],[790,202],[1075,184],[1245,206]];
const halos = (space) => lights[space].map(([x,y], i) =>
  `<ellipse class="ambient-lamp" cx="${x}" cy="${y}" rx="${space === "hall" ? 37 : 46}" ry="27" style="--offset:${-i * 2.13}s"/>`).join("");
const foliage = (space) => leafTips[space].map(([x,y], i) =>
  `<ellipse class="ambient-leaf-tip" cx="${x}" cy="${y}" rx="3.8" ry="1.2" transform="rotate(${i%2 ? -39 : 48} ${x} ${y})" style="--offset:${-i*1.31}s"/>`).join("");
const air = (points) => points.map(([x,y], i) =>
  `<path class="ambient-mote" d="M${x} ${y}h2v2h-2z" style="--offset:${-i*2.81}s"/>`).join("");
const roomEffects = (space) => `
  <path class="ambient-floor-light" d="${floorLight[space]}" fill="url(#cafe-daylight)"/>
  ${halos(space)}${foliage(space)}`;

layer.innerHTML = `<svg class="cafe-lighting" viewBox="0 0 1536 1024" aria-hidden="true">
    <defs>
      <radialGradient id="cafe-amber">
        <stop stop-color="#ffe5b2" stop-opacity=".53"/><stop offset=".46" stop-color="#f0c891" stop-opacity=".28"/>
        <stop offset="1" stop-color="#efc587" stop-opacity="0"/>
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
      ${roomEffects("hall")}${air(motes)}
      <ellipse class="counter-neon" cx="192" cy="658" rx="55" ry="41" fill="url(#cafe-amber)"/>
      <g clip-path="url(#cafe-kiosk-glass)">
        <rect class="kiosk-glass-scan" x="362" y="798" width="65" height="19" fill="url(#cafe-kiosk-shine)"/>
      </g>
      <g class="counter-steam" fill="#fae7d3" shape-rendering="crispEdges">
        <use href="#cafe-steam-pixel" x="175" y="648" style="--offset:-1.1s"/>
        <use href="#cafe-steam-pixel" x="189" y="644" style="--offset:-3.6s"/>
        <use href="#cafe-steam-pixel" x="204" y="646" style="--offset:-5s"/>
      </g>
      <g class="counter-cat-eyes" shape-rendering="crispEdges">
        <path fill="#f7e1b7" d="M168 707h11v6h-11z M186 707h10v6h-10z"/>
        <path fill="#433335" d="M172 708h3v6h-3z M189 708h3v6h-3z"/>
        <path fill="#fff2d4" d="M172 708h1v1h-1z M189 708h1v1h-1z"/>
      </g>
      <path class="counter-tail-shine" fill="#fff0c6" d="M218 715h6v2h-7z M215 722h2v3h-2z"/>
      <g clip-path="url(#cafe-entry-tile)">
        <g class="entry-reflections" fill="#f4cea3" shape-rendering="crispEdges">
          <path d="M590 955h20v9h-6v8h-9v-8h-5z M893 956h19v10h-4v7h-8v-8h-7z"/>
          <path d="M594 981h11v5h-11z M600 995h6v4h-6z M896 981h12v5h-12z M900 996h6v5h-6z"/>
        </g>
      </g>
    </g>
    ${Object.keys(lights).slice(1).map(room =>
      `<g class="room-ambience" data-room="${room}" transform="scale(2)">
        ${roomEffects(room)}${air([[66,106],[109,176],[155,281]])}
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
