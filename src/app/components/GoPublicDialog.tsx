"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog.tsx";

export function GoPublicDialog(props: {
  disabled?: boolean;
  recipeTitle: string;
  onConfirmPublish: () => void;
  triggerLabel?: string;
}) {
  const [attest, setAttest] = useState(false);
  const triggerLabel = props.triggerLabel ?? "Go public";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={props.disabled}
          className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {triggerLabel}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Publish this recipe?</AlertDialogTitle>
          <AlertDialogDescription>
            Publishing makes <span className="font-medium text-slate-900 dark:text-white">{props.recipeTitle}</span>{" "}
            visible to others. Only publish recipes you created and have the right to share.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/40">
          <input
            type="checkbox"
            className="mt-1 rounded border-slate-300"
            checked={attest}
            onChange={(e) => setAttest(e.target.checked)}
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            I created this recipe and I have the right to share it publicly.
          </span>
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl"
            disabled={!attest}
            onClick={() => {
              if (!attest) return;
              props.onConfirmPublish();
            }}
          >
            Publish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

