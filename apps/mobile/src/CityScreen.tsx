// 도시 설정 화면 (블럭 3 / 스텝 3-1) — 날씨 조회에 쓸 "어디" 를 정한다.
// 도시 이름을 입력하면 날씨 서비스(OpenWeatherMap)에서 실제 있는 도시인지 확인하고 저장한다.
// 명세: docs/plan/screens/S0-온보딩.md 의 도시 설정 부분 (별도 온보딩 화면 대신 여기서 담당)
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Settings } from "./storage";
import { geocodeCity, getWeatherApiKey } from "./weather";

type Props = {
  initialCity: string | null;
  onSaved: (settings: Settings) => void;
  onCancel: () => void;
};

export default function CityScreen({ initialCity, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initialCity ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasKey = getWeatherApiKey() !== null;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("도시 이름을 입력해 주세요");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const hit = await geocodeCity(trimmed);
      if (hit === null) {
        setError("도시를 못 찾았어요 — 이름을 확인하고 다시 시도해 주세요");
        return;
      }
      onSaved({ city: hit.city, lat: hit.lat, lon: hit.lon });
    } catch {
      setError(
        hasKey
          ? "확인에 실패했어요 — 인터넷 연결을 확인하고 다시 시도해 주세요"
          : "날씨 키가 아직 없어요 — apps/mobile/.env 에 키를 넣어야 확인할 수 있어요"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.headerBtn}>취소</Text>
        </Pressable>
        <Text style={styles.title}>도시 설정</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <Text style={styles.hint}>
          날씨를 확인할 도시를 정해주세요.{"\n"}비/눈 예보면 알람이 더 일찍 울려요.
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="예: 서울, Busan"
          placeholderTextColor="#5b616b"
          style={styles.input}
          autoFocus
          editable={!busy}
          onSubmitEditing={handleSave}
        />
        {!hasKey ? (
          <Text style={styles.warn}>
            날씨 키(EXPO_PUBLIC_OPENWEATHER_API_KEY)가 아직 없어요 — 키를 넣기 전까지 날씨
            기능은 꺼진 채로 동작해요 (알람은 정상)
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.saveButton, busy && styles.dim]} onPress={handleSave} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>확인하고 저장</Text>
          )}
        </Pressable>
      </View>
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
  headerSpacer: { width: 32 },
  body: { padding: 20, gap: 16 },
  hint: { color: "#8a8f98", fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: "#171b22",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  warn: { color: "#eab308", fontSize: 12, lineHeight: 17 },
  error: { color: "#f87171", fontSize: 13 },
  saveButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  dim: { opacity: 0.6 },
});
