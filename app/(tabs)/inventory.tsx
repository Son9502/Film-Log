import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";
import { uid, todayISO, formatDate, isExpired, rollsRemaining } from "@/utils";
import { FilmPurchase } from "@/types";
import Dropdown from "@/components/Dropdown";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function InventoryScreen() {
  const router = useRouter();
  const { purchases, filmStocks, addPurchase, updatePurchase, deletePurchase } = useFilmLogStore();

  const [editing, setEditing] = useState<FilmPurchase | "new" | null>(null);
  const [filmStockId, setFilmStockId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(todayISO());
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const stockName = (id: string) => filmStocks.find((f) => f.id === id)?.name ?? "Unknown film";
  const available = purchases.filter((p) => rollsRemaining(p) > 0);
  const totalRolls = available.reduce((n, p) => n + rollsRemaining(p), 0);
  const expiredRolls = available.filter((p) => isExpired(p.expiresAt)).reduce((n, p) => n + rollsRemaining(p), 0);

  function openForm(p: FilmPurchase | "new") {
    if (p === "new") {
      setFilmStockId(filmStocks[0]?.id ?? "");
      setQuantity("1");
      setPrice("");
      setPurchasedAt(todayISO());
      setExpiresAt("");
    } else {
      setFilmStockId(p.filmStockId);
      setQuantity(String(p.quantity));
      setPrice(p.price != null ? String(p.price) : "");
      setPurchasedAt(p.purchasedAt);
      setExpiresAt(p.expiresAt ?? "");
    }
    setError("");
    setEditing(p);
  }

  function save() {
    const qty = parseInt(quantity, 10);
    const cost = price.trim() ? parseFloat(price) : undefined;
    if (!filmStockId) return setError("Choose a film stock.");
    if (!qty || qty <= 0) return setError("Quantity must be at least 1.");
    if (cost !== undefined && (isNaN(cost) || cost < 0)) return setError("Price must be a positive number.");
    if (!DATE_RE.test(purchasedAt)) return setError("Purchase date must be YYYY-MM-DD.");
    if (expiresAt && !DATE_RE.test(expiresAt)) return setError("Expiry must be YYYY-MM-DD.");
    const now = new Date().toISOString();

    if (editing === "new") {
      addPurchase({
        id: uid(), filmStockId, quantity: qty, quantityLoaded: 0, price: cost,
        purchasedAt, expiresAt: expiresAt || undefined, createdAt: now, updatedAt: now,
      });
    } else if (editing) {
      if (qty < editing.quantityLoaded) return setError(`${editing.quantityLoaded} already loaded; quantity can't be lower.`);
      updatePurchase({
        ...editing, filmStockId, quantity: qty, price: cost,
        purchasedAt, expiresAt: expiresAt || undefined, updatedAt: now,
      });
    }
    setEditing(null);
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.summary}>
          <Text style={s.summaryNum}>{totalRolls}</Text>
          <Text style={s.summaryLabel}>rolls in stock</Text>
          {expiredRolls > 0 && <Text style={s.expiredNote}>{expiredRolls} expired</Text>}
        </View>

        {purchases.length === 0 && (
          <Text style={s.empty}>No film yet. Add what you buy and load rolls from it.</Text>
        )}

        {purchases.map((p) => {
          const left = rollsRemaining(p);
          const expired = isExpired(p.expiresAt);
          return (
            <View key={p.id} style={[s.card, left === 0 && s.cardDone]}>
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>{stockName(p.filmStockId)}</Text>
                <Text style={s.cardCount}>{left} / {p.quantity} left</Text>
              </View>
              <Text style={s.cardSub}>
                Bought {formatDate(p.purchasedAt)}
                {p.price != null ? ` · $${p.price.toFixed(2)}` : ""}
              </Text>
              {p.expiresAt && (
                <Text style={[s.cardSub, expired && s.expired]}>
                  {expired ? "Expired " : "Expires "}{formatDate(p.expiresAt)}
                  {expired && left > 0 ? " — shoot it soon or overexpose" : ""}
                </Text>
              )}
              <View style={s.actions}>
                {left > 0 && (
                  <TouchableOpacity
                    style={s.loadBtn}
                    onPress={() => router.push({ pathname: "/roll/new", params: { purchaseId: p.id } })}
                  >
                    <Text style={s.loadText}>Load a roll</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => openForm(p)}>
                  <Text style={s.link}>Edit</Text>
                </TouchableOpacity>
                {confirmDeleteId === p.id ? (
                  <TouchableOpacity onPress={() => { deletePurchase(p.id); setConfirmDeleteId(null); }}>
                    <Text style={[s.link, s.danger]}>Confirm delete</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setConfirmDeleteId(p.id)}>
                    <Text style={s.link}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={s.fab} onPress={() => openForm("new")}>
        <Text style={s.fabText}>+ Add film</Text>
      </TouchableOpacity>

      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={s.overlay}>
          <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Film stock</Text>
            <Dropdown
              items={filmStocks.map((f) => ({ id: f.id, label: f.name, sub: `ISO ${f.iso}` }))}
              selectedId={filmStockId}
              onSelect={(i) => setFilmStockId(i.id)}
              placeholder="Select film stock"
            />

            <Text style={s.label}>Quantity (rolls)</Text>
            <TextInput style={s.input} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />

            <Text style={s.label}>Total price (optional)</Text>
            <TextInput style={s.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textDim} />

            <Text style={s.label}>Purchased (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={purchasedAt} onChangeText={setPurchasedAt} autoCapitalize="none" placeholderTextColor={COLORS.textDim} />

            <Text style={s.label}>Expires (YYYY-MM-DD, optional)</Text>
            <TextInput style={s.input} value={expiresAt} onChangeText={setExpiresAt} autoCapitalize="none" placeholder="2027-06-30" placeholderTextColor={COLORS.textDim} />

            {error !== "" && <Text style={s.error}>{error}</Text>}

            <TouchableOpacity style={s.saveBtn} onPress={save}>
              <Text style={s.saveText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(null)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const mono = "Courier New";
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 100 },
  summary: { alignItems: "center", paddingVertical: 16 },
  summaryNum: { fontSize: 36, color: COLORS.amber, fontFamily: mono },
  summaryLabel: { fontSize: 10, color: COLORS.textMuted, fontFamily: mono, letterSpacing: 2, textTransform: "uppercase" },
  expiredNote: { fontSize: 10, color: "#c0392b", fontFamily: mono, marginTop: 4 },
  empty: { color: COLORS.textMuted, fontFamily: mono, fontSize: 12, textAlign: "center", marginTop: 24 },
  card: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 10 },
  cardDone: { opacity: 0.5 },
  cardHead: { flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { color: COLORS.textPrimary, fontFamily: mono, fontSize: 14, flexShrink: 1 },
  cardCount: { color: COLORS.amber, fontFamily: mono, fontSize: 12 },
  cardSub: { color: COLORS.textMuted, fontFamily: mono, fontSize: 10, marginTop: 4 },
  expired: { color: "#c0392b" },
  actions: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 },
  loadBtn: { backgroundColor: COLORS.amber, paddingHorizontal: 12, paddingVertical: 8 },
  loadText: { color: COLORS.bg, fontFamily: mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" },
  link: { color: COLORS.textMuted, fontFamily: mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  danger: { color: "#c0392b" },
  fab: { position: "absolute", right: 16, bottom: 20, backgroundColor: COLORS.amber, paddingHorizontal: 16, paddingVertical: 12 },
  fabText: { color: COLORS.bg, fontFamily: mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.bgElevated, maxHeight: "85%", padding: 20 },
  label: { fontSize: 9, color: COLORS.amber, letterSpacing: 2, textTransform: "uppercase", fontFamily: mono, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontFamily: mono, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, paddingHorizontal: 10, paddingVertical: 8 },
  chipActive: { borderColor: COLORS.amber, backgroundColor: COLORS.amberDim },
  chipText: { color: COLORS.textMuted, fontFamily: mono, fontSize: 11 },
  chipTextActive: { color: COLORS.textPrimary },
  error: { color: "#c0392b", fontFamily: mono, fontSize: 11, marginTop: 12 },
  saveBtn: { marginTop: 24, backgroundColor: COLORS.amber, paddingVertical: 14, alignItems: "center" },
  saveText: { color: COLORS.bg, fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  cancelBtn: { paddingVertical: 14, alignItems: "center", marginBottom: 20 },
  cancelText: { color: COLORS.textMuted, fontFamily: mono, fontSize: 11 },
});
