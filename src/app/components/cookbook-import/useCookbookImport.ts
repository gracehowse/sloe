"use client";

/**
 * useCookbookImport — composition-root hook for the web Cookbook-Import surface
 * (ENG-1582). Holds pick/extract/parse/review/commit state + handlers so the
 * screen file stays thin (400-line screen-file rule, ENG-621).
 *
 * Reuses the SAME `/api/cookbook-import/*` routes and the SHARED
 * `commitCookbookImport` pipeline the mobile flow calls — no fork.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAppData } from "../../../context/AppDataContext.tsx";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import {
  COOKBOOK_IMPORT_FREE_SAVE_CAP,
  commitCookbookImport,
} from "../../../lib/planning/planImport/commitCookbookImport.ts";
import type {
  PlanImportNutritionMode,
  PlanImportVerifiedRecipe,
} from "../../../lib/planning/planImport/types.ts";

export type CookbookImportStep = "pick" | "parsing" | "review" | "success";

type CookbookParseApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  bookName?: string;
  recipes?: PlanImportVerifiedRecipe[];
  parseWarnings?: string[];
  chunkCount?: number;
  lowConfidenceCount?: number;
};

type ExtractApiResponse = {
  ok?: boolean;
  text?: string;
  message?: string;
  error?: string;
};

/** Client-side PDF ceiling — mirrors mobile (`cookbook-import.tsx`). */
export const COOKBOOK_IMPORT_MAX_PDF_BYTES = 4 * 1024 * 1024;

export function defaultBookNameFromFile(name: string): string {
  return (
    name
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ")
      .trim()
      .slice(0, 80) || "Imported cookbook"
  );
}

export function useCookbookImport(onClose: () => void, onUpgrade?: () => void) {
  const { userId, profileTier } = useAppData();

  const [step, setStep] = useState<CookbookImportStep>("pick");
  const [bookName, setBookName] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [parsingMessage, setParsingMessage] = useState("Reading PDF…");
  const [recipes, setRecipes] = useState<PlanImportVerifiedRecipe[]>([]);
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [nutritionMode, setNutritionMode] = useState<PlanImportNutritionMode>("match");
  const [committing, setCommitting] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [partialSave, setPartialSave] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRecipes = useMemo(
    () => recipes.filter((r) => !excludedKeys.has(r.key)),
    [recipes, excludedKeys],
  );

  const onPickFile = useCallback((file: File | null) => {
    setPickError(null);
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      setPickError("Choose a PDF file.");
      return;
    }
    if (file.size > COOKBOOK_IMPORT_MAX_PDF_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setPickError(
        `This PDF is ${mb} MB — the limit is 4 MB. Export a searchable PDF (selectable text, not a flat scan) which is far smaller. If it's still too big, split the cookbook into sections.`,
      );
      return;
    }
    setPickedFile(file);
    setBookName(defaultBookNameFromFile(file.name));
  }, []);

  const extractPdf = useCallback(async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/cookbook-import/extract", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    let json: ExtractApiResponse;
    try {
      json = (await res.json()) as ExtractApiResponse;
    } catch {
      setPickError("Server error — try again shortly.");
      return null;
    }
    if (!json.ok || !json.text?.trim()) {
      setPickError(json.message ?? "Try a searchable PDF export.");
      return null;
    }
    return json.text;
  }, []);

  const runParse = useCallback(async () => {
    setPickError(null);
    if (!userId) {
      setPickError("Sign in to import a cookbook.");
      return;
    }
    if (!pickedFile) {
      setPickError("Choose a cookbook PDF first.");
      return;
    }
    setStep("parsing");
    setParsingMessage("Reading PDF…");
    try {
      const text = await extractPdf(pickedFile);
      if (!text) {
        setStep("pick");
        return;
      }
      setParsingMessage("Finding recipes…");
      const res = await fetch("/api/cookbook-import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text,
          bookName: bookName.trim() || defaultBookNameFromFile(pickedFile.name),
        }),
      });
      const json = (await res.json()) as CookbookParseApiResponse;
      if (res.status === 403 && json.error === "pro_required") {
        setStep("pick");
        setPickError("Cookbook PDF import is included with Pro — same as photo recipe import.");
        return;
      }
      if (!json.ok || !json.recipes?.length) {
        setStep("pick");
        setPickError(
          json.message ?? "No recipes found. Use a searchable PDF with ingredient lists.",
        );
        return;
      }
      setRecipes(json.recipes);
      setExcludedKeys(new Set());
      setParseWarnings(json.parseWarnings ?? []);
      if (json.bookName) setBookName(json.bookName);
      setStep("review");
    } catch {
      setStep("pick");
      setPickError("Parse failed — check your connection and try again.");
    }
  }, [userId, pickedFile, bookName, extractPdf]);

  const toggleExclude = useCallback((key: string) => {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const finishSave = useCallback(async () => {
    setPickError(null);
    if (!userId || selectedRecipes.length === 0) {
      setPickError("Include at least one recipe before saving.");
      return;
    }
    setCommitting(true);
    try {
      const { count } = await supabase
        .from("saves")
        .select("recipe_id", { count: "exact", head: true })
        .eq("user_id", userId);
      const savedSoFar = count ?? 0;
      const maxSaves =
        profileTier === "free"
          ? Math.max(0, COOKBOOK_IMPORT_FREE_SAVE_CAP - savedSoFar)
          : undefined;

      if (profileTier === "free" && maxSaves === 0) {
        setPickError(
          `Free plan allows up to ${COOKBOOK_IMPORT_FREE_SAVE_CAP} saved recipes.`,
        );
        return;
      }

      const result = await commitCookbookImport(
        supabase,
        {
          userId,
          bookName: bookName.trim() || "Imported cookbook",
          recipes: selectedRecipes,
          nutritionMode,
        },
        maxSaves != null ? { maxSaves } : undefined,
      );

      if (!result.ok) {
        toast.error("Save failed", { description: result.error });
        return;
      }

      setSavedCount(result.savedCount);
      setPartialSave(result.stoppedEarly && result.stopReason === "save_limit");
      setStep("success");

      if (result.stoppedEarly && result.stopReason === "save_limit") {
        toast.warning("Partially saved", {
          description: `Saved ${result.savedCount} of ${selectedRecipes.length} recipes before the free save limit.`,
        });
      }
    } finally {
      setCommitting(false);
    }
  }, [userId, selectedRecipes, bookName, nutritionMode, profileTier]);

  return {
    step,
    setStep,
    bookName,
    setBookName,
    pickedFile,
    parsingMessage,
    recipes,
    excludedKeys,
    nutritionMode,
    setNutritionMode,
    committing,
    parseWarnings,
    savedCount,
    partialSave,
    pickError,
    setPickError,
    selectedRecipes,
    fileInputRef,
    onPickFile,
    runParse,
    toggleExclude,
    finishSave,
    onClose,
    onUpgrade,
  };
}
