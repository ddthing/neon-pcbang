type Forecast = {
  timezone?: string;
  current?: { weather_code?: number; temperature_2m?: number };
  daily?: { sunrise?: string[]; sunset?: string[] };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLat = url.searchParams.get("lat");
  const rawLon = url.searchParams.get("lon");
  const rawTz = url.searchParams.get("tz");

  const cf = (request as Request & { cf?: Record<string, unknown> }).cf;
  const cfLat = Number(cf?.latitude);
  const cfLon = Number(cf?.longitude);
  const cfCity = typeof cf?.city === "string" ? cf.city.trim() : "";
  const cfTz = typeof cf?.timezone === "string" ? cf.timezone.trim() : "";

  const parsedLat = rawLat !== null ? Number(rawLat) : NaN;
  const parsedLon = rawLon !== null ? Number(rawLon) : NaN;
  const hasQueryCoords =
    Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90 &&
    Number.isFinite(parsedLon) && parsedLon >= -180 && parsedLon <= 180;

  const hasCfCoords =
    Number.isFinite(cfLat) && cfLat >= -90 && cfLat <= 90 &&
    Number.isFinite(cfLon) && cfLon >= -180 && cfLon <= 180;

  const latitude = hasQueryCoords ? parsedLat.toFixed(4)
    : hasCfCoords ? cfLat.toFixed(4) : "37.5665";
  const longitude = hasQueryCoords ? parsedLon.toFixed(4)
    : hasCfCoords ? cfLon.toFixed(4) : "126.9780";

  const requestedTz = rawTz && /^[A-Za-z0-9_+-]+\/[A-Za-z0-9_+-]+$/.test(rawTz)
    ? rawTz : "";
  const timezone = requestedTz || cfTz || "auto";
  const locationLabel = hasQueryCoords ? (cfCity || "내 위치")
    : cfCity ? cfCity : "우리 동네";

  const endpoint = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude,
    longitude,
    current: "weather_code,temperature_2m",
    daily: "sunrise,sunset",
    timezone,
    forecast_days: "1",
  });

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(4500),
      cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": 300, "400-599": 0 } },
    } as RequestInit);
    if (!response.ok) throw new Error("Weather provider unavailable");
    const data = await response.json() as Forecast;
    const code = data.current?.weather_code;
    const temperature = data.current?.temperature_2m;
    if (typeof code !== "number" || !Number.isInteger(code) ||
        typeof temperature !== "number" || !Number.isFinite(temperature)) {
      throw new Error("Invalid weather data");
    }
    return Response.json({
      code,
      temperature,
      sunrise: data.daily?.sunrise?.[0] ?? null,
      sunset: data.daily?.sunset?.[0] ?? null,
      timezone: data.timezone ?? (requestedTz || "Asia/Seoul"),
      location: locationLabel,
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return Response.json({ status: "unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
