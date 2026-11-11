import { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { COLORS } from "@/constants";

export default function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  container: { flexGrow: 1, padding: 24, justifyContent: "center" },
  content: { width: "100%", maxWidth: 520, alignSelf: "center" },
});
