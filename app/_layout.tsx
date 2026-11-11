import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/services/supabase";
import { useFilmLogStore } from "@/store";
import { COLORS, SOCIAL_ENABLED } from "@/constants";
import { BadgeToast } from "@/components/BadgeToast";
import { ACCOUNT_SWITCH_BLOCKED_MESSAGE, isAccountSwitchBlocked } from "@/utils/accountSyncSafety";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { hydrate, user, setUser, syncFromSupabase, uploadLocalToSupabase, clearUserData, clearAllData, subscribeToCreatorNotifications, subscribeToNewRolls, loadMyProfile } = useFilmLogStore();
  const [ready, setReady] = useState(false);

  // Initialise: hydrate local store, then restore Supabase session if one exists.
  // Hydrate before checking the account so local-only data is never cleared unseen.
  useEffect(() => {
    // Tracks which userId was handled by init() so the onAuthStateChange listener
    // can skip the initial SIGNED_IN event without double-syncing.
    let initHandledUserId: string | null = null;

    const hydration = hydrate();

    function rejectAccountSwitch(rejectedUserId: string) {
      useFilmLogStore.setState({ authSafetyError: ACCOUNT_SWITCH_BLOCKED_MESSAGE });
      setTimeout(() => {
        void supabase.auth.getSession().then(async ({ data, error }) => {
          if (error) throw error;
          if (data.session?.user.id !== rejectedUserId) return;
          const result = await supabase.auth.signOut();
          if (result.error) throw result.error;
        }).catch((error) => {
          console.error("Could not sign out rejected account:", error);
        });
      }, 0);
    }

    async function init() {
      await hydration;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const storedUserId = await AsyncStorage.getItem("filmlog:userId");
        if (isAccountSwitchBlocked(storedUserId, session.user.id, useFilmLogStore.getState())) {
          rejectAccountSwitch(session.user.id);
          setReady(true);
          return;
        }
        const isDifferentUser = storedUserId !== null && storedUserId !== session.user.id;
        if (isDifferentUser) {
          clearAllData();
        }
        const userId = session.user.id;
        setUser({ id: userId, email: session.user.email ?? "" });
        initHandledUserId = userId;
        // Local data is already hydrated, so show the app now and sync in the background.
        // Upload must finish before the download so un-synced local changes aren't overwritten.
        setReady(true);
        const upload = isDifferentUser ? Promise.resolve() : uploadLocalToSupabase(userId);
        await Promise.all([
          upload.then(() => syncFromSupabase(userId)),
          loadMyProfile(),
        ]);
        return;
      }
      setReady(true);
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await hydration;
      if (!session?.user) {
        initHandledUserId = null;
        clearUserData();
        return;
      }
      // Skip if init() already handled this exact user — avoids double-sync on startup
      if (initHandledUserId === session.user.id) return;
      // Mid-session sign-in (e.g. user switched accounts without a page reload)
      const storedUserId = await AsyncStorage.getItem("filmlog:userId");
      if (isAccountSwitchBlocked(storedUserId, session.user.id, useFilmLogStore.getState())) {
        rejectAccountSwitch(session.user.id);
        return;
      }
      const isDifferentUser = storedUserId !== null && storedUserId !== session.user.id;
      if (isDifferentUser) {
        clearAllData();
      } else if (storedUserId === session.user.id) {
        await uploadLocalToSupabase(session.user.id);
      }
      setUser({ id: session.user.id, email: session.user.email ?? "" });
      await syncFromSupabase(session.user.id);
      await loadMyProfile();
      initHandledUserId = session.user.id;
    });

    return () => subscription.unsubscribe();
  }, []);

  // Subscribe to Supabase Realtime for walk completion notifications
  useEffect(() => {
    if (!user || !SOCIAL_ENABLED) return;
    return subscribeToCreatorNotifications(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    return subscribeToNewRolls(user.id);
  }, [user?.id]);

  // Auth gate: runs after init so we never redirect before knowing the real auth state
  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === "auth";
    if (!user && !inAuthGroup) {
      router.replace("/auth/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, ready, segments]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bg },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: {
            fontFamily: "Courier New",
            fontSize: 12,
          },
          contentStyle: { backgroundColor: COLORS.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="roll/[id]" options={{ title: "Roll Detail" }} />
        <Stack.Screen name="roll/new" options={{ title: "New Roll", presentation: "modal" }} />
        <Stack.Screen name="settings/gear" options={{ title: "My Gear" }} />
        <Stack.Screen name="calculator" options={{ title: "Development Calculator" }} />
        <Stack.Screen name="batch/new" options={{ title: "New Batch", presentation: "modal" }} />
        <Stack.Screen name="settings/stats" options={{ title: "Stats & Badges" }} />
        <Stack.Screen name="roll/import" options={{ title: "Import Scans" }} />
        <Stack.Screen name="journal/[label]" options={{ title: "Location" }} />
        <Stack.Screen name="walks/[id]" options={{ title: "Walk" }} />
        <Stack.Screen name="walks/new" options={{ title: "New Walk", presentation: "modal" }} />
        <Stack.Screen name="settings/profile" options={{ title: "My Profile" }} />
        <Stack.Screen name="profile/[userId]" options={{ title: "Profile" }} />
        <Stack.Screen name="auth/login" options={{ title: "Account", headerShown: false }} />
        <Stack.Screen name="auth/signup" options={{ title: "Create Account", headerShown: false }} />
        <Stack.Screen name="auth/reset-password" options={{ title: "Reset Password", headerShown: false }} />
      </Stack>
      <BadgeToast />
    </>
  );
}
