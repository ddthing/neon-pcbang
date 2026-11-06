const layer = document.getElementById("cafe-ambience");
const scene = layer.closest(".scene");
const control = document.getElementById("ambience-control");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const preference = "neon-pcbang-ambience";
const artwork = {
  hall: document.getElementById("lobby-art"),
  rooms: document.getElementById("rooms-art"),
};

// Rectangles are in source pixels. Room rectangles are relative to a 768×512 atlas tile.
const plants = {
  hall: [[57, 838, 98, 88], [1380, 839, 95, 88], [395, 710, 51, 42], [954, 710, 47, 43]],
  solo: [[571, 251, 111, 124], [229, 3, 134, 179]],
  duo: [[592, 62, 125, 136]],
  team: [[7, 239, 87, 108], [620, 4, 96, 152]],
  squad: [[9, 217, 81, 116], [683, 6, 77, 137]],
};
const roomOffsets = { solo: [0, 0], duo: [768, 0], team: [0, 512], squad: [768, 512] };
const ceilingLamps = {
  hall: [[355, 67], [548, 67], [789, 67], [965, 67], [1157, 67]],
  solo: [[418, 89]],
  duo: [[310, 96], [537, 96]],
  team: [[235, 93], [415, 93], [596, 93]],
  squad: [[266, 52], [424, 52], [586, 52]],
};
const entranceLamps = [[603, 875], [901, 875], [460, 726], [685, 726], [926, 726], [1167, 726]];
const halos = (lights, width, height) => lights.map(([x, y], i) =>
  `<ellipse class="ambient-lamp" cx="${x}" cy="${y}" rx="${width}" ry="${height}" style="--offset:${-i * 2.13}s"/>`).join("");

layer.innerHTML = `<div class="plant-tiles"></div>
  <svg class="cafe-lighting" viewBox="0 0 1536 1024" aria-hidden="true">
    <defs>
      <radialGradient id="cafe-amber">
        <stop stop-color="#ffe5b2" stop-opacity=".53"/><stop offset=".46" stop-color="#f0c891" stop-opacity=".28"/>
        <stop offset="1" stop-color="#efc587" stop-opacity="0"/>
      </radialGradient>
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
      ${halos(ceilingLamps.hall, 46, 30)}
      ${halos(entranceLamps, 27, 39)}
      <ellipse class="counter-neon" cx="192" cy="637" rx="60" ry="49" fill="url(#cafe-amber)"/>
      <g clip-path="url(#cafe-kiosk-glass)">
        <rect class="kiosk-glass-scan" x="362" y="798" width="65" height="19" fill="url(#cafe-kiosk-shine)"/>
      </g>
      <g class="counter-steam" fill="#fae7d3" shape-rendering="crispEdges">
        <use href="#cafe-steam-pixel" x="176" y="633" style="--offset:-1.1s"/>
        <use href="#cafe-steam-pixel" x="190" y="629" style="--offset:-3.6s"/>
        <use href="#cafe-steam-pixel" x="204" y="631" style="--offset:-5s"/>
      </g>
      <g clip-path="url(#cafe-entry-tile)">
        <g class="entry-reflections" fill="#f4cea3" shape-rendering="crispEdges">
          <path d="M590 955h20v9h-6v8h-9v-8h-5z M893 956h19v10h-4v6h-11v-5h-4z"/>
          <path d="M594 981h11v5h-11z M600 995h6v4h-6z M896 981h12v5h-12z M900 996h6v5h-6z"/>
        </g>
      </g>
    </g>
    ${Object.keys(roomOffsets).map(room => `<g class="room-ambience" data-room="${room}" transform="scale(2)">${halos(ceilingLamps[room], 47, 32)}</g>`).join("")}
  </svg>`;

const plantLayer = layer.querySelector(".plant-tiles");
const switchButton = control.querySelector("button");
let preferred = true;
try { preferred = localStorage.getItem(preference) !== "off"; } catch {}
const syncSwitch = connectCafeSwitch(control, (enabled) => {
  preferred = enabled;
  try { localStorage.setItem(preference, enabled ? "on" : "off"); } catch {}
  refresh();
  return true;
});

let visible = false;
let active = false;
let timer = 0;
let space;
let tiles = [];
let source;

function selectSpace() {
  const current = scene.dataset.space === "lobby" ? "hall" : scene.dataset.space;
  if (current === space) return;
  space = current;
  const [ox, oy] = roomOffsets[space] || [0, 0];
  const width = space === "hall" ? 1536 : 768;
  const height = space === "hall" ? 1024 : 512;
  source = space === "hall" ? artwork.hall : artwork.rooms;
  tiles = plants[space].map(([x, y, w, h]) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    Object.assign(canvas.style, {
      left: x / width * 100 + "%", top: y / height * 100 + "%",
      width: w / width * 100 + "%", height: h / height * 100 + "%",
    });
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    return { canvas, context, x: x + ox, y: y + oy, w, h };
  });
  plantLayer.replaceChildren(...tiles.map(tile => tile.canvas));
}

function paintPlants() {
  if (source.complete && source.naturalWidth) {
    const now = performance.now() / 1000;
    for (const [index, { context, x, y, w, h }] of tiles.entries()) {
      const breeze = 2.2 * Math.sin(now * .9 + index * 2.1) + Math.sin(now * 1.6 + index);
      for (let row = 0; row < h; row += 2) {
        // Taper to zero at the patch edges so the pot and floor stay anchored.
        const shift = Math.round(breeze * Math.sin(Math.PI * row / h));
        const strip = Math.min(2, h - row);
        context.drawImage(source, x - shift, y + row, w, strip, 0, row, w, strip);
      }
    }
  }
  timer = setTimeout(paintPlants, 125);
}

function refresh() {
  const enabled = preferred && !motion.matches;
  const wasActive = active;
  active = enabled && visible && !document.hidden;
  document.body.dataset.ambience = enabled ? "on" : "off";
  scene.toggleAttribute("data-ambience-active", active);
  switchButton.disabled = motion.matches;
  control.title = motion.matches ? "시스템에서 동작 줄이기를 사용 중이에요." : "";
  syncSwitch(enabled);
  plantLayer.hidden = !active;
  if (active) {
    selectSpace();
    if (!wasActive) paintPlants();
  } else if (wasActive) {
    clearTimeout(timer);
  }
}

new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  refresh();
}).observe(scene.parentElement);
new MutationObserver(refresh).observe(scene, { attributes: true, attributeFilter: ["data-space"] });
motion.addEventListener("change", refresh);
document.addEventListener("visibilitychange", refresh);
refresh();
