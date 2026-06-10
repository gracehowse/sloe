import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { clampJournalDate, journalRangeBounds } from "@/lib/journalNavigation";
import { dateKeyFromDate } from "@/lib/nutritionJournal";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  colors: Theme;
};

function stripMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function monthMatrix(viewMonth: Date): (Date | null)[] {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

export default function JournalDatePickerModal({ visible, onClose, selectedDate, onSelectDate, colors }: Props) {
  // Scheme-resolved accent (2026-06-09): dark inverts the aubergine family.
  const accent = useAccent();
  const { min, max } = useMemo(() => journalRangeBounds(), []);
  const [viewMonth, setViewMonth] = useState(() => stripMidnight(selectedDate));

  useEffect(() => {
    if (visible) setViewMonth(stripMidnight(selectedDate));
  }, [visible, selectedDate]);

  const matrix = useMemo(() => monthMatrix(viewMonth), [viewMonth]);
  const selKey = dateKeyFromDate(selectedDate);

  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const goPrevMonth = () => {
    setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "center", padding: Spacing.lg }}
      >
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: colors.cardBorder }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md }}>
            <Pressable onPress={goPrevMonth} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>{monthLabel}</Text>
            <Pressable onPress={goNextMonth} hitSlop={12}>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", marginBottom: Spacing.sm }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <Text key={`${d}-${i}`} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.textTertiary }}>
                {d}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {matrix.map((cell, idx) => {
              if (!cell) {
                return <View key={`pad-${idx}`} style={{ width: `${100 / 7}%`, aspectRatio: 1, maxWidth: 48 }} />;
              }
              const ck = dateKeyFromDate(cell);
              const disabled = cell.getTime() < min.getTime() || cell.getTime() > max.getTime();
              const isSel = ck === selKey;
              return (
                <Pressable
                  key={`${ck}-${idx}`}
                  disabled={disabled}
                  onPress={() => {
                    onSelectDate(clampJournalDate(cell));
                    onClose();
                  }}
                  style={{
                    width: `${100 / 7}%`,
                    aspectRatio: 1,
                    maxWidth: 48,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSel ? accent.primary : "transparent",
                      opacity: disabled ? 0.28 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: isSel ? "800" : "600",
                        color: isSel ? "#fff" : colors.text,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {cell.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={onClose}
            style={{ marginTop: Spacing.md, paddingVertical: Spacing.dense, alignItems: "center" }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: accent.primarySolid }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
