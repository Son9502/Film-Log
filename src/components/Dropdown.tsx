import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { COLORS } from "@/constants";

export interface DropdownItem {
  id: string;
  label: string;
  sub?: string;
}

export default function Dropdown({
  items, selectedId, onSelect, placeholder = "Select…",
}: {
  items: DropdownItem[];
  selectedId?: string;
  onSelect: (item: DropdownItem) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === selectedId);

  return (
    <View>
      <TouchableOpacity style={s.field} onPress={() => setOpen((o) => !o)}>
        <View style={{ flex: 1 }}>
          <Text style={selected ? s.text : s.placeholder}>{selected?.label ?? placeholder}</Text>
          {selected?.sub ? <Text style={s.sub}>{selected.sub}</Text> : null}
        </View>
        <Text style={s.arrow}>{open ? "▴" : "▾"}</Text>
      </TouchableOpacity>
      {open && (
        <ScrollView style={s.list} nestedScrollEnabled>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[s.option, item.id === selectedId && s.optionActive]}
              onPress={() => { onSelect(item); setOpen(false); }}
            >
              <Text style={[s.text, item.id === selectedId && s.textActive]}>{item.label}</Text>
              {item.sub ? <Text style={s.sub}>{item.sub}</Text> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const mono = "Courier New";
const s = StyleSheet.create({
  field: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center",
  },
  text: { fontSize: 15, color: COLORS.textPrimary, fontFamily: mono },
  textActive: { color: COLORS.amber },
  placeholder: { fontSize: 15, color: COLORS.textDim, fontFamily: mono },
  sub: { fontSize: 13, color: COLORS.textMuted, fontFamily: mono, marginTop: 2 },
  arrow: { fontSize: 14, color: COLORS.textDim, marginLeft: 8 },
  list: {
    maxHeight: 220, borderWidth: 1, borderTopWidth: 0, borderColor: COLORS.border,
    backgroundColor: COLORS.bgElevated,
  },
  option: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  optionActive: { backgroundColor: COLORS.bgCard },
});
