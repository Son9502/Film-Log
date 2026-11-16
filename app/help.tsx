// Help & Feedback: the intro again, short answers to common questions, and a
// way to report a problem or suggest something.
import { useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants";
import { FAQ, FEEDBACK_URL } from "@/utils/help";

const mono = Platform.OS === "ios" ? "Courier New" : "monospace";

export default function HelpScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [linkError, setLinkError] = useState(false);

  function sendFeedback() {
    setLinkError(false);
    Linking.openURL(FEEDBACK_URL).catch(() => setLinkError(true));
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <Text style={s.sectionLabel}>Getting started</Text>
      <TouchableOpacity style={s.row} onPress={() => router.push("/intro")} accessibilityRole="button">
        <View style={s.rowMain}>
          <Text style={s.rowLabel}>Show the intro</Text>
          <Text style={s.rowSub}>How Film Log works, in seven cards</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>

      <Text style={[s.sectionLabel, s.spaced]}>Questions</Text>
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        return (
          <View key={item.q} style={s.faq}>
            <TouchableOpacity
              style={s.faqQ}
              onPress={() => setOpen(isOpen ? null : i)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <Text style={s.faqQText}>{item.q}</Text>
              <Text style={s.chevron}>{isOpen ? "−" : "+"}</Text>
            </TouchableOpacity>
            {isOpen && <Text style={s.faqA}>{item.a}</Text>}
          </View>
        );
      })}

      <Text style={[s.sectionLabel, s.spaced]}>Feedback</Text>
      <TouchableOpacity style={s.row} onPress={sendFeedback} accessibilityRole="link">
        <View style={s.rowMain}>
          <Text style={s.rowLabel}>Report a problem or suggest something</Text>
          <Text style={s.rowSub}>
            {linkError ? `Couldn't open the link. Go to ${FEEDBACK_URL}` : "Say what you were doing and what happened"}
          </Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 16, paddingBottom: 48, width: "100%", maxWidth: 640, alignSelf: "center" },
  sectionLabel: { fontSize: 10, color: COLORS.amber, letterSpacing: 2, textTransform: "uppercase", fontFamily: mono, marginBottom: 8 },
  spaced: { marginTop: 28 },
  row: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 14, minHeight: 56,
  },
  rowMain: { flex: 1 },
  rowLabel: { color: COLORS.textPrimary, fontSize: 15, fontFamily: mono },
  rowSub: { color: COLORS.textDim, fontSize: 12, marginTop: 3 },
  arrow: { color: COLORS.textDim, fontSize: 20, marginLeft: 8 },
  faq: { borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  faqQ: { flexDirection: "row", alignItems: "center", paddingVertical: 14, minHeight: 48 },
  faqQText: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  chevron: { color: COLORS.amber, fontSize: 18, width: 24, textAlign: "center" },
  faqA: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, paddingBottom: 14 },
});
