import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react-native";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SupprButton } from "@/components/ui/SupprButton";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  DELETE_ACCOUNT_CONFIRM_TOKEN,
  DELETE_ACCOUNT_COPY,
  DELETE_ACCOUNT_LEAVE_REASONS,
  type DeleteAccountLedgerRow,
  type DeleteAccountLeaveReason,
} from "@suppr/shared/settings/deleteAccountFlow";

export interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
  ledger: DeleteAccountLedgerRow[];
  loadingLedger?: boolean;
  deleting?: boolean;
  /** ENG-1262 — true while the complete server export is in flight; the
   *  "Download a copy first" button disables + shows progress so it can't be
   *  double-submitted before the (heavy, rate-limited) export resolves. */
  exportingFirst?: boolean;
  onExportFirst: () => void;
  onDeleteForever: (reason: DeleteAccountLeaveReason | null) => void;
}

function StepBar({ step, destructive }: { step: 1 | 2 | 3; destructive: string }) {
  return (
    <View style={styles.stepBar} testID="delete-account-step-bar">
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[
            styles.stepSeg,
            { backgroundColor: n <= step ? destructive : "rgba(0,0,0,0.08)" },
          ]}
        />
      ))}
    </View>
  );
}

/** ENG-1260 / B26 — 3-step delete account sheet (mobile). */
export function DeleteAccountSheet({
  visible,
  onClose,
  ledger,
  loadingLedger = false,
  deleting = false,
  exportingFirst = false,
  onExportFirst,
  onDeleteForever,
}: DeleteAccountSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState<DeleteAccountLeaveReason | null>(null);
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (visible) {
      setStep(1);
      setReason(null);
      setConfirm("");
    }
  }, [visible]);

  const copy = DELETE_ACCOUNT_COPY;
  const canDelete = confirm === DELETE_ACCOUNT_CONFIRM_TOKEN;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + Spacing.lg,
              maxHeight: "80%",
            },
          ]}
          testID="delete-account-sheet"
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
          <StepBar step={step} destructive={Accent.destructive} />

          {step === 1 ? (
            <>
              <Text style={[styles.stepHd, { color: colors.text }]}>{copy.step1.heading}</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>{copy.step1.sub}</Text>
              <View style={[styles.card, { borderColor: colors.border }]}>
                {DELETE_ACCOUNT_LEAVE_REASONS.map((r) => {
                  const selected = reason === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setReason(r)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      style={[styles.row, { borderBottomColor: colors.border }]}
                    >
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{r}</Text>
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: selected ? colors.tint : colors.textTertiary },
                        ]}
                      >
                        {selected ? (
                          <View style={[styles.radioInner, { backgroundColor: colors.tint }]} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <View style={[styles.warnCircle, { backgroundColor: `${Accent.destructive}14` }]}>
                <AlertTriangle size={22} color={Accent.destructive} />
              </View>
              <Text style={[styles.stepHd, styles.center, { color: colors.text }]}>
                {copy.step2.heading}
              </Text>
              <Text style={[styles.sub, styles.center, { color: colors.textSecondary }]}>
                {copy.step2.body}
              </Text>
              <SupprButton
                variant="ghost"
                onPress={onExportFirst}
                style={styles.exportBtn}
                loading={exportingFirst}
                disabled={exportingFirst}
                testID="delete-account-export-first"
                label={copy.step2.exportFirst}
              />
              <View style={[styles.card, { borderColor: colors.border, marginTop: Spacing.lg }]}>
                {loadingLedger ? (
                  <Text style={[styles.sub, { padding: Spacing.lg, color: colors.textSecondary }]}>
                    Loading…
                  </Text>
                ) : (
                  ledger.map((row) => (
                    <View key={row.id} style={[styles.ledgerRow, { borderBottomColor: colors.border }]}>
                      <View style={[styles.ledgerIcon, { backgroundColor: `${Accent.destructive}14` }]}>
                        <X size={15} color={Accent.destructive} />
                      </View>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{row.label}</Text>
                    </View>
                  ))
                )}
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                {copy.step3.bodyPrefix}{" "}
                <Text style={{ fontWeight: "700" }}>{DELETE_ACCOUNT_CONFIRM_TOKEN}</Text>{" "}
                {copy.step3.bodySuffix}
              </Text>
              <TextInput
                value={confirm}
                onChangeText={(t) => setConfirm(t.toUpperCase())}
                placeholder={copy.step3.placeholder}
                autoCapitalize="characters"
                style={[
                  styles.confirmInput,
                  {
                    borderColor: colors.border,
                    color: colors.text,
                    backgroundColor: colors.background,
                  },
                ]}
                testID="delete-account-confirm-input"
              />
            </>
          ) : null}

          <View style={styles.footer}>
            <SupprButton
              variant="ghost"
              style={styles.footerBtn}
              disabled={deleting}
              onPress={onClose}
              label={copy.keepAccount}
            />
            {step < 3 ? (
              <SupprButton
                variant="primary"
                style={styles.footerBtn}
                onPress={() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
                label={copy.continue}
              />
            ) : (
              <SupprButton
                variant="primary"
                style={[
                  styles.footerBtn,
                  canDelete ? { backgroundColor: Accent.destructiveSolid } : undefined,
                ]}
                disabled={!canDelete}
                loading={deleting}
                onPress={() => onDeleteForever(reason)}
                testID="delete-account-confirm"
                label={copy.deleteForever}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  title: { ...Type.title, fontWeight: "700" as const },
  stepBar: { flexDirection: "row", gap: Spacing.sm, marginVertical: Spacing.lg },
  stepSeg: { flex: 1, height: 4, borderRadius: Radius.full },
  stepHd: { ...Type.headline, marginTop: Spacing.sm },
  sub: { ...Type.body, marginTop: Spacing.sm, lineHeight: 20 },
  center: { textAlign: "center" },
  card: { marginTop: Spacing.lg, borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { ...Type.body, flex: 1, fontWeight: "600" as const },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.8,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  warnCircle: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  exportBtn: { marginTop: Spacing.lg },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ledgerIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmInput: {
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    textAlign: "center",
    letterSpacing: 3.2,
    fontWeight: "700",
    fontSize: 16,
  },
  footer: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  footerBtn: { flex: 1 },
});
