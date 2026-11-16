// First-run intro: a few cards on how Film Log works. Shown once to a new account
// (see app/_layout.tsx) and from Settings → Show intro.
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";
import { INTRO_CARDS, introSeenKey } from "@/utils/intro";

const mono = Platform.OS === "ios" ? "Courier New" : "monospace";

export default function IntroScreen() {
  const router = useRouter();
  const user = useFilmLogStore((st) => st.user);
  const [index, setIndex] = useState(0);
  const card = INTRO_CARDS[index];
  const last = index === INTRO_CARDS.length - 1;

  function finish() {
    if (user) AsyncStorage.setItem(introSeenKey(user.id), "1").catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  return (
    <View style={s.screen}>
      <View style={s.top}>
        <Text style={s.step}>{index + 1} / {INTRO_CARDS.length}</Text>
        {!last && (
          <TouchableOpacity onPress={finish} accessibilityRole="button" hitSlop={10}>
            <Text style={s.skip}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.body} key={index}>
        <Text style={s.icon} accessibilityElementsHidden importantForAccessibility="no">{card.icon}</Text>
        <Text style={s.title} accessibilityRole="header">{card.title}</Text>
        <Text style={s.text}>{card.body}</Text>
      </ScrollView>

      <View style={s.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {INTRO_CARDS.map((c, i) => (
          <TouchableOpacity key={c.title} onPress={() => setIndex(i)} hitSlop={6}>
            <View style={[s.dot, i === index && s.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.buttons}>
        <TouchableOpacity
          style={[s.btn, s.btnSecondary, index === 0 && s.hidden]}
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          accessibilityRole="button"
        >
          <Text style={s.btnSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btn, s.btnPrimary]}
          onPress={() => (last ? finish() : setIndex((i) => i + 1))}
          accessibilityRole="button"
        >
          <Text style={s.btnPrimaryText}>{last ? "Start shooting" : "Next"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 36, width: "100%", maxWidth: 520, alignSelf: "center" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 24 },
  step: { color: COLORS.textDim, fontFamily: mono, fontSize: 12, letterSpacing: 1 },
  skip: { color: COLORS.textMuted, fontFamily: mono, fontSize: 14, textDecorationLine: "underline" },
  body: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  icon: { fontSize: 56, color: COLORS.amber, marginBottom: 20 },
  title: { color: COLORS.textPrimary, fontFamily: mono, fontSize: 24, fontWeight: "700", marginBottom: 16 },
  text: { color: COLORS.textSecondary, fontSize: 16, lineHeight: 24 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.borderSubtle },
  dotActive: { backgroundColor: COLORS.amber, width: 20 },
  buttons: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: COLORS.amber },
  btnPrimaryText: { color: COLORS.bg, fontFamily: mono, fontSize: 16, fontWeight: "700" },
  btnSecondary: { borderWidth: 1, borderColor: COLORS.border },
  btnSecondaryText: { color: COLORS.textPrimary, fontFamily: mono, fontSize: 16 },
  hidden: { opacity: 0 },
});
