import type { DeckCoordinationStatus } from "@adadex/core";
import { useId } from "react";

/**
 * Soft, rounded mascot with a few moods. The body color is tinted from the agent's color so
 * every agent stays recognisable, while the face plate and eyes stay constant.
 */
export type CuteMascotState = "idle" | "working" | "happy" | "sleeping" | "worried";

/** Which mood the mascot shows for each agent status. */
export const MASCOT_STATE_FOR_STATUS: Record<DeckCoordinationStatus, CuteMascotState> = {
  idle: "sleeping",
  active: "working",
  "needs-review": "happy",
  blocked: "worried",
};

type CuteMascotProps = {
  state?: CuteMascotState;
  color?: string;
  size?: number;
  className?: string;
  title?: string;
};

const FACE = "#fdf3e3";

const INK = "#241b2f";

const Eyes = ({ state }: { state: CuteMascotState }) => {
  if (state === "happy") {
    return (
      <g fill="none" stroke={INK} strokeLinecap="round" strokeWidth="4.5">
        <path d="M75 100 Q84 88 93 100" />
        <path d="M107 100 Q116 88 125 100" />
      </g>
    );
  }

  if (state === "sleeping") {
    return (
      <g fill="none" stroke={INK} strokeLinecap="round" strokeWidth="4">
        <path d="M75 98 Q84 107 93 98" />
        <path d="M107 98 Q116 107 125 98" />
      </g>
    );
  }

  // Open eyes: glossy ovals with a highlight. "working" glances sideways, "worried" is smaller.
  const shiftX = state === "working" ? 5 : 0;
  const ry = state === "worried" ? 9 : 11.5;
  const rx = state === "worried" ? 6.5 : 8.5;

  return (
    <g className="cm-eyes">
      <ellipse cx={84 + shiftX} cy="98" fill={INK} rx={rx} ry={ry} />
      <ellipse cx={116 + shiftX} cy="98" fill={INK} rx={rx} ry={ry} />
      <circle cx={86.5 + shiftX} cy="93" fill="#fff" r="3" />
      <circle cx={118.5 + shiftX} cy="93" fill="#fff" r="3" />
      <circle cx={82 + shiftX} cy="103" fill="#fff" opacity="0.55" r="1.6" />
      <circle cx={114 + shiftX} cy="103" fill="#fff" opacity="0.55" r="1.6" />
      {state === "worried" ? (
        <g fill="none" stroke={INK} strokeLinecap="round" strokeWidth="3.2">
          <path d="M74 82 L92 87" />
          <path d="M126 82 L108 87" />
        </g>
      ) : null}
    </g>
  );
};

export const CuteMascot = ({
  state = "idle",
  color = "#b79cf0",
  size = 96,
  className,
  title,
}: CuteMascotProps) => {
  const gradientId = useId();
  const bodyId = `${gradientId}-body`;
  const armId = `${gradientId}-arm`;
  const isSleeping = state === "sleeping";
  const base = `color-mix(in srgb, ${color} 62%, white)`;
  const bodyTop = `color-mix(in srgb, ${base} 70%, white)`;
  const bodyBottom = `color-mix(in srgb, ${base} 88%, #6a4fb3)`;
  const armTop = `color-mix(in srgb, ${base} 78%, white)`;
  const armBottom = `color-mix(in srgb, ${base} 94%, #6a4fb3)`;

  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={`cute-mascot cute-mascot--${state}${className ? ` ${className}` : ""}`}
      height={size}
      role={title ? "img" : undefined}
      viewBox="0 0 200 220"
      width={size}
    >
      <defs>
        <linearGradient id={bodyId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={bodyTop} />
          <stop offset="100%" stopColor={bodyBottom} />
        </linearGradient>
        <linearGradient id={armId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={armTop} />
          <stop offset="100%" stopColor={armBottom} />
        </linearGradient>
      </defs>

      <ellipse
        className="cm-shadow"
        cx="100"
        cy="206"
        fill="#2a1d44"
        opacity="0.14"
        rx="56"
        ry="7"
      />

      <g className="cm-figure" transform={isSleeping ? "translate(0 22) scale(1 0.84)" : undefined}>
        <g className="cm-bob">
          {/* Antenna */}
          <g className="cm-antenna" transform={isSleeping ? "rotate(-14 98 32)" : undefined}>
            <path
              d="M98 34 L88 16"
              fill="none"
              stroke={`url(#${armId})`}
              strokeLinecap="round"
              strokeWidth="6"
            />
            <circle className="cm-antenna-ball" cx="85" cy="12" fill={`url(#${armId})`} r="10" />
            <circle cx="82" cy="8.5" fill="#fff" opacity="0.45" r="3" />
          </g>

          {/* Body with two little feet */}
          <path
            d="M38 122 C38 58 66 30 100 30 C134 30 162 58 162 122 L162 176 C162 190 152 198 140 198 C128 198 122 192 118 184 C114 178 108 174 100 174 C92 174 86 178 82 184 C78 192 72 198 60 198 C48 198 38 190 38 176 Z"
            fill={`url(#${bodyId})`}
          />
          <path
            d="M52 100 C52 66 72 44 96 40"
            fill="none"
            opacity="0.35"
            stroke="#fff"
            strokeLinecap="round"
            strokeWidth="5"
          />

          {/* Face plate */}
          <ellipse cx="100" cy="98" fill={FACE} rx="50" ry="41" />
          <ellipse cx="100" cy="132" fill="#000" opacity="0.04" rx="42" ry="8" />

          <Eyes state={state} />

          {/* Cheeks for the happy mood */}
          {state === "happy" ? (
            <g fill="#ff9fb4" opacity="0.55">
              <ellipse cx="70" cy="112" rx="7" ry="4.5" />
              <ellipse cx="130" cy="112" rx="7" ry="4.5" />
            </g>
          ) : null}

          {/* Arms */}
          <ellipse
            cx="46"
            cy={isSleeping ? 150 : 142}
            fill={`url(#${armId})`}
            rx="17"
            ry="21"
            transform={`rotate(-18 46 ${isSleeping ? 150 : 142})`}
          />
          {state === "happy" ? (
            <g className="cm-wave">
              <ellipse
                cx="162"
                cy="96"
                fill={`url(#${armId})`}
                rx="15"
                ry="22"
                transform="rotate(28 162 96)"
              />
            </g>
          ) : (
            <ellipse
              cx="154"
              cy={isSleeping ? 150 : 142}
              fill={`url(#${armId})`}
              rx="17"
              ry="21"
              transform={`rotate(18 154 ${isSleeping ? 150 : 142})`}
            />
          )}
        </g>
      </g>

      {/* Mood extras */}
      {state === "happy" ? (
        <g
          className="cm-sparkle"
          fill="none"
          stroke={`color-mix(in srgb, ${color} 80%, #6a4fb3)`}
          strokeLinecap="round"
          strokeWidth="4"
        >
          <path d="M176 52 L186 44" />
          <path d="M182 66 L194 64" />
          <path d="M168 40 L170 28" />
        </g>
      ) : null}
      {state === "sleeping" ? (
        <g
          className="cm-zzz"
          fill={`color-mix(in srgb, ${color} 80%, #6a4fb3)`}
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="700"
        >
          <text fontSize="22" x="150" y="62">
            z
          </text>
          <text fontSize="15" x="172" y="42">
            z
          </text>
        </g>
      ) : null}
      {state === "working" ? (
        <g className="cm-dots" fill={`color-mix(in srgb, ${color} 80%, #6a4fb3)`}>
          <circle cx="156" cy="38" r="4.5" />
          <circle cx="170" cy="38" r="4.5" />
          <circle cx="184" cy="38" r="4.5" />
        </g>
      ) : null}
      {state === "worried" ? (
        <path
          d="M158 70 C158 70 150 82 150 88 C150 93 154 96 158 96 C162 96 166 93 166 88 C166 82 158 70 158 70 Z"
          fill="#8fd0f5"
          opacity="0.9"
        />
      ) : null}
    </svg>
  );
};
