/**
 * Integration tests for DELETE /api/account/delete.
 * Tests the auth gate and service key gate — the actual deletion
 * logic is tested indirectly since full Supabase mocking is complex.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));

// ENG-1539 — mock the Stripe SDK so no live API is ever hit. `new Stripe(key)`
// (via the route's getStripe()) returns an instance exposing controllable
// subscriptions.list / subscriptions.cancel.
const { stripeList, stripeCancel, stripeCtor } = vi.hoisted(() => ({
  stripeList: vi.fn(),
  stripeCancel: vi.fn(),
  stripeCtor: vi.fn(),
}));
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation((key: string) => {
    stripeCtor(key);
    return { subscriptions: { list: stripeList, cancel: stripeCancel } };
  }),
}));

import { DELETE } from "../../app/api/account/delete/route";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";

const mockGetUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockCreateServiceClient = createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>;

function mockRequest(): Request {
  return new Request("http://localhost/api/account/delete", { method: "DELETE" });
}

describe("DELETE /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Non-Stripe tests must see NO Stripe key so getStripe() returns null
    // and step 5c is skipped entirely (deterministic regardless of ambient
    // env). The Stripe describe below sets the key explicitly.
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await DELETE(mockRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unauthorized");
  });

  it("returns 503 when service role key is not configured", async () => {
    mockGetUserId.mockResolvedValue("user-123");
    mockCreateServiceClient.mockReturnValue(null);
    const res = await DELETE(mockRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  // H3 fix (2026-04-21): if any data-delete fails, auth.admin.deleteUser
  // must NOT be called and the response must be 500 with details.
  it("returns 500 and does NOT delete the auth user when a prior table delete fails", async () => {
    mockGetUserId.mockResolvedValue("user-123");

    const authDeleteUser = vi.fn(() => Promise.resolve({ error: null }));

    // Supabase client stub: first data-delete (meal_plan_days read) ok,
    // meal_plan_days DELETE returns a fatal error.
    // Thenable that also exposes chainable .eq/.in (supabase filter chains).
    function chainable(result: { data: unknown; error: unknown }) {
      const p: any = Promise.resolve(result);
      p.eq = () => chainable(result);
      p.in = () => chainable(result);
      return p;
    }
    const okEmpty = () => chainable({ data: [], error: null });
    const okNull = () => chainable({ data: null, error: null });
    const fatal = () =>
      chainable({ data: null, error: { message: "connection reset", code: "08006" } });

    const client = {
      from: vi.fn((table: string) => {
        if (table === "meal_plan_days") {
          return {
            select: vi.fn(() => ({ eq: vi.fn(() => okEmpty()) })),
            delete: vi.fn(() => ({ eq: vi.fn(() => fatal()) })),
          };
        }
        // Every other table succeeds with a no-op. select+eq chains must
        // themselves support .eq / chaining (e.g. recipes.select().eq().eq()).
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => okEmpty()) })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => okNull()),
            in: vi.fn(() => okNull()),
          })),
          update: vi.fn(() => ({ eq: vi.fn(() => okNull()) })),
        };
      }),
      auth: { admin: { deleteUser: authDeleteUser } },
      // P1 (2026-05-11): food-evidence storage cleanup expects sb.storage
      // to exist. Return an empty list so the storage step is a no-op
      // and the meal_plan_days failure is the only error surfaced.
      storage: {
        from: vi.fn(() => ({
          list: vi.fn(() => Promise.resolve({ data: [], error: null })),
          remove: vi.fn(() => Promise.resolve({ error: null })),
        })),
      },
    };
    mockCreateServiceClient.mockReturnValue(client as never);

    const res = await DELETE(mockRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("deletion_incomplete");
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.some((d: string) => d.startsWith("meal_plan_days:"))).toBe(true);
    // Critical: auth user was NOT deleted.
    expect(authDeleteUser).not.toHaveBeenCalled();
  });

  // P1 (2026-05-11, security review): food-evidence storage objects under
  // `{userId}/...` MUST be cleaned up during account delete. FK cascades
  // handle DB tables, but storage objects are not FK-cascaded.
  it("lists + removes food-evidence storage objects for the user", async () => {
    mockGetUserId.mockResolvedValue("user-evidence-test");
    const touchedTables: string[] = [];

    function chainable(result: { data: unknown; error: unknown }) {
      const p: any = Promise.resolve(result);
      p.eq = () => chainable(result);
      p.in = () => chainable(result);
      return p;
    }
    const okEmpty = () => chainable({ data: [], error: null });
    const okMealPlanDays = () => chainable({ data: [{ id: "plan-day-1" }], error: null });
    const okNull = () => chainable({ data: null, error: null });

    const listFn = vi.fn(() =>
      Promise.resolve({
        data: [
          { name: "label-photo-1.jpg" },
          { name: "label-photo-2.jpg" },
        ],
        error: null,
      }),
    );
    const removeFn = vi.fn(() => Promise.resolve({ error: null }));
    const storageFrom = vi.fn(() => ({ list: listFn, remove: removeFn }));

    const client = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => {
          touchedTables.push(table);
          return { eq: vi.fn(() => (table === "meal_plan_days" ? okMealPlanDays() : okEmpty())) };
        }),
        delete: vi.fn(() => {
          touchedTables.push(table);
          return {
            eq: vi.fn(() => okNull()),
            in: vi.fn(() => okNull()),
          };
        }),
        update: vi.fn(() => {
          touchedTables.push(table);
          return { eq: vi.fn(() => okNull()) };
        }),
      })),
      auth: { admin: { deleteUser: vi.fn(() => Promise.resolve({ error: null })) } },
      storage: { from: storageFrom },
    };
    mockCreateServiceClient.mockReturnValue(client as never);

    const res = await DELETE(mockRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(storageFrom).toHaveBeenCalledWith("food-evidence");
    expect(listFn).toHaveBeenCalledWith("user-evidence-test", { limit: 1000 });
    expect(removeFn).toHaveBeenCalledWith([
      "user-evidence-test/label-photo-1.jpg",
      "user-evidence-test/label-photo-2.jpg",
    ]);
    expect(touchedTables).not.toContain("meal_plans");
    expect(touchedTables).not.toContain("meal_plans_legacy");
    expect(touchedTables).toContain("meal_plan_days");
    expect(touchedTables).toContain("meal_plan_meals");
  });

  it("treats a missing food-evidence bucket as a no-op (does not block auth delete)", async () => {
    mockGetUserId.mockResolvedValue("user-no-bucket");

    function chainable(result: { data: unknown; error: unknown }) {
      const p: any = Promise.resolve(result);
      p.eq = () => chainable(result);
      p.in = () => chainable(result);
      return p;
    }
    const okEmpty = () => chainable({ data: [], error: null });
    const okNull = () => chainable({ data: null, error: null });

    const authDeleteUser = vi.fn(() => Promise.resolve({ error: null }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => okEmpty()) })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => okNull()),
          in: vi.fn(() => okNull()),
        })),
        update: vi.fn(() => ({ eq: vi.fn(() => okNull()) })),
      })),
      auth: { admin: { deleteUser: authDeleteUser } },
      storage: {
        from: vi.fn(() => ({
          list: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { message: "Bucket not found" },
            }),
          ),
          remove: vi.fn(() => Promise.resolve({ error: null })),
        })),
      },
    };
    mockCreateServiceClient.mockReturnValue(client as never);

    const res = await DELETE(mockRequest());
    expect(res.status).toBe(200);
    expect(authDeleteUser).toHaveBeenCalledOnce();
  });
});

// ENG-1539 — a deleted Pro user was still being charged because the cascade
// never cancelled their Stripe subscription. These pin the fix without
// touching live Stripe (the SDK is mocked at the top of this file).
describe("DELETE /api/account/delete — Stripe subscription cancellation (ENG-1539)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    stripeCancel.mockResolvedValue({});
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });

  /** Spy on the `profiles` row delete so tests can assert ordering: the
   *  profile row (which carries stripe_customer_id) must survive an aborted
   *  deletion so a retry can still read the id and cancel the sub. */
  let profileDelete: ReturnType<typeof vi.fn>;

  /** Supabase client stub where `profiles` carries a stripe_customer_id and
   *  every other table succeeds as a no-op. */
  function clientWithCustomer(
    customerId: string | null,
    authDeleteUser: ReturnType<typeof vi.fn>,
  ) {
    function chainable(result: { data: unknown; error: unknown }) {
      const p: any = Promise.resolve(result);
      p.eq = () => chainable(result);
      p.in = () => chainable(result);
      return p;
    }
    const okEmpty = () => chainable({ data: [], error: null });
    const okNull = () => chainable({ data: null, error: null });
    const okBilling = () =>
      chainable({ data: [{ stripe_customer_id: customerId }], error: null });
    profileDelete = vi.fn(() => ({ eq: vi.fn(() => okNull()) }));

    return {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            // step 5c reads stripe_customer_id; the row delete now runs only
            // AFTER the error gate (ENG-1539 review fix).
            select: vi.fn(() => ({ eq: vi.fn(() => okBilling()) })),
            delete: profileDelete,
          };
        }
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => okEmpty()) })),
          delete: vi.fn(() => ({ eq: vi.fn(() => okNull()), in: vi.fn(() => okNull()) })),
          update: vi.fn(() => ({ eq: vi.fn(() => okNull()) })),
        };
      }),
      auth: { admin: { deleteUser: authDeleteUser } },
      storage: {
        from: vi.fn(() => ({
          list: vi.fn(() => Promise.resolve({ data: [], error: null })),
          remove: vi.fn(() => Promise.resolve({ error: null })),
        })),
      },
    };
  }

  it("cancels the customer's non-terminal subscriptions before deleting the auth user", async () => {
    mockGetUserId.mockResolvedValue("user-pro");
    const authDeleteUser = vi.fn(() => Promise.resolve({ error: null }));
    mockCreateServiceClient.mockReturnValue(clientWithCustomer("cus_123", authDeleteUser) as never);
    // One active sub (must cancel) + one already-canceled (must skip).
    stripeList.mockResolvedValue({
      data: [
        { id: "sub_active", status: "active" },
        { id: "sub_dead", status: "canceled" },
      ],
    });

    const res = await DELETE(mockRequest());
    expect(res.status).toBe(200);

    // Looked up by the persisted customer id.
    expect(stripeList).toHaveBeenCalledWith({
      customer: "cus_123",
      status: "all",
      limit: 100,
    });
    // Only the live subscription is cancelled; the terminal one is skipped.
    expect(stripeCancel).toHaveBeenCalledTimes(1);
    expect(stripeCancel).toHaveBeenCalledWith("sub_active");
    // Auth user removed only after billing was stopped.
    expect(authDeleteUser).toHaveBeenCalledOnce();
  });

  it("aborts the deletion (500, no auth delete) when Stripe cancel fails", async () => {
    mockGetUserId.mockResolvedValue("user-pro");
    const authDeleteUser = vi.fn(() => Promise.resolve({ error: null }));
    mockCreateServiceClient.mockReturnValue(clientWithCustomer("cus_123", authDeleteUser) as never);
    stripeList.mockResolvedValue({ data: [{ id: "sub_active", status: "active" }] });
    stripeCancel.mockRejectedValue(new Error("card_declined_gateway_down"));

    const res = await DELETE(mockRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("deletion_incomplete");
    expect(body.details.some((d: string) => d.startsWith("stripe_subscription_cancel:"))).toBe(true);
    // Critical: billing not stopped → auth user must NOT be deleted.
    expect(authDeleteUser).not.toHaveBeenCalled();
    // ENG-1539 review fix: the profile row (which holds stripe_customer_id)
    // must also survive, so the idempotent retry can still read the id and
    // re-attempt the cancel. If the profile were deleted here, the retry would
    // find no customer, skip the cancel, and delete the account with the sub
    // still billing — the exact bug this issue fixes, reintroduced on retry.
    expect(profileDelete).not.toHaveBeenCalled();
  });

  it("skips Stripe entirely when the user has no stripe_customer_id", async () => {
    mockGetUserId.mockResolvedValue("user-free");
    const authDeleteUser = vi.fn(() => Promise.resolve({ error: null }));
    mockCreateServiceClient.mockReturnValue(clientWithCustomer(null, authDeleteUser) as never);

    const res = await DELETE(mockRequest());
    expect(res.status).toBe(200);
    expect(stripeList).not.toHaveBeenCalled();
    expect(stripeCancel).not.toHaveBeenCalled();
    expect(authDeleteUser).toHaveBeenCalledOnce();
  });

  it("skips Stripe gracefully when STRIPE_SECRET_KEY is unset (dev)", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    mockGetUserId.mockResolvedValue("user-pro");
    const authDeleteUser = vi.fn(() => Promise.resolve({ error: null }));
    mockCreateServiceClient.mockReturnValue(clientWithCustomer("cus_123", authDeleteUser) as never);

    const res = await DELETE(mockRequest());
    expect(res.status).toBe(200);
    // getStripe() returned null → SDK never constructed, no list/cancel.
    expect(stripeCtor).not.toHaveBeenCalled();
    expect(stripeList).not.toHaveBeenCalled();
    expect(authDeleteUser).toHaveBeenCalledOnce();
  });
});
