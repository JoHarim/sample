// S2. 알람 추가 — 시간·요일·라벨·날씨조정을 정해 알람 하나를 만든다.
// 저장을 누르면 부모(App)에게 새 알람을 넘긴다. (폰에 영구 저장은 다음 스텝 1-3)
// 명세: docs/plan/screens/S2-추가편집.md
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { Alarm, WEEKDAY_LABELS, formatTime } from "./types";

type Props = {
  onSave: (alarm: Alarm) => void;
  onCancel: () => void;
};

export default function AddAlarmScreen({ onSave, onCancel }: Props) {
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]); // 기본: 주중
  const [label, setLabel] = useState("");
  const [weatherAdjust, setWeatherAdjust] = useState(false);
  const [adjustMinutes, setAdjustMinutes] = useState(15);
  const [vibrate, setVibrate] = useState(true);

  // 시/분은 끝에서 넘어가면 반대쪽으로 돈다 (23→0, 0→23 / 59→0, 0→59)
  const stepHour = (delta: number) => setHour((h) => (h + delta + 24) % 24);
  const stepMinute = (delta: number) => setMinute((m) => (m + delta + 60) % 60);
  // 날씨 조정 분은 5~60 사이에서 5분 단위로
  const stepAdjust = (delta: number) =>
    setAdjustMinutes((v) => Math.min(60, Math.max(5, v + delta)));

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleSave = () => {
    // 예외(잘못된 입력): 요일을 하나도 안 고르면 저장 막고 안내
    if (days.length === 0) {
      Alert.alert("요일을 골라주세요", "알람이 울릴 요일을 하나 이상 선택해야 해요.");
      return;
    }
    onSave({
      id: String(Date.now()),
      label: label.trim() ? label.trim() : undefined,
      hour,
      minute,
      repeatDays: [...days].sort((a, b) => a - b),
      enabled: true,
      weatherAdjust,
      adjustMinutes,
      vibrate,
    });
  };

  return (
    <View style={styles.container}>
      {/* 상단 바: 취소 · 제목 · 저장 */}
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.headerBtn}>취소</Text>
        </Pressable>
        <Text style={styles.title}>알람 추가</Text>
        <Pressable onPress={handleSave} hitSlop={10}>
          <Text style={[styles.headerBtn, styles.saveBtn]}>저장</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* 시간 */}
        <View style={styles.timeRow}>
          <TimeColumn value={hour} onUp={() => stepHour(1)} onDown={() => stepHour(-1)} />
          <Text style={styles.colon}>:</Text>
          <TimeColumn value={minute} onUp={() => stepMinute(1)} onDown={() => stepMinute(-1)} />
        </View>

        {/* 반복 요일 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>반복 요일</Text>
          <View style={styles.daysRow}>
            {WEEKDAY_LABELS.map((lab, d) => {
              const on = days.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => toggleDay(d)}
                  style={[styles.dayPill, on && styles.dayPillOn]}
                >
                  <Text style={[styles.dayText, on && styles.dayTextOn]}>{lab}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 라벨 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>라벨 (선택)</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="예: 출근 알람"
            placeholderTextColor="#5b616b"
            style={styles.input}
            maxLength={20}
          />
        </View>

        {/* 날씨 조정 */}
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.rowTitle}>날씨 조정</Text>
            <Text style={styles.rowHint}>비/눈 예보면 더 일찍 깨워요</Text>
          </View>
          <Switch value={weatherAdjust} onValueChange={setWeatherAdjust} />
        </View>
        {weatherAdjust && (
          <View style={styles.adjustRow}>
            <Text style={styles.rowTitle}>비/눈이면</Text>
            <Pressable style={styles.stepBtn} onPress={() => stepAdjust(-5)} hitSlop={6}>
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.adjustValue}>{adjustMinutes}분</Text>
            <Pressable style={styles.stepBtn} onPress={() => stepAdjust(5)} hitSlop={6}>
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
            <Text style={styles.rowTitle}>일찍</Text>
          </View>
        )}

        {/* 진동 */}
        <View style={styles.switchRow}>
          <Text style={styles.rowTitle}>진동</Text>
          <Switch value={vibrate} onValueChange={setVibrate} />
        </View>

        {/* 미리보기 */}
        <Text style={styles.preview}>
          {formatTime(hour, minute)} ·{" "}
          {days.length === 0 ? "요일을 골라주세요" : `${days.length}일 반복`}
        </Text>
      </ScrollView>
    </View>
  );
}

// 시(또는 분) 한 칸: ▲ 숫자 ▼
function TimeColumn({
  value,
  onUp,
  onDown,
}: {
  value: number;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <View style={styles.timeCol}>
      <Pressable style={styles.arrow} onPress={onUp} hitSlop={8}>
        <Text style={styles.arrowText}>▲</Text>
      </Pressable>
      <Text style={styles.timeNum}>{String(value).padStart(2, "0")}</Text>
      <Pressable style={styles.arrow} onPress={onDown} hitSlop={8}>
        <Text style={styles.arrowText}>▼</Text>
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
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerBtn: { color: "#8a8f98", fontSize: 16 },
  saveBtn: { color: "#3b82f6", fontWeight: "800" },
  body: { padding: 20, gap: 24 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timeCol: { alignItems: "center", gap: 6 },
  arrow: { padding: 6 },
  arrowText: { color: "#3b82f6", fontSize: 18 },
  timeNum: { color: "#fff", fontSize: 56, fontWeight: "800", width: 84, textAlign: "center" },
  colon: { color: "#fff", fontSize: 48, fontWeight: "800", marginBottom: 6 },
  section: { gap: 10 },
  sectionLabel: { color: "#8a8f98", fontSize: 13, fontWeight: "700" },
  daysRow: { flexDirection: "row", justifyContent: "space-between" },
  dayPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171b22",
  },
  dayPillOn: { backgroundColor: "#3b82f6" },
  dayText: { color: "#8a8f98", fontSize: 14, fontWeight: "700" },
  dayTextOn: { color: "#fff" },
  input: {
    backgroundColor: "#171b22",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchText: { flex: 1 },
  rowTitle: { color: "#e6e6e6", fontSize: 16 },
  rowHint: { color: "#5b616b", fontSize: 12, marginTop: 2 },
  adjustRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#171b22",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: "#3b82f6", fontSize: 20, fontWeight: "800" },
  adjustValue: { color: "#fff", fontSize: 16, fontWeight: "700", minWidth: 48, textAlign: "center" },
  preview: { color: "#5b616b", fontSize: 13, textAlign: "center", marginTop: 8 },
});
