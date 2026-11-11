import { Tabs } from "expo-router";
import { Text, TouchableOpacity, ColorValue } from "react-native";
import { COLORS, SOCIAL_ENABLED } from "@/constants";
import { useFilmLogStore } from "@/store";
import { signOut } from "@/services/supabase";

export default function TabLayout() {
  const { user, clearUserData } = useFilmLogStore();

  function HeaderAccount() {
    if (!user) return null;
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Sign out ${user.email}`}
        style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 16 }}
        onPress={async () => {
          await signOut();
          clearUserData();
        }}
      >
        <Text style={{ fontSize: 14, color: COLORS.amberLight, fontFamily: "Courier New", fontWeight: "bold" }}>
          Sign Out
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: COLORS.amber,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontFamily: "Courier New",
          fontSize: 11,
          letterSpacing: 0,
          textTransform: "uppercase",
        },
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: {
          fontFamily: "Courier New",
          letterSpacing: 3,
          fontSize: 15,
          textTransform: "uppercase",
        },
        headerRight: () => <HeaderAccount />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Rolls",
          tabBarIcon: ({ color }) => (
            <TabIcon label="🎞" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Film Stash",
          tabBarIcon: ({ color }) => (
            <TabIcon label="📦" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="develop"
        options={{
          title: "Develop",
          tabBarIcon: ({ color }) => (
            <TabIcon label="🧪" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Journal",
          tabBarIcon: ({ color }) => (
            <TabIcon label="📓" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="walks"
        options={{
          title: "Walks",
          href: SOCIAL_ENABLED ? undefined : null,
          tabBarIcon: ({ color }) => (
            <TabIcon label="🚶" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <TabIcon label="⚙" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ label, color }: { label: string; color: ColorValue }) {
  const { Text } = require("react-native");
  return <Text style={{ fontSize: 18, color }}>{label}</Text>;
}
