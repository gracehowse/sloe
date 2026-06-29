import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Colors, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { submitFoodCorrection } from "@/lib/verifyRecipe";
import { getSupprWebBase } from "@/lib/supprWeb";

/**
 * BarcodeShareOptIn — the explicit, opt-in "contribute to the shared food
 * database" step shown AFTER a not-found barcode has already been logged
 * privately (`handleManualLog` wrote the private `nutrition_entries` row). This
 * is the ONLY community write on the not-found path, and it is never automatic.
 *
 * Posture (docs/decisions/2026-06-27-shared-food-db-contribution-opt-in.md,
 * legal-reviewed): a default-OFF discrete affirmative tap ("Share it"); the copy
 * states what's shared + the purpose + links to the policy; the success card is
 * honest about pending-until-verified; a plausibility `block` shows the inline
 * reasons, NOT the success card. 16+ to contribute (stated in the policy).
 *
 * Host gates this behind the `barcode_community_contribution` flag and only
 * mounts it once the private log has succeeded. Submitting writes to `user_foods`
 * via {@link submitFoodCorrection} (pending-until-verified). Parity twin lands on
 * web in the CreateCustomFoodDialog flow.
 */
export interface BarcodeShareOptInEntry {
  barcode: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
}

type Phase = "prompt" | "sharing" | "success" | "blocked";

const PRIVACY_URL =
  (getSupprWebBase() || "https://getsloe.com") + "/privacy#community-food-database";

export function BarcodeShareOptIn({
  entry,
  userId,
  onDone,
}: {
  entry: BarcodeShareOptInEntry;
  userId: string;
  onDone: () => void;
}) {
  const accent = useAccent();
  const [phase, setPhase] = useState<Phase>("prompt");
  const [reasons, setReasons] = useState<string[]>([]);

  const share = useCallback(async () => {
    setPhase("sharing");
    const result = await submitFoodCorrection({
      barcode: entry.barcode,
      name: entry.name,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      fiberG: entry.fiberG,
      userId,
    });
    if (result.ok) {
      setPhase("success");
    } else if (result.error === "plausibility_blocked") {
      // Honesty rule: a blocked submission NEVER shows the success card.
      setReasons(result.reasons ?? []);
      setPhase("blocked");
    } else {
      // Network / other error — don't claim success; the private log stands.
      setReasons(result.error ? [result.error] : []);
      setPhase("blocked");
    }
  }, [entry, userId]);

  if (phase === "success") {
    return (
      <View style={styles.card} testID="barcode-share-success">
        <Text style={styles.title}>Saved — thank you</Text>
        <Text style={styles.body}>
          It&rsquo;ll show up straight away on your next scan of this barcode. Once a couple of people confirm the same
          numbers, it becomes the entry everyone sees when they scan it. You can remove your version any time from your
          saved items.
        </Text>
        <PressableScale
          style={[styles.primaryBtn, { backgroundColor: accent.primary }]}
          haptic="selection"
          onPress={onDone}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>Done</Text>
        </PressableScale>
      </View>
    );
  }

  if (phase === "blocked") {
    return (
      <View style={styles.card} testID="barcode-share-blocked">
        <Text style={styles.title}>These numbers look off</Text>
        <Text style={styles.body}>
          We didn&rsquo;t add this to the shared database &mdash; double-check the values against the label.
          {reasons.length ? " " + reasons.join(" ") : ""}
        </Text>
        <Text style={[styles.body, styles.bodyMuted]}>Your private log is saved either way.</Text>
        <PressableScale
          style={styles.secondaryBtn}
          haptic="selection"
          onPress={onDone}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>Got it</Text>
        </PressableScale>
      </View>
    );
  }

  const busy = phase === "sharing";
  return (
    <View style={styles.card} testID="barcode-share-optin">
      <Text style={styles.confirm}>✓ Logged to your tracker</Text>
      <Text style={styles.title}>Add this to Sloe&rsquo;s shared food database?</Text>
      <Text style={styles.body}>
        Optional. The name and nutrition you just entered would be shared so other people who scan this barcode can use
        it too &mdash; once it&rsquo;s confirmed. Nothing else from your account is shared.
      </Text>
      <Text
        style={[styles.link, { color: accent.primary }]}
        onPress={() => void Linking.openURL(PRIVACY_URL)}
        accessibilityRole="link"
      >
        How this is used
      </Text>
      <PressableScale
        style={[styles.primaryBtn, { backgroundColor: accent.primary }]}
        haptic="confirm"
        onPress={share}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Share it"
      >
        {busy ? (
          <ActivityIndicator color={Accent.primaryForeground} />
        ) : (
          <Text style={styles.primaryBtnText}>Share it</Text>
        )}
      </PressableScale>
      <PressableScale
        style={styles.secondaryBtn}
        haptic="selection"
        onPress={onDone}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Keep it private"
      >
        <Text style={styles.secondaryBtnText}>Keep it private</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  confirm: { fontSize: 13, fontWeight: "600", color: Accent.success },
  title: { ...Type.navTitle, color: Accent.primaryForeground },
  body: { fontSize: 14, lineHeight: 20, color: Colors.dark.textSecondary },
  bodyMuted: { opacity: 0.85 },
  link: {
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
    marginBottom: Spacing.xs,
  },
  primaryBtn: {
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: Accent.primaryForeground, fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  secondaryBtnText: { color: Colors.dark.text, fontWeight: "600", fontSize: 14 },
});
