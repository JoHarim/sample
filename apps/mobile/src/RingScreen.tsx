// S3. 알람 울림 — 알람이 울릴 때 뜨는 전용 화면. 밀어서 끝까지 밀어야 꺼진다(스누즈 없음).
// 화면이 떠 있는 동안 소리(반복)와 진동이 난다. 명세: docs/plan/screens/S3-울림.md
import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Animated,
  PanResponder,
  Pressable,
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

  // onDismiss를 ref로 들고 있어, 제스처 객체(1회 생성)가 항상 최신 함수를 부르게 한다
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // 드래그가 "끝났을 때"(정상 놓음/강제 중단 모두) 공통 처리:
  // 90% 이상 밀었으면 끝까지 채우고 끈다, 아니면 처음으로 되돌린다.
  const finishDrag = () => {
    const max = maxXRef.current;
    if (max > 0 && xVal.current >= max * 0.9) {
      Animated.timing(x, { toValue: max, duration: 100, useNativeDriver: false }).start(() =>
        onDismissRef.current()
      );
    } else {
      Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
    }
  };
  const finishDragRef = useRef(finishDrag);
  finishDragRef.current = finishDrag;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // 브라우저(글자 선택)나 다른 컴포넌트가 제스처를 뺏으려 해도 거절한다
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        const nx = Math.max(0, Math.min(maxXRef.current, g.dx));
        x.setValue(nx);
      },
      onPanResponderRelease: () => finishDragRef.current(),
      // 그래도 제스처가 강제로 끊기면(웹 선택·시스템 제스처) 멈춘 자리에 방치하지 않고 정리한다
      onPanResponderTerminate: () => finishDragRef.current(),
    })
  ).current;

  return (
    <View
      style={[
        styles.container,
        // 웹 전용: 드래그 중 글자 선택이 시작되면 브라우저가 제스처를 끊는다 — 화면 전체에서 선택 금지
        Platform.OS === "web" ? ({ userSelect: "none" } as object) : null,
      ]}
    >
      {/* 개발 모드 전용 비상 닫기 — 웹 미리보기에서 드래그가 안 되거나 슬라이더가 안 보여도
          끌 수 있게 오른쪽 위에 항상 표시. 배포판(__DEV__=false)에선 자동 제외 = 폰 제품은 밀어야만 꺼짐 */}
      {__DEV__ ? (
        <Pressable style={styles.devClose} onPress={() => onDismissRef.current()} hitSlop={12}>
          <Text style={styles.devCloseText}>✕ 닫기(개발용)</Text>
        </Pressable>
      ) : null}

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
        {/* pointerEvents="none": 안내 글자가 드래그를 가로채지 않게 (통과용 View로 감쌈) */}
        <View style={styles.trackHintWrap} pointerEvents="none">
          <Text style={styles.trackHint}>밀어서 끄기 →</Text>
        </View>
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX: x }] },
            // 웹 전용: 브라우저의 글자 선택·터치 스크롤이 드래그에 끼어들지 않게 차단
            Platform.OS === "web"
              ? ({ touchAction: "none", userSelect: "none" } as object)
              : null,
          ]}
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
    // 여백을 줄이고(80→32) 시계 영역이 줄어들 수 있게(minHeight 0) 해서,
    // 낮은 브라우저 창에서도 슬라이더가 화면 밖으로 밀려나지 않게 한다
    paddingVertical: 32,
  },
  devClose: {
    position: "absolute",
    top: 16,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#171b22",
  },
  devCloseText: { color: "#8a8f98", fontSize: 13, fontWeight: "700" },
  top: { alignItems: "center", flex: 1, minHeight: 0, justifyContent: "center", gap: 12 },
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
  trackHintWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  trackHint: {
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
