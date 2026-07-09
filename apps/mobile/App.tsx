// 스마트 알람 - 블럭 1: 화면 전환의 중심.
// 이 파일이 하는 일: 지금 어떤 화면(목록 / 추가)을 보여줄지 정하고,
//   알람 목록 데이터를 들고 있으면서 두 화면에 나눠준다.
//   스텝 1-3: 알람을 폰에 저장 — 켤 때 읽어오고, "사용자가 바꾼 순간에만" 저장한다.
//   (바뀔 때마다 자동 저장하지 않는 이유: 켜자마자 읽기 실패분이 도로 저장돼
//    멀쩡한 알람을 지우는 사고를 원천 차단 — 저장은 항상 사용자 행동의 결과여야 한다.)
import { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  AppState,
  View,
  Text,
  Pressable,
  Linking,
  StyleSheet,
} from "react-native";
import { Alarm } from "./src/types";
import { loadAlarms, saveAlarms, loadSettings, saveSettings, Settings } from "./src/storage";
import {
  setupNotifications,
  ensurePermission,
  checkPermission,
  rescheduleAll,
  addRingListeners,
  clearDeliveredNotifications,
  AdjustInfo,
} from "./src/notifications";
import { fetchWeatherLine } from "./src/weather";
import AlarmListScreen from "./src/AlarmListScreen";
import AddAlarmScreen from "./src/AddAlarmScreen";
import RingScreen from "./src/RingScreen";
import CityScreen from "./src/CityScreen";

type Screen = "list" | "form" | "city";

export default function App() {
  const [screen, setScreen] = useState<Screen>("list");
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  // 편집 대상 알람. null이면 "새 알람 추가" 모드.
  const [editing, setEditing] = useState<Alarm | null>(null);
  // 읽기 상태: loading(읽는 중) / ready(성공) / error(읽기 실패 — 저장 금지 유지)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  // 화면에 반영된 최신 목록. 저장 실패 알림이 "이미 낡은 실패"인지 판별하는 기준.
  const latestRef = useRef<Alarm[]>([]);
  // 읽기 완료 여부 ("다시 화면에 올 때" 처리에서 너무 이른 재예약을 막는 용도)
  const readyRef = useRef(false);
  // 알림 권한이 거부돼 알람이 못 울리는 상태인지 (목록 상단 경고 배너용)
  const [permissionWarning, setPermissionWarning] = useState(false);
  // 지금 울리고 있는 알람. null이 아니면 울림 화면(S3)이 모든 화면 위에 뜬다.
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  // 지금 울리는 알람이 "비/눈 예보로 일찍 당겨진" 회차인지 (울림 화면 안내용)
  const [ringingAdjusted, setRingingAdjusted] = useState(false);
  // 날씨 설정(도시). null이면 날씨 기능 꺼짐 (알람은 정상 동작)
  const [settings, setSettings] = useState<Settings | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  // 목록 상단 "오늘 날씨 한 줄"과 그 상태 (S1 예외: 확인 중/실패도 구분해 보여준다)
  const [weatherLine, setWeatherLine] = useState<string | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<"idle" | "loading" | "ok" | "failed">(
    "idle"
  );
  // 이번 회차가 예보로 당겨진 알람들 (목록 카드 표시용)
  const [adjustedIds, setAdjustedIds] = useState<AdjustInfo>({});
  // 이미 울려서 처리한 회차 (알람 id → 그 회차의 원래 시각) — 같은 아침 두 번 울림 방지
  const handledRef = useRef<Record<string, number>>({});

  // 예약 갱신: 현재 도시 좌표로 날씨를 보고 예약 장부를 다시 쓴다. 결과(당겨진 알람들)는 화면에 반영.
  const refreshSchedule = (list: Alarm[]) => {
    const s = settingsRef.current;
    rescheduleAll(list, s ? { lat: s.lat, lon: s.lon } : null, handledRef.current)
      .then((info) => {
        if (info !== null) setAdjustedIds(info);
      })
      .catch(() => {});
  };

  // 목록 상단 날씨 한 줄 갱신. 그 사이 도시가 바뀌었으면(낡은 응답) 버린다.
  const refreshWeatherLine = (s: Settings | null) => {
    if (s === null) {
      setWeatherLine(null);
      setWeatherStatus("idle");
      return;
    }
    const isStale = () => {
      const cur = settingsRef.current;
      return cur === null || cur.lat !== s.lat || cur.lon !== s.lon;
    };
    setWeatherStatus("loading");
    fetchWeatherLine(s.lat, s.lon)
      .then((line) => {
        if (isStale()) return;
        setWeatherLine(line);
        setWeatherStatus(line === null ? "idle" : "ok"); // null = 키 없음(기능 꺼짐)
      })
      .catch(() => {
        if (isStale()) return;
        setWeatherLine(null);
        setWeatherStatus("failed");
      });
  };

  // 앱 시작: 폰에 저장된 알람을 읽어온다. 실패하면 ready로 두지 않는다 —
  // 그래야 "못 읽은 빈 목록"이 저장으로 이어지는 길이 아예 없다.
  const load = () => {
    setLoadState("loading");
    Promise.all([loadAlarms(), loadSettings()])
      .then(([stored, st]) => {
        setAlarms(stored);
        latestRef.current = stored;
        setSettings(st);
        settingsRef.current = st;
        readyRef.current = true;
        setLoadState("ready");
        void initNotifications(stored);
        refreshWeatherLine(st);
      })
      .catch(() => setLoadState("error"));
  };
  useEffect(load, []);

  // 앱이 백그라운드에 갔다가 다시 화면에 오면(설정 갔다 오기 등) 권한을 다시 확인한다.
  // 이게 없으면: 거부 → 배너 탭 → 설정에서 허용 → 돌아와도 배너가 그대로고 예약도 안 걸린다.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !readyRef.current) return;
      // 예보는 시시각각 바뀌므로, 화면에 돌아올 때마다 날씨 줄과 예약을 갱신한다
      refreshWeatherLine(settingsRef.current);
      void checkPermission().then((perm) => {
        if (perm === "unavailable") return;
        setPermissionWarning(perm === "denied");
        if (perm === "granted") refreshSchedule(latestRef.current);
      });
    });
    return () => sub.remove();
  }, []);

  // 알림이 울리거나(앱 켜져 있을 때) 사용자가 알림을 누르면 → 그 알람의 울림 화면을 띄운다.
  useEffect(() => {
    const unsub = addRingListeners((alarmId, adjusted, baseTime) => {
      if (alarmId === null) return;
      const a = latestRef.current.find((x) => x.id === alarmId);
      if (a) {
        setRingingAlarm(a);
        setRingingAdjusted(adjusted);
        // 이 회차는 처리됨으로 기록 — 일찍 울려 껐을 때 원래 시각으로 또 울리는 것을 막는다
        if (baseTime !== null) handledRef.current[alarmId] = baseTime;
        // 트레이에 남은 알림을 지워, 끈 뒤 그 알림을 눌러 다시 울리는 것을 막는다.
        clearDeliveredNotifications();
      }
    });
    return unsub;
  }, []);

  // 알림 준비: 채널 만들기 → 권한 확인(필요하면 요청) → 예약 장부 복구.
  // 시작할 때마다 재예약하는 이유: 폰 재부팅 등으로 예약이 사라졌을 수 있어서.
  const initNotifications = async (list: Alarm[]) => {
    try {
      await setupNotifications();
      const perm = await ensurePermission();
      setPermissionWarning(perm === "denied");
      if (perm === "granted") refreshSchedule(list);
    } catch {
      // 알림 준비 실패가 앱 자체를 막으면 안 된다 — 알람 목록은 정상 동작
    }
  };

  // 사용자가 바꾼 목록(next)을 화면에 반영하고 폰에 저장한다.
  // 저장 실패 시: 다시 시도 / 되돌리기(prev로 원상복구 — S1 예외 명세) 중 고르게 한다.
  const applyChange = (next: Alarm[], prev: Alarm[]) => {
    setAlarms(next);
    latestRef.current = next;
    saveAlarms(next)
      .then(() => refreshSchedule(next))
      .catch(() => {
      // 이 실패가 이미 낡은 것이면(그 사이 사용자가 또 바꿈) 조용히 무시 —
      // 최신 변경의 저장이 자기 성공/실패를 따로 처리하므로, 여기서 되살리면 오히려 최신 변경을 덮어쓴다.
      if (latestRef.current !== next) return;
      Alert.alert("저장하지 못했어요", "알람 변경이 폰에 저장되지 않았어요.", [
        { text: "다시 시도", onPress: () => applyChange(next, prev) },
        {
          text: "되돌리기",
          style: "cancel",
          onPress: () => {
            setAlarms(prev);
            latestRef.current = prev;
          },
        },
      ]);
    });
  };

  // 폼에서 저장 → 편집이면 그 알람을 교체, 추가면 목록에 더하고 목록으로 돌아온다
  const handleSave = (alarm: Alarm) => {
    const next = editing
      ? alarms.map((a) => (a.id === alarm.id ? alarm : a))
      : [...alarms, alarm];
    applyChange(next, alarms);
    setScreen("list");
  };

  // 편집 화면의 삭제 버튼 → 진짜 삭제하고 목록으로
  const handleDelete = (id: string) => {
    applyChange(
      alarms.filter((a) => a.id !== id),
      alarms
    );
    setScreen("list");
  };

  // 목록의 스위치로 알람 켜기/끄기
  const handleToggle = (id: string) => {
    applyChange(
      alarms.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
      alarms
    );
  };

  // 알람이 울리는 중이면 다른 모든 화면 위에 울림 화면을 띄운다.
  if (ringingAlarm) {
    return (
      <RingScreen
        alarm={ringingAlarm}
        adjusted={ringingAdjusted}
        onDismiss={() => {
          clearDeliveredNotifications(); // 끌 때도 한 번 더 트레이 정리(안전)
          setRingingAlarm(null);
          setRingingAdjusted(false);
          // 날씨조정 알람은 "다음 1회분"만 예약돼 있으므로, 끈 직후 다음 회차를 다시 예약한다
          refreshSchedule(latestRef.current);
        }}
      />
    );
  }

  return (
    // 아이폰: SafeAreaView가 노치/홈바 여백 처리. 안드로이드: SafeAreaView가 무시되므로
    // 상태바 높이만큼 위 여백을 직접 넣어 제목·버튼이 상태바에 가리지 않게 한다.
    <SafeAreaView
      style={[
        styles.screen,
        Platform.OS === "android" ? { paddingTop: StatusBar.currentHeight ?? 0 } : null,
      ]}
    >
      {loadState === "loading" ? (
        // 읽어오는 중 (로컬이라 순간이지만, 빈 화면이 번쩍이는 것을 막는다)
        <View style={styles.center}>
          <ActivityIndicator color="#3b82f6" />
        </View>
      ) : loadState === "error" ? (
        // 읽기 실패: 알람을 못 불러온 상태로 진행하면 저장 사고로 이어지므로 여기서 멈추고 재시도
        <View style={styles.center}>
          <Text style={styles.errorTitle}>알람을 불러오지 못했어요</Text>
          <Text style={styles.errorHint}>저장된 알람을 읽는 데 실패했어요</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : screen === "city" ? (
        <CityScreen
          initialCity={settings ? settings.city : null}
          onCancel={() => setScreen("list")}
          onSaved={(st) => {
            setSettings(st);
            settingsRef.current = st;
            setScreen("list");
            refreshWeatherLine(st);
            refreshSchedule(latestRef.current);
            // 설정 저장 실패는 치명적이지 않지만(다시 고르면 됨) 알림은 준다
            saveSettings(st).catch(() => {
              Alert.alert("도시를 저장하지 못했어요", "앱을 껐다 켜면 다시 설정해야 할 수 있어요.");
            });
          }}
        />
      ) : screen === "list" ? (
        <AlarmListScreen
          alarms={alarms}
          onAdd={() => {
            setEditing(null);
            setScreen("form");
          }}
          onEdit={(alarm) => {
            setEditing(alarm);
            setScreen("form");
          }}
          onToggle={handleToggle}
          permissionWarning={permissionWarning}
          onOpenSettings={() => {
            Linking.openSettings().catch(() => {});
          }}
          city={settings ? settings.city : null}
          weatherLine={weatherLine}
          weatherStatus={weatherStatus}
          onCityPress={() => setScreen("city")}
          adjustedIds={adjustedIds}
          // 개발 모드 전용: 울림 화면을 바로 열어 시험 (첫 알람이 있으면 그걸로, 없으면 견본으로)
          onDevRing={
            __DEV__
              ? () =>
                  setRingingAlarm(
                    alarms[0] ?? {
                      id: "dev-preview",
                      label: "미리보기 알람",
                      hour: 7,
                      minute: 0,
                      repeatDays: [1, 2, 3, 4, 5],
                      enabled: true,
                      weatherAdjust: false,
                      adjustMinutes: 15,
                      vibrate: true,
                    }
                  )
              : undefined
          }
        />
      ) : (
        <AddAlarmScreen
          // key: 편집 대상이 바뀔 때 폼을 새로 그려 이전 입력이 남지 않게 한다
          key={editing ? editing.id : "new"}
          initial={editing ?? undefined}
          onSave={handleSave}
          onCancel={() => setScreen("list")}
          onDelete={handleDelete}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1115" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorTitle: { color: "#e6e6e6", fontSize: 18, fontWeight: "700" },
  errorHint: { color: "#8a8f98", fontSize: 14, marginBottom: 16 },
  retryButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
