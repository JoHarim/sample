// 스마트 알람 - 블럭 1 / 스텝 1-1: 알람 목록(홈) 화면 뼈대
// 이 파일이 하는 일: 앱을 열면 "내 알람" 목록 화면을 보여준다.
//   지금은 알람이 하나도 없으므로 "첫 알람을 만들어 보세요" 빈 화면이 뜬다.
//   + 버튼은 다음 스텝(1-2, 알람 추가 화면)에서 실제 화면으로 연결한다.
// 명세: docs/plan/screens/S1-목록.md

import { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
} from "react-native";

// 알람 한 개의 생김새(나중에 폰 저장소와 연결). 지금은 목록이 비어 있다.
type Alarm = {
  id: string;
  label?: string;
  time: string; // "06:45"
  repeatDays: number[]; // 0=일 ... 6=토
  enabled: boolean;
  weatherAdjust: boolean;
};

export default function App() {
  // 알람 목록. 아직 저장 기능이 없어 빈 배열로 시작 → 빈 화면이 뜬다.
  const [alarms] = useState<Alarm[]>([]);

  // + 버튼을 눌렀을 때. 다음 스텝에서 진짜 "알람 추가 화면"으로 바꾼다.
  const handleAdd = () => {
    Alert.alert("알람 추가", "곧 여기서 알람 추가 화면을 만들어요 (스텝 1-2).");
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* 상단 바: 화면 제목. (도시·오늘 날씨 줄은 블럭 3에서 얹는다) */}
      <View style={styles.header}>
        <Text style={styles.title}>내 알람</Text>
      </View>

      {alarms.length === 0 ? (
        // 빈 상태: 알람이 하나도 없을 때
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>아직 만든 알람이 없어요</Text>
          <Text style={styles.emptyHint}>첫 알람을 만들어 보세요</Text>
          <Pressable style={styles.emptyButton} onPress={handleAdd}>
            <Text style={styles.emptyButtonText}>+ 첫 알람 만들기</Text>
          </Pressable>
        </View>
      ) : (
        // 알람이 있을 때: 목록 (다음 스텝에서 카드 모양을 채운다)
        <FlatList
          data={alarms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTime}>{item.time}</Text>
              {item.label ? <Text style={styles.cardLabel}>{item.label}</Text> : null}
            </View>
          )}
        />
      )}

      {/* 오른쪽 아래 + 버튼: 알람 추가 (목록이 있을 때도 항상 보이게) */}
      <Pressable style={styles.fab} onPress={handleAdd}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1115" },
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
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#171b22",
  },
  cardTime: { color: "#fff", fontSize: 28, fontWeight: "800" },
  cardLabel: { color: "#8a8f98", fontSize: 13, marginTop: 4 },
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
