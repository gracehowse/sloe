# How your calorie target works

**Audience:** End Users

Every day, Suppr shows you a calorie target and a "maintenance" number — the
calories you'd burn on a quiet day. This page explains, in plain English, where
those numbers come from and how they change over time. You can see a short
version of this any time inside the app: open **Daily targets** and tap **How is
this calculated?**

## The short version

1. **We start from your stats.** Your height, weight, age and sex give us a first
   estimate of the calories you'd burn on a quiet day.
2. **Then we learn from you.** As you log meals and weigh in, we watch what you
   actually eat and how your weight responds, and we adjust your number to match.
   This is the most reliable signal there is — it's what the serious coaching
   apps use too.
3. **Partly-logged days don't count.** A day where it looks like you only logged a
   snack doesn't get used for learning — so a forgotten dinner can never drag
   your number down.
4. **Your Watch helps, in its lane.** If you wear an Apple Watch, your workouts
   and activity get added to *today's* budget the day you earn them, and we use
   its resting-burn reading as a sanity check. We don't average workout calories
   into your everyday baseline.
5. **It moves gently.** Your number updates gradually as we learn, and it never
   drifts outside a sensible range of your starting estimate.

## Where your first number comes from

When you finish onboarding, you don't have any logged days yet, so we estimate
your maintenance from your height, weight, age and sex. This is a well-
established formula and it's a solid starting point — but it can only ever be an
estimate, because two people with the same stats can burn quite different amounts.
That's why we don't stop there.

While you're in this phase, your target is based on your **stated goal and pace**
(for example, "lose 0.5 kg a week"). The app will say it's still *calibrating* and
show you exactly what's left — usually "keep logging meals" and "weigh in a few
times".

## How we learn your real number

Once you've logged enough full days and weighed in a few times, we start learning
your *actual* maintenance from your own data: how much you ate, and which way the
scale moved. Over time this is far more accurate than any formula, because it
reflects your real metabolism, your real activity, and your real eating — not an
average of people who share your stats.

You'll see your number described as **learned from your logging**, and once we
know it well, the "early estimate" label drops away.

### Why a forgotten dinner won't hurt your number

This is the part most apps get wrong. If learning simply averaged *every* day,
then a day where you forgot to log dinner would look like a day you barely ate —
and your maintenance number would quietly fall, which would quietly cut your
target. That's frustrating and wrong.

So we only learn from days that look **fully logged**. A day that looks
half-finished is set aside — it doesn't pull your number in either direction. The
trade-off is that learning is a little slower if you log in bursts (you'll see
something like "learned from your 9 fully-logged days"), but the number you get is
one you can trust.

## What your Apple Watch does (and doesn't) do

If you wear an Apple Watch, you might expect it to set your calorie burn directly.
We deliberately don't do that, and here's the honest reason: wearables are
excellent at heart rate and steps, but their estimate of *calories burned during
exercise* is the least reliable number they produce — it can be off by a lot.

So we give your Watch the jobs it's genuinely good at:

- **Today's activity bonus.** Workouts and movement add to *today's* budget on the
  day you do them. Earn a hard session, eat a bit more that day — without it ever
  affecting your everyday baseline.
- **A sanity check.** We use your Watch's resting-burn reading as a floor, to
  catch any number that drifts implausibly low.

What we don't do is fold your workout calories into your baseline maintenance,
because that would both lean on the Watch's weakest number and double-count the
activity you've already been credited for that day.

## How your number changes over time

Your maintenance number isn't fixed. As your weight changes and your logging
builds up, it updates gradually — never in big jumps, and never outside a sensible
range of your original estimate. If you stop logging or weighing in for a couple
of weeks, we quietly fall back to the formula estimate until you're back, rather
than letting an old number get stale.

You can re-derive your numbers any time from **Daily targets → Recalculate**, and
change your goal or pace from **Daily targets → Edit**.

## A note on accuracy

Every number in Suppr is an estimate, including this one. We use the widely-used
figure of roughly 7,700 kcal to a kilogram of body mass, and we apply safety
floors based on public health guidance. Suppr is a tool to help you plan, not a
substitute for medical advice — please talk to your doctor before making a
significant change to how you eat, especially if you're pregnant, under 18, or
managing a health condition.

## Where this comes from

The method behind these numbers — and the evidence we weighed in choosing it — is
written up for the curious in the repository:

- Decision: [`docs/decisions/2026-06-10-adaptive-tdee-gating.md`](../decisions/2026-06-10-adaptive-tdee-gating.md)
- Methodology survey: [`docs/ux/research/2026-06-10-tdee-methodology-survey.md`](../ux/research/2026-06-10-tdee-methodology-survey.md)

## Related documents

- [Getting Started](getting-started.md)
- [Product Overview](../product/overview.md)

