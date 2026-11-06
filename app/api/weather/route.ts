const endpoint = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
  latitude: "37.5665",
  longitude: "126.9780",
  current: "weather_code,temperature_2m",
  daily: "sunrise,sunset",
  timezone: "Asia/Seoul",
  forecast_days: "1",
});

type Forecast = {
  current?: { weather_code?: number; temperature_2m?: number };
  daily?: { sunrise?: string[]; sunset?: string[] };
};

export async function GET() {
  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(4500),
      cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": 300, "400-599": 0 } },
    } as RequestInit);
    if (!response.ok) throw new Error("Weather provider unavailable");
    const { current, daily } = await response.json() as Forecast;
    const code = current?.weather_code;
    const temperature = current?.temperature_2m;
    if (typeof code !== "number" || !Number.isInteger(code) ||
        typeof temperature !== "number" || !Number.isFinite(temperature)) {
      throw new Error("Invalid weather data");
    }
    return Response.json({
      code,
      temperature,
      sunrise: daily?.sunrise?.[0] ?? null,
      sunset: daily?.sunset?.[0] ?? null,
    }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return Response.json({ status: "unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
