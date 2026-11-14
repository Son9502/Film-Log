// A password field with a Show/Hide button, so people can check what they typed.
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type StyleProp, type TextInputProps, type TextStyle } from "react-native";
import { COLORS } from "@/constants";

type Props = Omit<TextInputProps, "secureTextEntry" | "style"> & {
  style?: StyleProp<TextStyle>;
  /** "current" for signing in, "new" when choosing a password (helps password managers). */
  kind?: "current" | "new";
};

export default function PasswordInput({ style, kind = "current", ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={s.wrap}>
      <TextInput
        {...rest}
        style={[style, s.input]}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={kind === "new" ? "new-password" : "current-password"}
        textContentType={kind === "new" ? "newPassword" : "password"}
      />
      <TouchableOpacity
        style={s.toggle}
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        hitSlop={8}
      >
        <Text style={s.toggleText}>{visible ? "Hide" : "Show"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "relative", justifyContent: "center" },
  input: { paddingRight: 64 },
  toggle: { position: "absolute", right: 0, top: 0, bottom: 0, paddingHorizontal: 12, justifyContent: "center" },
  toggleText: { color: COLORS.textMuted, fontFamily: "Courier New", fontSize: 13, textDecorationLine: "underline" },
});
