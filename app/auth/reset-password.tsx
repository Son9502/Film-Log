import { useState, useEffect } from "react";
import {
  Text, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import { updatePassword } from "@/services/supabase";
import { COLORS } from "@/constants";
import AuthScreen from "@/components/AuthScreen";
import PasswordInput from "@/components/PasswordInput";

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [ready, setReady]       = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Supabase processes the token in the URL hash immediately on page load —
  // before this component mounts — so the PASSWORD_RECOVERY event is often
  // already gone by the time the listener registers. We fix this with two
  // strategies running in parallel:
  //   1. getSession() checks whether Supabase already set a session from the token.
  //   2. onAuthStateChange catches it if the event fires after mount.
  // A timeout surfaces an error if the link is expired or invalid.
  useEffect(() => {
    let settled = false;

    function markReady() {
      if (settled) return;
      settled = true;
      clearTimeout(expiry);
      setReady(true);
    }

    const expiry = setTimeout(() => {
      if (!settled) {
        settled = true;
        setError("This reset link has expired or is invalid. Please request a new one.");
      }
    }, 8000);

    // Strategy 1: session already established before mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady();
    });

    // Strategy 2: event fires after mount (native deep link, slower networks)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") markReady();
    });

    return () => {
      settled = true;
      clearTimeout(expiry);
      subscription.unsubscribe();
    };
  }, []);

  async function handleUpdate() {
    setError(null);
    if (!password.trim())    { setError("Enter a new password."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthScreen>
        <Text style={s.title}>Password Updated</Text>
        <Text style={s.subtitle}>
          Your password has been changed.{"\n"}Sign in with your new credentials.
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace("/auth/login")}>
          <Text style={s.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>
      </AuthScreen>
    );
  }

  if (!ready) {
    return (
      <AuthScreen>
        {error ? (
          <>
            <Text style={s.error}>{error}</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace("/auth/login")}>
              <Text style={s.primaryBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator color={COLORS.amber} size="large" />
            <Text style={s.waiting}>Verifying reset link…</Text>
          </>
        )}
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <Text style={s.title}>New Password</Text>
      <Text style={s.subtitle}>Choose a strong password for your account.</Text>

      {error && <Text style={s.error}>{error}</Text>}

      <Text style={s.label}>New Password</Text>
      <PasswordInput
        kind="new"
        style={s.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Min. 8 characters"
        placeholderTextColor={COLORS.textMuted}
        autoFocus
      />

      <Text style={s.label}>Confirm Password</Text>
      <PasswordInput
        kind="new"
        style={s.input}
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Re-enter password"
        placeholderTextColor={COLORS.textMuted}
      />

      <TouchableOpacity
        style={[s.primaryBtn, loading && s.btnDisabled]}
        onPress={handleUpdate}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={COLORS.bg} />
          : <Text style={s.primaryBtnText}>Update Password</Text>
        }
      </TouchableOpacity>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  title: {
    fontSize: 22, color: COLORS.amber, fontFamily: "Courier New",
    letterSpacing: 4, textTransform: "uppercase", marginBottom: 4,
  },
  subtitle: {
    fontSize: 15, color: COLORS.textMuted, fontFamily: "Courier New",
    marginBottom: 24, lineHeight: 22,
  },
  label: {
    fontSize: 14, color: COLORS.textSecondary, letterSpacing: 1,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 6, marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 16, minHeight: 48,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  primaryBtn: {
    marginTop: 24, minHeight: 48, backgroundColor: COLORS.amber,
    paddingVertical: 12, alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    color: COLORS.bg, fontFamily: "Courier New",
    fontSize: 15, fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase",
  },
  error: {
    fontSize: 14, color: "#ff9588", fontFamily: "Courier New",
    marginBottom: 8, lineHeight: 20,
  },
  waiting: {
    marginTop: 16, fontSize: 15, color: COLORS.textMuted,
    fontFamily: "Courier New", textAlign: "center",
  },
});
