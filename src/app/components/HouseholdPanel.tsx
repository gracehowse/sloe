"use client";

import { useCallback, useEffect, useState } from "react";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { useAuthSession } from "../../context/AuthSessionContext";

type MemberSummary = {
  userId: string;
  role: string;
  displayName: string;
  targets: { calories: number; protein: number; carbs: number; fat: number };
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  remaining: { calories: number; protein: number; carbs: number; fat: number };
};

type HouseholdMeal = {
  id: string;
  date_key: string;
  meal_label: string;
  recipe_title: string;
  servings: number;
  calories_per_serving: number | null;
  protein_per_serving: number | null;
  carbs_per_serving: number | null;
  fat_per_serving: number | null;
  notes: string | null;
};

type HouseholdData = {
  household: {
    id: string;
    name: string;
    invite_code: string;
    isOwner: boolean;
    myRole: string;
  } | null;
  members: MemberSummary[];
  meals: HouseholdMeal[];
};

export function HouseholdPanel() {
  const { authedUserId } = useAuthSession();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const load = useCallback(async () => {
    if (!authedUserId) { setLoading(false); return; }
    try {
      const res = await fetch("/api/household", {
        headers: { Authorization: `Bearer ${(await import("../../lib/supabase/browserClient")).supabase.auth.getSession().then((s) => s.data.session?.access_token)}` },
      });
      const json = await res.json();
      if (json.ok) setData(json);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [authedUserId]);

  useEffect(() => { void load(); }, [load]);

  const createHousehold = async () => {
    setError(null);
    const res = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: householdName.trim() || "My Household" }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowCreate(false);
      setHouseholdName("");
      void load();
    } else {
      setError(json.message ?? "Failed to create household");
    }
  };

  const joinHousehold = async () => {
    setError(null);
    const res = await fetch("/api/household/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: inviteCode.trim() }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowJoin(false);
      setInviteCode("");
      void load();
    } else {
      setError(json.message ?? "Invalid invite code");
    }
  };

  const leaveHousehold = async () => {
    if (!confirm("Are you sure you want to leave this household?")) return;
    await fetch("/api/household/leave", { method: "POST" });
    void load();
  };

  if (!authedUserId) return null;
  if (loading) return <div className="text-sm text-muted-foreground">Loading household...</div>;

  const todayKey = new Date().toISOString().slice(0, 10);

  // No household — show create/join options
  if (!data?.household) {
    return (
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <IconBox size="sm" tone="primary"><Icons.users /></IconBox>
          <p className="text-sm font-semibold text-foreground">Household Meal Planning</p>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Share dinner plans with your household. Each member sees their own remaining macros after shared meals.
        </p>

        {error && <p className="text-xs text-destructive mb-3">{error}</p>}

        {showCreate ? (
          <div className="space-y-2">
            <input
              className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Household name"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              maxLength={50}
            />
            <div className="flex gap-2">
              <button onClick={() => void createHousehold()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">Create</button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm hover:opacity-90 transition-opacity">Cancel</button>
            </div>
          </div>
        ) : showJoin ? (
          <div className="space-y-2">
            <input
              className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono tracking-wider"
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => void joinHousehold()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">Join</button>
              <button onClick={() => setShowJoin(false)} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm hover:opacity-90 transition-opacity">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(true)} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">Create Household</button>
            <button onClick={() => setShowJoin(true)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted/50 transition-colors">Join with Code</button>
          </div>
        )}
      </div>
    );
  }

  // Has household — show dashboard
  const todayMeals = data.meals.filter((m) => m.date_key === todayKey);
  const upcomingMeals = data.meals.filter((m) => m.date_key > todayKey);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <IconBox size="sm" tone="primary"><Icons.users /></IconBox>
            <p className="text-sm font-semibold text-foreground">{data.household.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {data.household.isOwner && (
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {showInvite ? "Hide code" : "Invite"}
              </button>
            )}
            <button
              onClick={() => void leaveHousehold()}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Leave
            </button>
          </div>
        </div>

        {showInvite && (
          <div className="mb-3 p-2.5 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Share this code to invite members</p>
            <p className="text-lg font-mono font-bold text-foreground tracking-[0.3em]">{data.household.invite_code}</p>
          </div>
        )}

        {/* Members + remaining macros */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Members — remaining today</p>
        <div className="space-y-1.5">
          {data.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2">
              <span className="text-xs text-foreground font-medium w-20 truncate">{m.displayName}</span>
              <div className="flex-1 grid grid-cols-4 gap-1">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">Cal</p>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: m.remaining.calories > 0 ? "var(--success)" : "var(--warning)" }}>{m.remaining.calories}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">P</p>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--macro-protein)" }}>{m.remaining.protein}g</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">C</p>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--macro-carbs)" }}>{m.remaining.carbs}g</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">F</p>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--macro-fat)" }}>{m.remaining.fat}g</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's shared meals */}
      <div className="rounded-xl bg-card border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-2">Today&apos;s Shared Meals</p>
        {todayMeals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No shared meals planned for today.</p>
        ) : (
          <div className="space-y-2">
            {todayMeals.map((meal) => (
              <div key={meal.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                <div>
                  <p className="text-xs font-semibold text-foreground">{meal.recipe_title}</p>
                  <p className="text-[10px] text-muted-foreground">{meal.meal_label} · {meal.servings} servings</p>
                </div>
                {meal.calories_per_serving != null && (
                  <div className="text-right">
                    <p className="text-xs font-semibold tabular-nums text-foreground">{meal.calories_per_serving} kcal</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {meal.protein_per_serving ?? 0}P · {meal.carbs_per_serving ?? 0}C · {meal.fat_per_serving ?? 0}F
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming meals */}
      {upcomingMeals.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-sm font-semibold text-foreground mb-2">Upcoming</p>
          <div className="space-y-1.5">
            {upcomingMeals.slice(0, 7).map((meal) => (
              <div key={meal.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs text-foreground">{meal.recipe_title}</p>
                  <p className="text-[10px] text-muted-foreground">{meal.date_key.slice(5)} · {meal.meal_label}</p>
                </div>
                {meal.calories_per_serving != null && (
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground">{meal.calories_per_serving} kcal/srv</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
