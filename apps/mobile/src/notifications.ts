// 알림(알람 울리기) 담당 (블럭 1 / 스텝 1-4)
// 폰의 알림 시스템에 "매주 이 요일 이 시각에 소리·진동 알림을 울려라"라고 예약한다.
// 웹(노트북 미리보기)엔 폰 알림이 없으므로 모든 함수가 조용히 건너뛴다.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { Alarm, formatTime12 } from "./types";
import { isBadWeatherAt } from "./weather";

const isWeb = Platform.OS === "web";

// 앱이 화면에 떠 있는 동안에도 알림이 소리와 함께 보이게 한다.
// (기본값은 "앱 사용 중엔 조용히"라서, 알람앱에는 맞지 않는다)
if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      // 앱이 켜진 상태로 울릴 땐 시스템 소리를 끈다 — 울림 화면(RingScreen)이 소리를 담당하므로
      // 시스템 "딩"과 알람음이 겹치는 것을 막는다. (앱이 꺼져 있을 땐 채널 소리가 대신 울림)
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// 안드로이드는 "알림 채널"(알림 종류별 소리·진동 설정 묶음)이 있어야 제대로 울린다.
// 진동 켬/끔을 알람마다 고를 수 있게 채널을 두 개 만든다. (iOS는 채널 개념이 없어 건너뜀)
export async function setupNotifications(): Promise<void> {
  if (isWeb) return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("alarm", {
      name: "알람 (소리·진동)",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500],
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync("alarm-quiet", {
      name: "알람 (소리만)",
      importance: Notifications.AndroidImportance.MAX,
      enableVibrate: false,
    });
  }
}

export type PermissionState = "granted" | "denied" | "unavailable";

// 알림 권한을 확인하고, 아직 안 물어봤으면 요청한다.
// granted = 허용 / denied = 거부(설정에서 켜야 함) / unavailable = 웹이라 해당 없음
export async function ensurePermission(): Promise<PermissionState> {
  if (isWeb) return "unavailable";
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  if (current.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted ? "granted" : "denied";
  }
  return "denied";
}

// 권한을 "확인만" 한다 (요청 팝업을 절대 띄우지 않음).
// 설정에 갔다 돌아왔을 때 상태를 갱신하는 용도 — 여기서 요청까지 하면 팝업이 또 떠서 성가시다.
export async function checkPermission(): Promise<PermissionState> {
  if (isWeb) return "unavailable";
  const current = await Notifications.getPermissionsAsync();
  return current.granted ? "granted" : "denied";
}

// 날씨 조회에 필요한 좌표(도시 설정에서 나옴). null이면 날씨 기능 꺼짐.
export type Coords = { lat: number; lon: number } | null;

// 재예약 결과: 알람 id → "이번 회차가 비/눈 예보로 일찍 당겨졌나" (목록·울림 화면 표시용)
export type AdjustInfo = Record<string, boolean>;

// 재예약 줄세우기: 재예약이 겹쳐 돌면 "취소↔예약"이 뒤엉켜 끈 알람이 남을 수 있다.
// 요청을 한 줄로 세우고, 더 새 목록이 대기 중이면 낡은 요청은 건너뛴다(최신 목록만 반영).
let queue: Promise<unknown> = Promise.resolve();
let latestCallId = 0;

// handledUntil: 알람 id → "이미 울려서 처리한 회차의 원래 시각". 조정 알람이 일찍 울려 껐을 때,
// 재예약이 '오늘 원래 시각'을 또 잡아 같은 아침 두 번 울리는 것을 막는다.
export function rescheduleAll(
  alarms: Alarm[],
  coords: Coords,
  handledUntil: Record<string, number> = {}
): Promise<AdjustInfo | null> {
  if (isWeb) return Promise.resolve(null);
  const callId = ++latestCallId;
  const run = queue.then(async () => {
    if (callId !== latestCallId) return null; // 이 사이 더 새 요청이 들어옴 → 이건 낡아서 건너뜀
    return doRescheduleAll(alarms, coords, handledUntil);
  });
  queue = run.catch(() => {});
  return run;
}

// 알람의 "다음 울릴 시각"을 계산한다 (오늘 그 시각이 아직 안 지났고 요일이 맞으면 오늘).
export function nextOccurrence(alarm: Alarm, from: Date): Date {
  for (let add = 0; add < 8; add++) {
    const d = new Date(from);
    d.setDate(d.getDate() + add);
    d.setHours(alarm.hour, alarm.minute, 0, 0);
    if (d.getTime() <= from.getTime()) continue;
    if (alarm.repeatDays.includes(d.getDay())) return d;
  }
  // repeatDays가 비어있지 않는 한 도달하지 않음 (안전용 기본값)
  const f = new Date(from);
  f.setDate(f.getDate() + 7);
  return f;
}

// 예약 장부를 통째로 갈아끼운다: 기존 예약 전부 취소 → 켜진 알람만 다시 예약.
// - 날씨조정 끔(또는 도시 미설정): 주간 반복 예약 (요일 규약: 우리 0=일…6=토 → 폰 1=일…7=토, +1)
// - 날씨조정 켬: "다음 1회분"을 날짜 지정으로 예약 — 비/눈 예보면 N분 일찍.
//   * 안전선: 날씨 조회가 실패하면 조정 없이 원래 시각으로 예약한다 (알람은 절대 놓치지 않는다)
//   * 다음 회차는 앱을 열 때/알람을 바꿀 때/울림을 끌 때마다 다시 계산해 예약한다
async function doRescheduleAll(
  alarms: Alarm[],
  coords: Coords,
  handledUntil: Record<string, number>
): Promise<AdjustInfo> {
  // 1) 날씨 판정을 먼저 끝낸다 (취소→예약 사이 빈틈을 짧게 유지하려고 조회를 앞단에 몬다)
  const now = new Date();
  const plans: Array<{
    alarm: Alarm;
    mode: "weekly" | "once";
    base?: Date;
    fireAt?: Date;
    adjusted?: boolean;
  }> = [];
  const adjustInfo: AdjustInfo = {};

  // 조정 알람의 "다음 회차" 기준점: 이미 울려서 처리한 회차(handledUntil)는 건너뛴다 —
  // 일찍 울려 껐는데 '오늘 원래 시각'을 또 예약해 같은 아침 두 번 울리는 사고 방지.
  const fromFor = (alarm: Alarm, at: Date) =>
    new Date(Math.max(at.getTime(), handledUntil[alarm.id] ?? 0));

  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    if (!alarm.weatherAdjust || coords === null) {
      plans.push({ alarm, mode: "weekly" });
      continue;
    }
    const base = nextOccurrence(alarm, fromFor(alarm, now));
    let adjusted = false;
    try {
      adjusted = await isBadWeatherAt(coords.lat, coords.lon, base);
    } catch {
      adjusted = false; // 안전선: 조회 실패 → 조정 없음, 원래 시각
    }
    let fireAt = base;
    if (adjusted) {
      fireAt = new Date(base.getTime() - alarm.adjustMinutes * 60_000);
      // 당긴 시각이 이미 지났으면(방금 직전 알람 등) 원래 시각으로 되돌린다
      if (fireAt.getTime() <= now.getTime()) {
        fireAt = base;
        adjusted = false;
      }
    }
    adjustInfo[alarm.id] = adjusted;
    plans.push({ alarm, mode: "once", base, fireAt, adjusted });
  }

  // 2) 장부 갈아끼우기
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const plan of plans) {
    const { alarm } = plan;
    const channelId = alarm.vibrate ? "alarm" : "alarm-quiet";
    if (plan.mode === "weekly") {
      await scheduleWeekly(alarm, channelId);
      continue;
    }
    if (!plan.base || !plan.fireAt) continue;
    // 안전선: 위의 날씨 조회에 시간이 걸렸다면 fireAt이 그 사이 지났을 수 있다.
    // 과거 시각 예약은 OS가 "조용히 버려서" 알람이 사라지므로, 예약 직전에 다시 확인하고
    // 지났으면 그다음 회차를 조정 없이 잡는다 (알람은 절대 놓치지 않는다).
    const now2 = new Date();
    let { base, fireAt } = plan;
    let adjusted = plan.adjusted === true;
    if (fireAt.getTime() <= now2.getTime()) {
      base = nextOccurrence(alarm, fromFor(alarm, now2));
      fireAt = base;
      adjusted = false;
      adjustInfo[alarm.id] = false;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: alarm.label ? alarm.label : "알람",
        body: adjusted
          ? `비/눈 예보로 ${alarm.adjustMinutes}분 일찍 울렸어요`
          : `${formatTime12(alarm.hour, alarm.minute)} 알람이에요`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        // 꼬리표: 어느 알람인지 / 일찍 당겨졌는지 / 이 회차의 원래 시각(두 번 울림 방지용)
        data: { alarmId: alarm.id, adjusted, baseTime: base.getTime() },
      },
      trigger: { channelId, date: fireAt },
    });
  }
  return adjustInfo;
}

// 주간 반복 예약 (날씨조정 꺼진 알람용)
async function scheduleWeekly(alarm: Alarm, channelId: string): Promise<void> {
  for (const day of alarm.repeatDays) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: alarm.label ? alarm.label : "알람",
        body: `${formatTime12(alarm.hour, alarm.minute)} 알람이에요`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { alarmId: alarm.id, adjusted: false },
      },
      trigger: {
        channelId,
        weekday: day + 1,
        hour: alarm.hour,
        minute: alarm.minute,
        repeats: true,
      },
    });
  }
}

// 알림이 울리거나(앱이 켜져 있을 때) 사용자가 알림을 누르면(백그라운드에서) 콜백을 부른다.
// 콜백에 알람 id와 "일찍 당겨진 알람인지"를 넘겨 App이 울림 화면을 띄운다. 반환값은 리스너 해제 함수.
export function addRingListeners(
  onRing: (alarmId: string | null, adjusted: boolean, baseTime: number | null) => void
): () => void {
  if (isWeb) return () => {};
  const handle = (data: Record<string, unknown> | undefined) => {
    const id = data?.alarmId;
    const baseTime = data?.baseTime;
    onRing(
      typeof id === "string" ? id : null,
      data?.adjusted === true,
      typeof baseTime === "number" ? baseTime : null
    );
  };
  const received = Notifications.addNotificationReceivedListener((n) => {
    handle(n.request.content.data);
  });
  const responded = Notifications.addNotificationResponseReceivedListener((r) => {
    handle(r.notification.request.content.data);
  });
  return () => {
    received.remove();
    responded.remove();
  };
}

// 알림함(트레이)에 이미 뜬 알림을 지운다.
// 울림 화면을 띄우거나 끌 때 호출 — 남은 알림을 눌러 끈 알람이 다시 울리는 것을 막는다.
export function clearDeliveredNotifications(): void {
  if (isWeb) return;
  Notifications.dismissAllNotificationsAsync().catch(() => {});
}
