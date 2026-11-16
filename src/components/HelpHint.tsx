// Small "?" help: tap to show a short explanation, tap again to hide it.
// Works the same on web and phone (no alerts or tooltips).
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { COLORS } from "@/constants";

export function HelpButton({ open, onPress, label }: { open: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      style={[s.btn, open && s.btnOpen]}
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={open ? `Hide help: ${label}` : `Help: ${label}`}
      accessibilityState={{ expanded: open }}
    >
      <Text style={[s.btnText, open && s.btnTextOpen]}>?</Text>
    </TouchableOpacity>
  );
}

export function HelpText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.text, style]}>{children}</Text>;
}

/** A field label with a "?" beside it; the explanation opens below the label. */
export function HelpLabel({ children, text, style, containerStyle }: {
  children: ReactNode;
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const label = typeof children === "string" ? children : "this field";
  return (
    <View style={containerStyle}>
      <View style={s.row}>
        <Text style={style}>{children}</Text>
        <HelpButton open={open} onPress={() => setOpen((o) => !o)} label={label} />
      </View>
      {open && <HelpText>{text}</HelpText>}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: COLORS.textDim,
    alignItems: "center", justifyContent: "center",
  },
  btnOpen: { borderColor: COLORS.amber, backgroundColor: COLORS.amberDim },
  btnText: { color: COLORS.textDim, fontSize: 11, fontWeight: "700", lineHeight: 13 },
  btnTextOpen: { color: COLORS.textPrimary },
  text: {
    color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 4,
    padding: 10, backgroundColor: COLORS.bgElevated, borderLeftWidth: 2, borderLeftColor: COLORS.amber,
  },
});
