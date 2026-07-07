// 알람 한 개의 데이터 모양. 화면들과 (다음 스텝 1-3의) 폰 저장소가 공유한다.
export type Alarm = {
  id: string;
  label?: string; // 이름(선택) 예: "출근 알람"
  hour: number; // 0~23
  minute: number; // 0~59
  repeatDays: number[]; // 0=일 ... 6=토, 하나 이상
  enabled: boolean; // 켜짐/꺼짐
  weatherAdjust: boolean; // 날씨 조정 켜짐
  adjustMinutes: number; // 비/눈이면 몇 분 일찍
  vibrate: boolean; // 진동
};

// 0=일요일 ... 6=토요일
export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 시:분을 "06:45"처럼 두 자리로 보여준다.
export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// 시각을 "오전 7:00" / "오후 11:30"처럼 12시간제로 보여준다 (아침/저녁 구분용).
export function formatTime12(hour: number, minute: number): string {
  const period = hour < 12 ? "오전" : "오후";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${h12}:${String(minute).padStart(2, "0")}`;
}

// 반복 요일을 사람 말로: 매일 / 주중 / 주말 / 월·수·금 ...
export function formatRepeat(days: number[]): string {
  if (days.length === 0) return "한 번만";
  if (days.length === 7) return "매일";
  const sorted = [...days].sort((a, b) => a - b);
  const key = sorted.join(",");
  if (key === "1,2,3,4,5") return "주중(월~금)";
  if (key === "0,6") return "주말(토·일)";
  return sorted.map((d) => WEEKDAY_LABELS[d]).join("·");
}
