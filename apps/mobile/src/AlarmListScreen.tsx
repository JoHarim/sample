// S1. 알람 목록(홈) — 내 알람을 보고, 켜고 끄고, + 로 추가 화면으로 간다.
// 명세: docs/plan/screens/S1-목록.md
import { View, Text, FlatList, Pressable, Switch, StyleSheet } from "react-native";
import { Alarm, formatTime, formatRepeat } from "./types";

type Props = {
  alarms: Alarm[];
  onAdd: () => void; // + 버튼 → 추가 화면
  onToggle: (id: string) => void; // 켜기/끄기 스위치
};

export default function AlarmListScreen({ alarms, onAdd, onToggle }: Props) {
  return (
    <View style={styles.container}>
      {/* 상단 바 (도시·오늘 날씨 줄은 블럭 3에서 얹는다) */}
      <View style={styles.header}>
        <Text style={styles.title}>내 알람</Text>
      </View>

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
          data={alarms}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardMain}>
                <Text style={[styles.cardTime, !item.enabled && styles.dim]}>
                  {formatTime(item.hour, item.minute)}
                </Text>
                <Text style={[styles.cardSub, !item.enabled && styles.dim]}>
                  {item.label ? `${item.label} · ` : ""}
                  {formatRepeat(item.repeatDays)}
                  {item.weatherAdjust ? `  ·  🌦 ${item.adjustMinutes}분 일찍` : ""}
                </Text>
              </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e232b",
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
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
  cardTime: { color: "#fff", fontSize: 30, fontWeight: "800" },
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
