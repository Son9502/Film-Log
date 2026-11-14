import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { signOut, signUp } from "@/services/supabase";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";
import AuthScreen from "@/components/AuthScreen";
import PasswordInput from "@/components/PasswordInput";
import { backOrReplace } from "@/utils/navigation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACCOUNT_SWITCH_BLOCKED_MESSAGE, isAccountSwitchBlocked } from "@/utils/accountSyncSafety";

function validatePassword(pw: string): string | null {
  if (pw.length < 8)          return "At least 8 characters required.";
  if (!/[A-Z]/.test(pw))      return "Must include an uppercase letter.";
  if (!/[0-9]/.test(pw))      return "Must include a number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Must include a symbol (e.g. !@#$%).";
  return null;
}

// Visual strength indicator
function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)            score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;
  const levels = [
    { label: "",         color: COLORS.border },
    { label: "Weak",     color: "#ff9588" },
    { label: "Fair",     color: "#e5aa5e" },
    { label: "Good",     color: COLORS.amberLight },
    { label: "Strong",   color: "#87c987" },
  ];
  return { score, ...levels[score] };
}

export default function SignupScreen() {
  const router = useRouter();
  const { setUser, uploadLocalToSupabase } = useFilmLogStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const strength = passwordStrength(password);

  async function handleSignup() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await signUp(email.trim(), password.trim());
      const sbUser = data.user;
      if (sbUser) {
        const storedUserId = await AsyncStorage.getItem("filmlog:userId");
        if (isAccountSwitchBlocked(storedUserId, sbUser.id, useFilmLogStore.getState())) {
          if (data.session) await signOut();
          throw new Error(ACCOUNT_SWITCH_BLOCKED_MESSAGE);
        }
        setUser({ id: sbUser.id, email: sbUser.email ?? "" });
        await uploadLocalToSupabase(sbUser.id);
        router.replace("/(tabs)");
      } else {
        setSuccess(true);
      }
    } catch (e: any) {
      setError(e.message ?? "Sign up failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthScreen>
        <Text style={s.title}>Almost there!</Text>
        <Text style={s.subtitle}>
          We sent a confirmation link to {email}.{"\n\n"}
          Click it to activate your account — it only takes a second. Then come back and sign in.
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace("/auth/login")}>
          <Text style={s.primaryBtnText}>Go to Sign In</Text>
        </TouchableOpacity>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <Text style={s.title}>Create Account</Text>
      <Text style={s.subtitle}>Your data syncs across all your devices</Text>

      {error && <Text style={s.error}>{error}</Text>}

      <Text style={s.label}>Email</Text>
      <TextInput
        style={s.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={COLORS.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={s.label}>Password</Text>
      <PasswordInput
        kind="new"
        style={s.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Min. 8 chars, uppercase, number, symbol"
        placeholderTextColor={COLORS.textMuted}
      />

      {/* Strength bar */}
      {password.length > 0 && (
        <View style={s.strengthRow}>
          <View style={s.strengthBarBg}>
            <View style={[s.strengthBarFill, { width: `${strength.score * 25}%`, backgroundColor: strength.color }]} />
          </View>
          <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
        </View>
      )}

      <Text style={s.label}>Confirm Password</Text>
      <PasswordInput
        kind="new"
        style={s.input}
        value={confirm}
        onChangeText={setConfirm}
        placeholder="••••••••"
        placeholderTextColor={COLORS.textMuted}
      />

      <TouchableOpacity style={s.primaryBtn} onPress={handleSignup} disabled={loading}>
        {loading
          ? <ActivityIndicator color={COLORS.bg} />
          : <Text style={s.primaryBtnText}>Create Account</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={s.linkBtn} onPress={() => backOrReplace(router, "/auth/login")}>
        <Text style={s.linkText}>Already have an account? Sign in →</Text>
      </TouchableOpacity>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 22, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 4, textTransform: "uppercase", marginBottom: 4 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, fontFamily: "Courier New", marginBottom: 24, lineHeight: 22 },
  label: { fontSize: 14, color: COLORS.textSecondary, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Courier New", marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 16, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  strengthBarBg: { flex: 1, height: 3, backgroundColor: COLORS.border },
  strengthBarFill: { height: "100%" },
  strengthLabel: { fontSize: 13, fontFamily: "Courier New", width: 60, textAlign: "right" },
  primaryBtn: { marginTop: 24, minHeight: 48, backgroundColor: COLORS.amber, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: COLORS.bg, fontFamily: "Courier New", fontSize: 15, fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase" },
  linkBtn: { marginTop: 8, minHeight: 44, alignItems: "center", justifyContent: "center" },
  linkText: { fontSize: 15, color: COLORS.textSecondary, fontFamily: "Courier New", textAlign: "center" },
  error: { fontSize: 14, color: "#ff9588", fontFamily: "Courier New", marginBottom: 8, lineHeight: 20 },
});
