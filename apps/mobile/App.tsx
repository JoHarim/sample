// 스마트 알람 - 블럭 1: 화면 전환의 중심.
// 이 파일이 하는 일: 지금 어떤 화면(목록 / 추가)을 보여줄지 정하고,
//   알람 목록 데이터를 들고 있으면서 두 화면에 나눠준다.
//   (아직 폰에 영구 저장은 안 함 = 다음 스텝 1-3. 지금은 앱이 켜져 있는 동안만 기억한다.)
import { useState } from "react";
import { SafeAreaView, StatusBar, Platform, StyleSheet } from "react-native";
import { Alarm } from "./src/types";
import AlarmListScreen from "./src/AlarmListScreen";
import AddAlarmScreen from "./src/AddAlarmScreen";

type Screen = "list" | "add";

export default function App() {
  const [screen, setScreen] = useState<Screen>("list");
  const [alarms, setAlarms] = useState<Alarm[]>([]);

  // 추가 화면에서 저장 → 목록에 새 알람을 더하고 목록으로 돌아온다
  const handleSave = (alarm: Alarm) => {
    setAlarms((prev) => [...prev, alarm]);
    setScreen("list");
  };

  // 목록의 스위치로 알람 켜기/끄기
  const handleToggle = (id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  return (
    // 아이폰: SafeAreaView가 노치/홈바 여백 처리. 안드로이드: SafeAreaView가 무시되므로
    // 상태바 높이만큼 위 여백을 직접 넣어 제목·버튼이 상태바에 가리지 않게 한다.
    <SafeAreaView
      style={[
        styles.screen,
        Platform.OS === "android" ? { paddingTop: StatusBar.currentHeight ?? 0 } : null,
      ]}
    >
      {screen === "list" ? (
        <AlarmListScreen
          alarms={alarms}
          onAdd={() => setScreen("add")}
          onToggle={handleToggle}
        />
      ) : (
        <AddAlarmScreen onSave={handleSave} onCancel={() => setScreen("list")} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1115" },
});
