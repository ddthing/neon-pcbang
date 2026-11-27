import { CAFE_TIME_ZONE, formatCafeTime } from "./cafe-clock.mjs";

const badge = document.getElementById("window-weather");

const geoKey = "cafe-user-geo-v1";
const weatherCacheKey = "cafe-weather-cache-v1";
const names = { clear: "맑음", cloud: "흐림", rain: "비", snow: "눈", storm: "뇌우", fog: "안개" };
const phaseNames = { dawn: "아침", day: "낮", dusk: "노을", night: "밤" };
let weather = null;
let updated = 0;
let pending = false;
let retryAt = 0;
let geoAttempted = false;

function loadWeatherCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(weatherCacheKey));
    if (cached?.data && Number.isFinite(cached.at) && Date.now() - cached.at < 30 * 60_000) {
      weather = cached.data;
      updated = cached.at;
    }
  } catch {}
}

function saveWeatherCache(data, at) {
  try { localStorage.setItem(weatherCacheKey, JSON.stringify({ data, at })); } catch {}
}

function readCachedGeo() {
  try {
    const raw = JSON.parse(localStorage.getItem(geoKey));
    if (raw && Number.isFinite(raw.lat) && Number.isFinite(raw.lon) && Date.now() - raw.at < 6 * 3600_000) {
      return raw;
    }
  } catch {}
  return null;
}

function saveGeo(lat, lon) {
  try { localStorage.setItem(geoKey, JSON.stringify({ lat, lon, at: Date.now() })); } catch {}
}

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

function isoTimeMinutes(iso) {
  if (typeof iso !== "string") return null;
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? minutes(match[1]) : null;
}

function paintSky() {
  const localMinutes = minutes(formatCafeTime(new Date()));
  const sunrise = isoTimeMinutes(weather?.sunrise) ?? 400; // ~06:40 fallback
  const sunset = isoTimeMinutes(weather?.sunset) ?? 1070; // ~17:50 fallback
  const phase = localMinutes < sunrise - 35 || localMinutes >= sunset + 35 ? "night"
    : localMinutes < sunrise + 40 ? "dawn"
    : localMinutes >= sunset - 45 ? "dusk" : "day";
  const current = Date.now() - updated < 30 * 60000 ? weather : null;
  const condition = current ? kind(current.code) : "unknown";
  const area = current?.location || "내 위치";
  const label = condition === "unknown"
    ? `${area} · ${phaseNames[phase]}`
    : `${area} · ${names[condition]} ${Math.round(current.temperature)}°`;
  document.body.dataset.cafeLight = phase;
  document.body.dataset.cafeWeather = condition;
  badge.textContent = label;
  badge.setAttribute("aria-label", `${label} (날씨 출처: Open-Meteo)`);
}

function requestBrowserLocation() {
  if (geoAttempted || readCachedGeo() || !navigator.geolocation) return;
  geoAttempted = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      saveGeo(pos.coords.latitude, pos.coords.longitude);
      retryAt = 0;
      refresh();
    },
    () => {},
    { maximumAge: 6 * 3600_000, timeout: 4500 },
  );
}

async function refresh() {
  if (document.hidden || pending || Date.now() < retryAt) return;
  pending = true;
  try {
    const params = new URLSearchParams({ tz: CAFE_TIME_ZONE });
    const geo = readCachedGeo();
    if (geo) {
      params.set("lat", String(geo.lat));
      params.set("lon", String(geo.lon));
    }
    const response = await fetch("./api/weather?" + params.toString(), { signal: AbortSignal.timeout(6500) });
    if (!response.ok) throw new Error("Weather unavailable");
    const data = await response.json();
    if (!Number.isInteger(data.code) || !Number.isFinite(data.temperature)) throw new Error("Invalid weather");
    weather = data;
    updated = Date.now();
    retryAt = updated + 5 * 60000;
    saveWeatherCache(data, updated);
  } catch {
    retryAt = Date.now() + 60000;
  } finally {
    pending = false;
    paintSky();
  }
}

loadWeatherCache();
paintSky();
requestBrowserLocation();
refresh();
setInterval(() => {
  if (document.hidden) return;
  paintSky();
  refresh();
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { paintSky(); refresh(); }
});
