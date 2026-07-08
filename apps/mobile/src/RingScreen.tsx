// S3. 알람 울림 — 알람이 울릴 때 뜨는 전용 화면. 밀어서 끝까지 밀어야 꺼진다(스누즈 없음).
// 화면이 떠 있는 동안 소리(반복)와 진동이 난다. 명세: docs/plan/screens/S3-울림.md
import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Animated,
  PanResponder,
  Vibration,
  Platform,
  StyleSheet,
} from "react-native";
import { Audio } from "expo-av";
import { Alarm, formatTime12 } from "./types";

type Props = {
  alarm: Alarm;
  onDismiss: () => void;
};

const THUMB = 64; // 미는 손잡이 크기
const PAD = 6; // 트랙 안쪽 여백

export default function RingScreen({ alarm, onDismiss }: Props) {
  // 소리(반복) + 진동: 화면이 떠 있는 동안만. 나갈 때 반드시 멈춘다.
  useEffect(() => {
    let sound: Audio.Sound | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS !== "web") {
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        }
        const created = await Audio.Sound.createAsync(
          require("../assets/alarm.wav"),
          { isLooping: true, volume: 1.0 }
        );
        if (cancelled) {
          await created.sound.unloadAsync();
          return;
        }
        sound = created.sound;
        await sound.playAsync();
      } catch {
        // 소리 못 틀어도(웹 등) 화면·진동·끄기는 정상 동작
      }
    })();

    if (alarm.vibrate && Platform.OS !== "web") {
      // 진동 패턴 반복 ([대기, 진동, 대기, 진동, ...])
      Vibration.vibrate([0, 600, 400, 600, 1000], true);
    }

    return () => {
      cancelled = true;
      Vibration.cancel();
      if (sound) sound.unloadAsync().catch(() => {});
    };
  }, [alarm.vibrate]);

  // 밀어서 끄기 슬라이더
  const maxXRef = useRef(0); // 손잡이가 갈 수 있는 최대 거리(오른쪽 끝)
  const x = useRef(new Animated.Value(0)).current;
  const xVal = useRef(0);

  useEffect(() => {
    const id = x.addListener(({ value }) => {
      xVal.current = value;
    });
    return () => x.removeListener(id);
  }, [x]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => {
        const nx = Math.max(0, Math.min(maxXRef.current, g.dx));
        x.setValue(nx);
      },
      onPanResponderRelease: () => {
        const max = maxXRef.current;
        // 90% 이상 밀었으면 끝까지 채우고 끈다, 아니면 처음으로 되돌린다
        if (max > 0 && xVal.current >= max * 0.9) {
          Animated.timing(x, { toValue: max, duration: 100, useNativeDriver: false }).start(
            () => onDismiss()
          );
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.time}>{formatTime12(alarm.hour, alarm.minute)}</Text>
        {alarm.label ? <Text style={styles.label}>{alarm.label}</Text> : null}
        {alarm.weatherAdjust ? (
          <Text style={styles.weather}>🌦 날씨 조정 알람</Text>
        ) : null}
      </View>

      <View
        style={styles.track}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          maxXRef.current = Math.max(0, w - THUMB - PAD * 2);
        }}
      >
        <Text style={styles.trackHint}>밀어서 끄기 →</Text>
        <Animated.View
          style={[styles.thumb, { transform: [{ translateX: x }] }]}
          {...pan.panHandlers}
        >
          <Text style={styles.thumbText}>›</Text>
        </Animated.View>
      </View>
      <Text style={styles.note}>끝까지 밀어야 꺼져요 · 스누즈 없음</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0d12",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 80,
  },
  top: { alignItems: "center", flex: 1, justifyContent: "center", gap: 12 },
  time: { color: "#fff", fontSize: 72, fontWeight: "900" },
  label: { color: "#cbd5e1", fontSize: 20 },
  weather: { color: "#8a8f98", fontSize: 14 },
  track: {
    width: "82%",
    height: THUMB + PAD * 2,
    borderRadius: (THUMB + PAD * 2) / 2,
    backgroundColor: "#171b22",
    justifyContent: "center",
    paddingHorizontal: PAD,
  },
  trackHint: {
    position: "absolute",
    alignSelf: "center",
    color: "#5b616b",
    fontSize: 15,
    fontWeight: "700",
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbText: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: -4 },
  note: { color: "#5b616b", fontSize: 13 },
});
