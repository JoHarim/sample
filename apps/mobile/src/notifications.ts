// 알림(알람 울리기) 담당 (블럭 1 / 스텝 1-4)
// 폰의 알림 시스템에 "매주 이 요일 이 시각에 소리·진동 알림을 울려라"라고 예약한다.
// 웹(노트북 미리보기)엔 폰 알림이 없으므로 모든 함수가 조용히 건너뛴다.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { Alarm, formatTime12 } from "./types";

const isWeb = Platform.OS === "web";

// 앱이 화면에 떠 있는 동안에도 알림이 소리와 함께 보이게 한다.
// (기본값은 "앱 사용 중엔 조용히"라서, 알람앱에는 맞지 않는다)
if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
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

// 재예약 줄세우기: 재예약이 겹쳐 돌면 "취소↔예약"이 뒤엉켜 끈 알람이 남을 수 있다.
// 요청을 한 줄로 세우고, 더 새 목록이 대기 중이면 낡은 요청은 건너뛴다(최신 목록만 반영).
let queue: Promise<void> = Promise.resolve();
let latestCallId = 0;

export function rescheduleAll(alarms: Alarm[]): Promise<void> {
  if (isWeb) return Promise.resolve();
  const callId = ++latestCallId;
  const run = queue.then(async () => {
    if (callId !== latestCallId) return; // 이 사이 더 새 요청이 들어옴 → 이건 낡아서 건너뜀
    await doRescheduleAll(alarms);
  });
  queue = run.catch(() => {});
  return run;
}

// 예약 장부를 통째로 갈아끼운다: 기존 예약 전부 취소 → 켜진 알람만 다시 예약.
// (알람 수가 적어 이 방식이 가장 단순하고, 위의 줄세우기가 장부 어긋남을 막는다)
// 요일 규약: 우리 저장은 0=일…6=토, 폰 알림 시스템은 1=일…7=토 → +1 해서 넘긴다.
async function doRescheduleAll(alarms: Alarm[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    for (const day of alarm.repeatDays) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: alarm.label ? alarm.label : "알람",
          body: `${formatTime12(alarm.hour, alarm.minute)} 알람이에요`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          channelId: alarm.vibrate ? "alarm" : "alarm-quiet",
          weekday: day + 1,
          hour: alarm.hour,
          minute: alarm.minute,
          repeats: true,
        },
      });
    }
  }
}
