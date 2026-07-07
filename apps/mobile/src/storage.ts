// 폰 로컬 저장 (블럭 1 / 스텝 1-3)
// 알람 목록을 폰 안의 키-값 저장소(AsyncStorage)에 JSON으로 적어두고 읽어온다.
// 설계: docs/plan/05-db.md (MVP는 서버 없음 — 폰 안에만 저장)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alarm } from "./types";

// 키 이름에 버전을 붙여둔다 — 나중에 데이터 모양이 바뀌면 v2로 올려 안전하게 이사한다.
const ALARMS_KEY = "alarms:v1";

// 앱 시작 때 호출: 저장된 알람 목록을 읽는다.
// - 저장된 게 없으면: 빈 목록 (첫 사용)
// - 내용이 깨져 해석 불가면: 빈 목록으로 새 출발 (의도된 결정)
// - 읽기 동작 자체가 실패하면(디스크 문제 등): 에러를 그대로 던진다 —
//   "없음"과 "못 읽음"을 구분해야, 못 읽었을 때 빈 목록을 도로 저장해 알람을 지우는 사고를 막는다.
export async function loadAlarms(): Promise<Alarm[]> {
  const raw = await AsyncStorage.getItem(ALARMS_KEY);
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Alarm[]) : [];
  } catch {
    return [];
  }
}

// 사용자가 알람을 바꿀 때 호출: 전체 목록을 통째로 저장한다.
// (알람은 수십 개 수준이라 통째 저장이 가장 단순하고 충분히 빠르다)
// 실패하면 호출한 쪽(App)이 안내·재시도·되돌리기를 처리하도록 에러를 그대로 던진다.
export async function saveAlarms(alarms: Alarm[]): Promise<void> {
  await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
}
