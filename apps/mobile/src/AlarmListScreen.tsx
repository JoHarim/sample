// S1. 알람 목록(홈) — 내 알람을 보고, 켜고 끄고, 카드를 탭해 고치고, + 로 추가한다.
// 명세: docs/plan/screens/S1-목록.md
import { View, Text, FlatList, Pressable, Switch, StyleSheet } from "react-native";
import { Alarm, formatTime12, formatRepeat } from "./types";

type Props = {
  alarms: Alarm[];
  onAdd: () => void; // + 버튼 → 추가 화면
  onEdit: (alarm: Alarm) => void; // 카드 탭 → 편집 화면
  onToggle: (id: string) => void; // 켜기/끄기 스위치
  permissionWarning: boolean; // 알림 권한 거부 상태(경고 배너 표시)
  onOpenSettings: () => void; // 배너 탭 → 폰 설정 열기
  city: string | null; // 설정된 도시 (없으면 null)
  weatherLine: string | null; // 오늘 날씨 한 줄 (예: "흐림 3°")
  weatherStatus: "idle" | "loading" | "ok" | "failed"; // idle=키 없음(표시 생략)
  onCityPress: () => void; // 도시 줄 탭 → 도시 설정 화면
  adjustedIds: Record<string, boolean>; // 이번 회차가 비/눈 예보로 당겨진 알람들
  onDevRing?: () => void; // 개발 모드 전용: 울림 화면 미리보기
};

export default function AlarmListScreen({
  alarms,
  onAdd,
  onEdit,
  onToggle,
  permissionWarning,
  onOpenSettings,
  city,
  weatherLine,
  weatherStatus,
  onCityPress,
  adjustedIds,
  onDevRing,
}: Props) {
  // 도시 줄 문구: 확인 중/실패/성공을 구분해 보여준다 (S1 예외 명세)
  const weatherPart =
    weatherStatus === "loading"
      ? " · 날씨 확인 중"
      : weatherStatus === "failed"
        ? " · 날씨 정보를 못 불러왔어요 (알람은 원래 시각으로 울려요)"
        : weatherStatus === "ok" && weatherLine
          ? ` · ${weatherLine}`
          : "";
  return (
    <View style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.header}>
        <Text style={styles.title}>내 알람</Text>
        {/* 개발 모드에서만: 울림 화면을 바로 열어 밀어서 끄기를 시험한다 (배포판엔 없음) */}
        {onDevRing ? (
          <Pressable onPress={onDevRing} hitSlop={8}>
            <Text style={styles.devRing}>울림 미리보기</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 도시·오늘 날씨 줄 (탭하면 도시 변경) — 확인 중/실패 상태까지 표시 (S1 예외 명세) */}
      <Pressable style={styles.cityRow} onPress={onCityPress}>
        <Text style={styles.cityText}>
          {city === null
            ? "📍 도시 설정하기 — 비/눈 오는 날 더 일찍 깨워드려요"
            : `📍 ${city}${weatherPart}`}
        </Text>
      </Pressable>

      {/* 예외(S1): 알림 권한이 꺼져 있으면 알람이 안 울린다 — 경고하고 설정으로 안내 */}
      {permissionWarning && (
        <Pressable style={styles.warnBanner} onPress={onOpenSettings}>
          <Text style={styles.warnText}>
            지금은 알람이 안 울려요 — 알림 권한이 꺼져 있어요. 눌러서 설정 열기
          </Text>
        </Pressable>
      )}

      {alarms.length === 0 ? (
        // 빈 상태: 알람이 하나도 없을 때
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>아직 만든 알람이 없어요</Text>
          <Text style={styles.emptyHint}>첫 알람을 만들어 보세요</Text>
          <Pressable style={styles.emptyButton} onPress={onAdd}>
            <Text style={styles.emptyButtonText}>+ 첫 알람 만들기</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          // 명세(S1): 목록은 시간순. 원본을 건드리지 않게 복사본을 정렬해 넘긴다.
          data={[...alarms].sort(
            (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
          )}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* 카드 본문을 탭하면 편집으로 (스위치는 따로 눌리게 분리) */}
              <Pressable style={styles.cardMain} onPress={() => onEdit(item)}>
                <Text style={[styles.cardTime, !item.enabled && styles.dim]}>
                  {formatTime12(item.hour, item.minute)}
                </Text>
                <Text style={[styles.cardSub, !item.enabled && styles.dim]}>
                  {item.label ? `${item.label} · ` : ""}
                  {formatRepeat(item.repeatDays)}
                  {" · "}
                  {item.vibrate ? "소리·진동" : "소리만"}
                  {item.weatherAdjust
                    ? adjustedIds[item.id] === true
                      ? `  ·  🌧 비/눈 예보 · ${item.adjustMinutes}분 일찍 울려요`
                      : `  ·  🌦 ${item.adjustMinutes}분 일찍(예보 시)`
                    : ""}
                </Text>
              </Pressable>
              <Switch value={item.enabled} onValueChange={() => onToggle(item.id)} />
            </View>
          )}
        />
      )}

      {/* 오른쪽 아래 + 버튼 (목록이 있을 때도 항상 보이게) */}
      <Pressable style={styles.fab} onPress={onAdd}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e232b",
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  devRing: { color: "#5b616b", fontSize: 12, fontWeight: "700" },
  cityRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1e232b",
  },
  cityText: { color: "#8a8f98", fontSize: 13, fontWeight: "600" },
  warnBanner: {
    backgroundColor: "#3a1216",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  warnText: { color: "#f87171", fontSize: 13, fontWeight: "700" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { color: "#e6e6e6", fontSize: 18, fontWeight: "700" },
  emptyHint: { color: "#8a8f98", fontSize: 14, marginBottom: 16 },
  emptyButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  // paddingBottom: 오른쪽 아래 + 버튼(bottom 32 + 높이 56)에 마지막 카드가 가려지지 않도록 여백 확보
  listContent: { padding: 16, paddingBottom: 96, gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#171b22",
  },
  cardMain: { flex: 1 },
  cardTime: { color: "#fff", fontSize: 26, fontWeight: "800" },
  cardSub: { color: "#8a8f98", fontSize: 13, marginTop: 4 },
  dim: { opacity: 0.4 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: -2 },
});
