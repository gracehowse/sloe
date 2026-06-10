# Progress — Figma frame `492:2` spec

**Frame PNG (READ FIRST):** `docs/ux/redesign/frames/progress-492-2.png`
Source: Figma `B3UdOFup7ITersgNuoXh0l` node `492:2`.

## Tokens
Cream `#F6F5F2` · plum `#3B2A4D` · body grey `#6A6072` · clay `#C8794E` · sage/protein `#7C8466` · amber/fat `#C9892C` · teal/fibre · lilac insight bg. Newsreader for big numbers + headings; Inter for labels.

## Layout (top → bottom)
1. **Header:** "Sloe" wordmark + avatar.
2. **"Progress"** (Newsreader ~30px plum) + subtitle "You're trending right where you want to be." (grey).
3. **Time toggle** — 4 pills: `7d` / `30d`(active = plum fill, white) / `90d` / `All`.
4. **"THIS WEEK" insight card** — **lilac** bg, rounded-24: sparkle icon + "THIS WEEK" eyebrow (clay, uppercase, tracked) + headline "Down 0.4 kg — and steady" (Newsreader) + supporting paragraph (grey).
5. **AVERAGE ADHERENCE card** (cream, rounded-24): "AVERAGE ADHERENCE" eyebrow + big **"94%"** (Newsreader, % smaller) left, trend "↗ up 6%" + a 5-dot streak (sage filled) right. Then **4 labelled macro bars**: Protein 95% (sage), Carbs 88% (clay), Fat 102% · over (amber), Fibre 70% (teal). Each = label left, value right, full-width progress bar below.
6. **Weight card** (cream, rounded-24): "74.2 kg ↓0.4 this week" (Newsreader) + "Trend/Scale" segmented toggle (top-right). "Goal 72.0 kg · on track for ~5 Jan" (grey). **Line chart** (clay line, soft fill, dashed goal line). 4-stat row: START 76.0 / CURRENT 74.2 / GOAL 72.0 / RATE −0.4/wk (Inter labels uppercase, Newsreader-ish values). "＋ Log weight" centered button.
7. **3-stat triad** (three cream cells): AVG INTAKE 1,840 / EST. TDEE 2,250 (sage value, "ADAPTIVE" sub-label) / DEFICIT −410 (sage).
8. **DAILY CALORIES card** (cream): "DAILY CALORIES" eyebrow + "1,840 avg" (Newsreader) + "● goal" legend. **Bar chart** M–S, bars **sage = on target / amber = over**, small goal dot above each. Legend "● On target ● Over".
9. **On-target ribbon** (cream, rounded, medal icon): "6 on-target days this week / Your most consistent week this month."
10. Tab bar (Progress active).

## Biggest deltas vs current app
Capture the current `/progress` first (deep link `suppr:///progress`) and diff against the frame. Likely deltas (from tracker): insight card not lilac / wrong copy treatment; adherence card missing the 4 macro bars or the dot streak; weight card chart styling + Trend/Scale toggle; the AVG/TDEE/DEFICIT triad styling; daily-calories bar colours (sage/amber) + goal dots; on-target ribbon. Match each section's structure, hierarchy, and colour.

## Preserve (wired — never drop)
Time-range switching, adherence calc, weight logging + trend/scale toggle, adaptive-TDEE values, deficit logic, daily-calorie data, on-target-days count, any empty states.
