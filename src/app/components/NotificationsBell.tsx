"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAuthSession } from "../../context/AuthSessionContext.tsx";

type NotifRow = {
  recipe_id: string;
  created_at: string;
  read_at: string | null;
  recipes: { title: string } | null;
};

export function NotificationsBell({ onOpenRecipe }: { onOpenRecipe: (recipeId: string) => void }) {
  const { authedUserId } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotifRow[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!authedUserId) {
      setRows([]);
      setUnread(0);
      return;
    }
    const { data, error } = await supabase
      .from("creator_publish_notifications")
      .select("recipe_id, created_at, read_at, recipes(title)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("creator_publish_notifications:", error.message);
      }
      return;
    }
    const raw = (data ?? []) as {
      recipe_id: string;
      created_at: string;
      read_at: string | null;
      recipes: { title: string } | { title: string }[] | null;
    }[];
    const list: NotifRow[] = raw.map((r) => {
      const rec = r.recipes;
      const one = Array.isArray(rec) ? rec[0] ?? null : rec;
      return { recipe_id: r.recipe_id, created_at: r.created_at, read_at: r.read_at, recipes: one };
    });
    setRows(list);
    setUnread(list.filter((r) => !r.read_at).length);
  }, [authedUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const markRead = async (recipeId: string) => {
    if (!authedUserId) return;
    await supabase
      .from("creator_publish_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", authedUserId)
      .eq("recipe_id", recipeId);
    void load();
  };

  if (!authedUserId) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold leading-[1.1rem] text-center">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-[60]" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-[70] w-[min(100vw-2rem,22rem)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl max-h-[min(70vh,24rem)] overflow-y-auto">
            <p className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">
              New from people you follow
            </p>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
            ) : (
              <ul className="py-1">
                {rows.map((r) => (
                  <li key={r.recipe_id}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 flex flex-col gap-0.5"
                      onClick={() => {
                        void markRead(r.recipe_id);
                        setOpen(false);
                        onOpenRecipe(r.recipe_id);
                      }}
                    >
                      <span className="font-medium text-slate-900 dark:text-white line-clamp-2">
                        {r.recipes?.title ?? "New recipe"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(r.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {!r.read_at ? " · Unread" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
