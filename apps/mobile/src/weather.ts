// 날씨 문(門) — OpenWeatherMap (블럭 3)
// 하는 일 세 가지:
//   1) 도시 이름 → 좌표 확인 (지오코딩: 도시명을 위도·경도로 바꿔주는 주소 찾기)
//   2) 현재 날씨 한 줄 (목록 상단 표시용)
//   3) "이 시각 근처에 비/눈 예보가 있나" 판정 (알람 시각 조정용)
// 키가 없으면 기능이 조용히 꺼진다 — 알람 자체는 아무 영향 없음 (안전선).
// 키 위치: apps/mobile/.env 의 EXPO_PUBLIC_OPENWEATHER_API_KEY (Expo가 자동으로 읽음)

const BASE = "https://api.openweathermap.org";

// 키를 읽는다. 없으면 null — 호출한 쪽이 "날씨 기능 꺼짐"으로 처리한다.
export function getWeatherApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  if (typeof key !== "string" || key.length === 0 || key.startsWith("dummy")) return null;
  return key;
}

// 시간 제한이 있는 fetch — 날씨 서버가 늦으면 앱이 같이 늘어지지 않게 8초에서 끊는다.
async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`weather http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 1) 도시 이름 확인: 찾으면 {이름, 위도, 경도}, 못 찾으면 null, 통신 실패는 에러를 던진다.
export async function geocodeCity(
  name: string
): Promise<{ city: string; lat: number; lon: number } | null> {
  const key = getWeatherApiKey();
  if (key === null) throw new Error("no-key");
  const q = encodeURIComponent(name.trim());
  const data = (await fetchJson(
    `${BASE}/geo/1.0/direct?q=${q}&limit=1&appid=${key}`
  )) as Array<{ name?: string; local_names?: { ko?: string }; lat?: number; lon?: number }>;
  if (!Array.isArray(data) || data.length === 0) return null;
  const hit = data[0];
  if (typeof hit.lat !== "number" || typeof hit.lon !== "number") return null;
  const cityName = hit.local_names?.ko ?? hit.name ?? name.trim();
  return { city: cityName, lat: hit.lat, lon: hit.lon };
}

// 2) 현재 날씨 한 줄: "흐림 3°" 같은 표시용 문자열.
//    키가 없으면 null(기능 꺼짐 — 표시 생략), 조회 실패는 에러를 던진다(화면이 "못 불러왔어요"로 구분 표시).
export async function fetchWeatherLine(lat: number, lon: number): Promise<string | null> {
  const key = getWeatherApiKey();
  if (key === null) return null;
  const data = (await fetchJson(
    `${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=kr&appid=${key}`
  )) as { weather?: Array<{ description?: string }>; main?: { temp?: number } };
  const desc = data.weather?.[0]?.description;
  const temp = data.main?.temp;
  if (typeof desc !== "string") throw new Error("weather bad response");
  return typeof temp === "number" ? `${desc} ${Math.round(temp)}°` : desc;
}

// 비/눈으로 치는 날씨 종류 (이슬비·뇌우 포함 — 출근길이 젖는 날씨들)
const BAD = new Set(["Rain", "Snow", "Drizzle", "Thunderstorm"]);

// 3) 판정: 주어진 시각(알람 시각) 근처에 비/눈 예보가 있나.
//    예보는 3시간 단위 블록으로 오므로, [알람 2시간 전 ~ 2시간 후]와 겹치는 블록을 본다
//    (기상 준비·출근길까지 커버). 실패(통신·키)는 에러를 던진다 — 호출한 쪽이 "조정 없음"으로 처리(안전선).
export async function isBadWeatherAt(lat: number, lon: number, when: Date): Promise<boolean> {
  const key = getWeatherApiKey();
  if (key === null) throw new Error("no-key");
  const data = (await fetchJson(
    `${BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}`
  )) as { list?: Array<{ dt?: number; weather?: Array<{ main?: string }> }> };
  if (!Array.isArray(data.list)) throw new Error("weather bad response");
  const t = when.getTime();
  const from = t - 2 * 3600_000;
  const to = t + 2 * 3600_000;
  for (const entry of data.list) {
    if (typeof entry.dt !== "number") continue;
    const blockStart = entry.dt * 1000;
    const blockEnd = blockStart + 3 * 3600_000;
    if (blockEnd < from || blockStart > to) continue; // 안 겹치는 블록
    const main = entry.weather?.[0]?.main;
    if (typeof main === "string" && BAD.has(main)) return true;
  }
  return false;
}
