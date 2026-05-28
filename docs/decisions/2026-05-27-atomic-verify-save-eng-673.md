# Atomic recipe verify save via RPC (ENG-673)

**Date:** 2026-05-27  
**Status:** Resolved  
**Area:** Data integrity / Mobile  

## Problem

`saveVerifiedIngredients` in `apps/mobile/lib/verifyRecipe.ts` wrote two tables sequentially:

1. `recipes` — UPDATE totals + allergens
2. `recipe_ingredients` — loop UPDATE, one row per dirty ingredient

No transaction wrapped these. A network failure mid-loop left the DB in a split state: recipe-level macros reflected the new totals but some ingredient rows retained stale values. The state never self-healed; the next verify-screen open re-computed from the stale rows, silently undoing the first write.

## Decision

Replace the two-step write with a single `save_verified_ingredients` Supabase RPC (PL/pgSQL, SECURITY INVOKER). PL/pgSQL executes all statements inside the function's implicit statement transaction — both writes land atomically or neither does.

Migration: `supabase/migrations/20260527100000_save_verified_ingredients_rpc.sql`

## Why RPC over a client-side BEGIN/COMMIT

Supabase JS v2 does not expose a raw `BEGIN`/`COMMIT` transaction API from the client. The only safe cross-table atomicity from RN is a server-side function.

## SECURITY INVOKER

Keeps RLS on `recipes` and `recipe_ingredients` active. `auth.uid()` check at the top of the function rejects unauthenticated callers with `42501` before any writes.

## Migration path

`supabase db push --linked` (not MCP `apply_migration` — per CLAUDE.md).

## Dropped: 42703 column-not-found fallback

The old code had a retry path that stripped `allergens`, `caffeine_mg`, and `alcohol_g` if Postgres returned `42703 (column does not exist)`. All three columns are present in production (migrated months ago). The RPC assumes all columns exist; no fallback needed.
