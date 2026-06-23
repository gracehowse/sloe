import { forwardRef } from "react";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Line,
  Text as SvgText,
  TSpan,
} from "react-native-svg";
import { FontFamily } from "@/constants/theme";

/**
 * WeeklyRecapCard (mobile, ENG-1225 #4) — the react-native-svg mirror of the web
 * `src/app/components/suppr/weekly-recap-card.tsx`: the shareable Sloe weekly
 * recap on the v3 "brand lacquer" surface (deep-plum gradient + frost bloom,
 * `Sloe-App.html` L2404-2406). One `<Svg>` so the share path can rasterise it
 * to a PNG via the ref's `toDataURL()` (no extra native dep). Visual + colours
 * mirror web 1:1 for cross-platform parity.
 */
export interface WeeklyRecapCardProps {
  /** e.g. "16–22 Jun" */
  weekLabel: string;
  /** Days on target this week, 0–7. */
  onTargetDays: number;
  /** 7 daily calories (Mon→Sun) for the sparkline; null = no log that day. */
  dailyCalories: (number | null)[];
  /** Target calories — the sparkline baseline. */
  targetCalories: number;
  /** One-line narrative, e.g. "A steady, consistent week." */
  narrative: string;
  /** Square (1:1) for feed posts, or portrait (4:5) for stories. */
  ratio?: "square" | "portrait";
  /** px width of the rendered card (height derives from ratio). */
  width?: number;
}

// Card-specific brand-lacquer palette — mirrors the web card hexes EXACTLY
// (`weekly-recap-card.tsx` L34-38) so the shared artifact reads identically
// across platforms. A self-contained artifact palette, not the theme ramp.
const PLUM_A = "#6a4b7a";
const PLUM_B = "#3b2a4d";
const PLUM_C = "#1d1329";
const SAGE = "#93C08C";
const FROST = "#C9C2D6";
const OVER = "#E08A5F";
const WHITE = "#FFFFFF";

export const WeeklyRecapCard = forwardRef<Svg, WeeklyRecapCardProps>(
  function WeeklyRecapCard(
    {
      weekLabel,
      onTargetDays,
      dailyCalories,
      targetCalories,
      narrative,
      ratio = "portrait",
      width = 320,
    },
    ref,
  ) {
    const VW = 1080;
    const VH = ratio === "square" ? 1080 : 1350;
    const height = Math.round((width * VH) / VW);

    const plotX = 120;
    const plotW = VW - 240;
    const plotBottom = VH - 360;
    const plotH = 300;
    const maxCal = Math.max(
      targetCalories * 1.25,
      ...dailyCalories.map((d) => d ?? 0),
      1,
    );
    const barGap = 26;
    const barW = (plotW - barGap * 6) / 7;
    const targetY = plotBottom - (targetCalories / maxCal) * plotH;
    const shownNarrative =
      narrative.length > 52 ? `${narrative.slice(0, 51)}…` : narrative;

    return (
      <Svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${VW} ${VH}`}
        accessibilityLabel={`Sloe weekly recap, ${weekLabel}: ${onTargetDays} of 7 days on target. ${narrative}`}
      >
        <Defs>
          <LinearGradient id="wr-bg" x1="0" y1="0" x2="0.25" y2="1">
            <Stop offset="0%" stopColor={PLUM_A} />
            <Stop offset="64%" stopColor={PLUM_B} />
            <Stop offset="100%" stopColor={PLUM_C} />
          </LinearGradient>
          <RadialGradient id="wr-bloom" cx="50%" cy="-14%" r="80%">
            <Stop offset="0%" stopColor={FROST} stopOpacity="0.16" />
            <Stop offset="56%" stopColor={FROST} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="wr-bar" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={SAGE} />
            <Stop offset="100%" stopColor={SAGE} stopOpacity="0.55" />
          </LinearGradient>
        </Defs>

        {/* Lacquer ground + frost bloom */}
        <Rect x="0" y="0" width={VW} height={VH} fill="url(#wr-bg)" />
        <Rect x="0" y="0" width={VW} height={VH} fill="url(#wr-bloom)" />

        {/* Eyebrow */}
        <SvgText
          x="120"
          y="200"
          fill={WHITE}
          fillOpacity="0.62"
          fontSize="34"
          fontWeight="700"
          letterSpacing="6"
          fontFamily={FontFamily.sansBold}
        >
          {`YOUR WEEK · ${weekLabel.toUpperCase()}`}
        </SvgText>

        {/* Hero stat — on-target days, serif */}
        <SvgText
          x="120"
          y="430"
          fill={WHITE}
          fontSize="240"
          fontWeight="600"
          fontFamily={FontFamily.serifSemibold}
        >
          {String(onTargetDays)}
          <TSpan fontSize="120" fillOpacity="0.7">
            /7
          </TSpan>
        </SvgText>
        <SvgText
          x="120"
          y="510"
          fill={WHITE}
          fillOpacity="0.82"
          fontSize="46"
          fontWeight="500"
          fontFamily={FontFamily.sansMedium}
        >
          days on target
        </SvgText>

        {/* Narrative */}
        <SvgText
          x="120"
          y="620"
          fill={WHITE}
          fillOpacity="0.78"
          fontSize="40"
          fontStyle="italic"
          fontFamily={FontFamily.serifItalic}
        >
          {shownNarrative}
        </SvgText>

        {/* Target baseline */}
        <Line
          x1={plotX}
          y1={targetY}
          x2={plotX + plotW}
          y2={targetY}
          stroke={WHITE}
          strokeOpacity="0.28"
          strokeWidth="3"
          strokeDasharray="10 12"
        />

        {/* 7-day sparkline */}
        {dailyCalories.map((cal, i) => {
          const x = plotX + i * (barW + barGap);
          if (cal == null || cal <= 0) {
            return (
              <Rect
                key={i}
                x={x}
                y={plotBottom - 8}
                width={barW}
                height={8}
                rx={4}
                fill={WHITE}
                fillOpacity="0.18"
              />
            );
          }
          const h = Math.max(10, (cal / maxCal) * plotH);
          const over = cal > targetCalories;
          return (
            <Rect
              key={i}
              x={x}
              y={plotBottom - h}
              width={barW}
              height={h}
              rx={12}
              fill={over ? OVER : "url(#wr-bar)"}
            />
          );
        })}
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <SvgText
            key={i}
            x={plotX + i * (barW + barGap) + barW / 2}
            y={plotBottom + 56}
            fill={WHITE}
            fillOpacity="0.5"
            fontSize="32"
            fontFamily={FontFamily.sansRegular}
            textAnchor="middle"
          >
            {d}
          </SvgText>
        ))}

        {/* Watermark */}
        <SvgText
          x={VW / 2}
          y={VH - 90}
          fill={WHITE}
          fillOpacity="0.7"
          fontSize="42"
          fontWeight="600"
          letterSpacing="2"
          fontFamily={FontFamily.serifSemibold}
          textAnchor="middle"
        >
          sloe.co
        </SvgText>
      </Svg>
    );
  },
);

export default WeeklyRecapCard;
