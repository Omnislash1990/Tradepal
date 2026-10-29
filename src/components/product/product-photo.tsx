import type { ImageKey } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

type Tone = { face: string; edge: string; accent: string; label: string };

function n(s: string) {
  return s.toLowerCase();
}

function toneFromName(name: string, imageKey: string): Tone {
  const t = n(name);
  if (t.includes("moisture") || t.includes("green board")) return { face: "#8fb05a", edge: "#6a8a3e", accent: "#4e682c", label: "#3d5222" };
  if (t.includes("fire")) return { face: "#e7a3b4", edge: "#c47d90", accent: "#a35d70", label: "#7a3e4e" };
  if (t.includes("acoustic")) return { face: "#8a9bb8", edge: "#6b7c98", accent: "#4f6080", label: "#3a4a64" };
  if (t.includes("magnolia")) return { face: "#f3ead2", edge: "#d9c9a4", accent: "#c4b087", label: "#7a6a48" };
  if (t.includes("mist") || (t.includes("grey") && t.includes("emulsion"))) return { face: "#c5ccd4", edge: "#9aa3ae", accent: "#7b8590", label: "#4a5560" };
  if (t.includes("oak")) return { face: "#c48a4a", edge: "#9a6630", accent: "#7a4e22", label: "#5a3818" };
  if (t.includes("osb")) return { face: "#d4a85a", edge: "#b0863c", accent: "#8a6428", label: "#5c4218" };
  if (t.includes("plywood") || t.includes("ply ")) return { face: "#d8b078", edge: "#b89058", accent: "#967040", label: "#6a4e28" };
  if (t.includes("mdf")) return { face: "#d9cbb0", edge: "#b8aa90", accent: "#9a8c74", label: "#6a5e4a" };
  if (t.includes("pir") || t.includes("foil")) return { face: "#d8dce2", edge: "#b0b6c0", accent: "#f0c24a", label: "#4a5568" };
  if (t.includes("cement backer") || t.includes("backer board")) return { face: "#c5c8cc", edge: "#9ea2a8", accent: "#7a7e84", label: "#4a4e54" };
  if (t.includes("treated") || t.includes("decking") || t.includes("fence post") || t.includes("cls"))
    return { face: "#c4a46a", edge: "#9a7e48", accent: "#6e8a3a", label: "#4a3a22" };
  if (t.includes("red") && t.includes("brick")) return { face: "#b5523a", edge: "#8a3a28", accent: "#c46a4a", label: "#5a2418" };
  if (t.includes("buff")) return { face: "#d4b888", edge: "#b89868", accent: "#9a7a4c", label: "#6a5430" };
  if (t.includes("chrome")) return { face: "#d0d6dc", edge: "#9aa4ae", accent: "#6a7884", label: "#3a4650" };
  if (t.includes("copper")) return { face: "#c47a48", edge: "#a05e32", accent: "#8a4a24", label: "#5a3018" };
  if (t.includes("porcelain") || (t.includes("floor tile") && t.includes("grey")))
    return { face: "#8a9098", edge: "#6a7078", accent: "#4a5058", label: "#2a3038" };
  if (t.includes("metro")) return { face: "#f4f6f8", edge: "#c8ced4", accent: "#1769d2", label: "#172b4d" };
  if (t.includes("white gloss") || t.includes("ceramic wall")) return { face: "#f7f8fa", edge: "#cdd3da", accent: "#1769d2", label: "#172b4d" };
  if (imageKey === "paint" && (t.includes("brilliant white") || t.includes("contract matt") || t.includes("satinwood")))
    return { face: "#f5f6f8", edge: "#c5ccd4", accent: "#1769d2", label: "#172b4d" };
  if (t.includes("adhesive") && t.includes("white")) return { face: "#f0f2f4", edge: "#c8ced4", accent: "#5a6570", label: "#3a4450" };
  if (t.includes("grout") && t.includes("white")) return { face: "#eceef0", edge: "#c4c8cc", accent: "#6a7078", label: "#3a4048" };
  if (t.includes("grout") || t.includes("adhesive")) return { face: "#9aa0a8", edge: "#6e747c", accent: "#4a5058", label: "#2e343c" };
  if (t.includes("plaster") && t.includes("hardwall")) return { face: "#c9b49a", edge: "#a89074", accent: "#8a7058", label: "#5a4834" };
  if (t.includes("bonding")) return { face: "#c2a888", edge: "#9e8668", accent: "#7a654c", label: "#4e4030" };
  if (t.includes("multi-finish") || t.includes("plaster")) return { face: "#e8dcc8", edge: "#c8b89c", accent: "#1769d2", label: "#3a4a28" };
  if (t.includes("cement") || t.includes("post mix")) return { face: "#8a9096", edge: "#6a7076", accent: "#c45c2a", label: "#2a3036" };
  if (t.includes("sharp sand")) return { face: "#d2b48c", edge: "#b09068", accent: "#8a6e48", label: "#5a4830" };
  if (t.includes("building sand")) return { face: "#c4a070", edge: "#9a7a50", accent: "#7a5e38", label: "#4a3820" };
  if (t.includes("ballast") || t.includes("mot") || t.includes("sub-base")) return { face: "#8a8680", edge: "#6a6660", accent: "#4a4640", label: "#2e2c28" };
  if (t.includes("insulation") && t.includes("loft")) return { face: "#f0d24a", edge: "#d4b430", accent: "#b89820", label: "#5a4a10" };
  if (t.includes("partition roll") || t.includes("acoustic partition")) return { face: "#e8c84a", edge: "#c8a830", accent: "#a88820", label: "#5a4810" };
  return { face: "#d8dee6", edge: "#a8b0bc", accent: "#1769d2", label: "#172b4d" };
}

function uid(prefix: string, seed: string) {
  return `${prefix}-${seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18) || "x"}`;
}

function Board({ tone, caption }: { tone: Tone; caption: string }) {
  return (
    <g>
      <path d="M78 92 L248 68 L278 228 L108 252 Z" fill={tone.face} stroke={tone.edge} strokeWidth="1.5" />
      <path d="M248 68 L268 82 L298 240 L278 228 Z" fill={tone.edge} />
      <path d="M108 252 L278 228 L298 240 L128 264 Z" fill={tone.accent} opacity="0.85" />
      <path d="M98 118 L238 96" stroke="white" strokeOpacity="0.25" strokeWidth="6" />
      <text x="168" y="168" textAnchor="middle" fill={tone.label} fontSize="11" fontWeight="700" fontFamily="ui-sans-serif, system-ui">
        {caption}
      </text>
    </g>
  );
}

function Sheet({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="86" y="78" width="148" height="168" rx="4" fill={tone.face} stroke={tone.edge} strokeWidth="2" transform="rotate(-8 160 160)" />
      <rect x="98" y="70" width="148" height="168" rx="4" fill={tone.edge} opacity="0.35" transform="rotate(-4 172 154)" />
      <rect x="110" y="64" width="148" height="168" rx="4" fill={tone.face} stroke={tone.edge} strokeWidth="2" />
      <path d="M122 88 L242 88 M122 108 L242 108 M122 128 L210 128" stroke={tone.edge} strokeOpacity="0.35" />
    </g>
  );
}

function Bag({ tone, caption }: { tone: Tone; caption: string }) {
  return (
    <g>
      <path d="M110 86 C118 70 202 70 210 86 L228 230 C228 252 92 252 92 230 Z" fill={tone.face} stroke={tone.edge} strokeWidth="2" />
      <path d="M118 92 C126 80 194 80 202 92" fill="none" stroke={tone.edge} strokeWidth="3" />
      <rect x="118" y="128" width="84" height="64" rx="4" fill="white" fillOpacity="0.92" />
      <text x="160" y="156" textAnchor="middle" fill={tone.label} fontSize="10" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
        {caption}
      </text>
      <text x="160" y="174" textAnchor="middle" fill={tone.accent} fontSize="9" fontFamily="ui-sans-serif, system-ui">
        25 kg
      </text>
    </g>
  );
}

function BulkBag({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M86 150 L110 86 L210 86 L234 150 L220 250 L100 250 Z" fill={tone.face} stroke={tone.edge} strokeWidth="2" />
      <path d="M110 86 L160 70 L210 86" fill={tone.edge} />
      <path d="M100 250 L160 268 L220 250" fill={tone.accent} />
      <path d="M124 110 L196 110 L208 148 L112 148 Z" fill="white" fillOpacity="0.2" />
    </g>
  );
}

function Timber({ tone }: { tone: Tone }) {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${18 * i} ${14 * i})`}>
          <path d="M54 150 L250 92 L266 118 L70 176 Z" fill={i === 2 ? tone.face : tone.edge} />
          <path d="M250 92 L258 84 L274 110 L266 118 Z" fill={tone.accent} />
          <ellipse cx="62" cy="163" rx="12" ry="16" fill={tone.accent} transform="rotate(-20 62 163)" />
        </g>
      ))}
    </g>
  );
}

function Trim({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M70 180 L250 110 L268 128 L88 198 Z" fill={tone.face} stroke={tone.edge} />
      <path d="M70 180 L88 198 L92 186 Z" fill={tone.accent} />
      <path d="M80 172 C120 150 160 200 250 118" fill="none" stroke={tone.accent} strokeWidth="3" />
    </g>
  );
}

function Tape({ tone }: { tone: Tone }) {
  return (
    <g>
      <ellipse cx="160" cy="168" rx="78" ry="78" fill={tone.face} stroke={tone.edge} strokeWidth="10" />
      <ellipse cx="160" cy="168" rx="32" ry="32" fill="#f4f6f8" stroke={tone.edge} strokeWidth="3" />
      <path d="M232 150 L280 138 L276 158 L230 166 Z" fill={tone.accent} />
    </g>
  );
}

function Tub({ tone }: { tone: Tone }) {
  return (
    <g>
      <ellipse cx="160" cy="112" rx="70" ry="22" fill={tone.edge} />
      <path d="M90 112 L102 230 A58 18 0 0 0 218 230 L230 112" fill={tone.face} stroke={tone.edge} />
      <ellipse cx="160" cy="112" rx="62" ry="16" fill="#f7f8fa" />
      <rect x="122" y="150" width="76" height="40" rx="4" fill="white" fillOpacity="0.9" />
    </g>
  );
}

function PaintCan({ tone, litres }: { tone: Tone; litres: number }) {
  const w = litres >= 10 ? 92 : litres >= 5 ? 78 : 64;
  const h = litres >= 10 ? 128 : litres >= 5 ? 112 : 96;
  const x = 160 - w / 2;
  const y = 210 - h;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill={tone.face} stroke={tone.edge} strokeWidth="2" />
      <rect x={x} y={y + 28} width={w} height={h * 0.42} fill={tone.accent} />
      <rect x={x + 8} y={y + 8} width={w - 16} height={16} rx="3" fill={tone.edge} />
      <ellipse cx="160" cy={y} rx={w / 2} ry="10" fill="#e8ecf0" stroke={tone.edge} />
      <text x="160" y={y + 54} textAnchor="middle" fill="white" fontSize="12" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
        {litres} L
      </text>
      <path d={`M${x + 12} ${y + 4} C${x + 20} ${y - 28} ${x + w - 20} ${y - 28} ${x + w - 12} ${y + 4}`} fill="none" stroke={tone.edge} strokeWidth="5" />
    </g>
  );
}

function Box({ tone, rows = 3 }: { tone: Tone; rows?: number }) {
  return (
    <g>
      <path d="M90 130 L160 100 L230 130 L160 160 Z" fill={tone.face} stroke={tone.edge} />
      <path d="M90 130 L90 210 L160 240 L160 160 Z" fill={tone.edge} />
      <path d="M230 130 L230 210 L160 240 L160 160 Z" fill={tone.accent} />
      {Array.from({ length: rows }).map((_, i) => (
        <rect key={i} x={108} y={148 + i * 14} width="44" height="8" rx="1" fill={tone.face} opacity="0.8" />
      ))}
    </g>
  );
}

function Pipe({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M64 168 C90 120 140 120 160 168 C180 216 230 216 256 168" fill="none" stroke={tone.face} strokeWidth="22" strokeLinecap="round" />
      <path d="M64 168 C90 120 140 120 160 168 C180 216 230 216 256 168" fill="none" stroke={tone.edge} strokeWidth="8" strokeLinecap="round" />
    </g>
  );
}

function Fitting({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="86" y="146" width="90" height="28" rx="6" fill={tone.face} stroke={tone.edge} />
      <rect x="160" y="86" width="28" height="90" rx="6" fill={tone.face} stroke={tone.edge} />
      <circle cx="174" cy="160" r="18" fill={tone.accent} />
    </g>
  );
}

function Valve({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="96" y="150" width="128" height="24" rx="8" fill={tone.face} stroke={tone.edge} />
      <circle cx="160" cy="132" r="28" fill={tone.accent} stroke={tone.edge} />
      <circle cx="160" cy="132" r="10" fill={tone.face} />
      <rect x="148" y="70" width="24" height="40" rx="4" fill={tone.edge} />
    </g>
  );
}

function Radiator({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="70" y="100" width="180" height="120" rx="8" fill={tone.face} stroke={tone.edge} strokeWidth="2" />
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} x={82 + i * 18} y="112" width="12" height="96" rx="2" fill={tone.edge} opacity="0.55" />
      ))}
    </g>
  );
}

function Cable({ tone }: { tone: Tone }) {
  return (
    <g>
      <ellipse cx="160" cy="168" rx="84" ry="84" fill={tone.face} stroke={tone.edge} strokeWidth="14" />
      <ellipse cx="160" cy="168" rx="40" ry="40" fill="#f4f6f8" />
      <rect x="148" y="78" width="24" height="40" rx="3" fill={tone.accent} />
    </g>
  );
}

function Socket({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="96" y="88" width="128" height="148" rx="10" fill="#f7f8fa" stroke={tone.edge} strokeWidth="3" />
      <rect x="118" y="118" width="36" height="28" rx="4" fill={tone.accent} />
      <rect x="166" y="118" width="36" height="28" rx="4" fill={tone.accent} />
      <circle cx="160" cy="186" r="16" fill={tone.face} stroke={tone.edge} />
    </g>
  );
}

function SwitchPlate({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="110" y="86" width="100" height="148" rx="10" fill="#f7f8fa" stroke={tone.edge} strokeWidth="3" />
      <rect x="142" y="132" width="36" height="56" rx="6" fill={tone.accent} />
    </g>
  );
}

function Downlight({ tone }: { tone: Tone }) {
  return (
    <g>
      <circle cx="160" cy="168" r="78" fill={tone.edge} />
      <circle cx="160" cy="168" r="52" fill="#f4e9c4" />
      <circle cx="160" cy="168" r="28" fill="#fff6d6" />
    </g>
  );
}

function ConsumerUnit({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="96" y="78" width="128" height="168" rx="6" fill="#eceff3" stroke={tone.edge} strokeWidth="3" />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={110 + (i % 2) * 50} y={96 + Math.floor(i / 2) * 34} width="40" height="26" rx="3" fill={tone.accent} opacity={0.7 + (i % 3) * 0.1} />
      ))}
    </g>
  );
}

function Junction({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="108" y="108" width="104" height="104" rx="8" fill={tone.face} stroke={tone.edge} strokeWidth="3" />
      <circle cx="160" cy="160" r="18" fill={tone.accent} />
    </g>
  );
}

function Drill({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M70 150 L170 138 L178 170 L78 182 Z" fill={tone.accent} />
      <path d="M168 128 L230 148 L218 188 L160 168 Z" fill={tone.face} stroke={tone.edge} />
      <path d="M150 168 L168 230 L196 220 L178 164" fill={tone.edge} />
      <rect x="226" y="150" width="40" height="14" rx="2" fill="#9aa3ae" />
    </g>
  );
}

function Saw({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M70 190 L230 110" stroke="#c5ccd4" strokeWidth="16" strokeLinecap="round" />
      <path d="M70 190 L230 110" stroke="#8a9098" strokeWidth="4" />
      <path d="M210 96 L268 140 L248 158 L196 118 Z" fill={tone.accent} />
    </g>
  );
}

function Measure({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="96" y="118" width="128" height="88" rx="10" fill={tone.accent} stroke={tone.edge} />
      <rect x="112" y="134" width="96" height="28" rx="4" fill="#1a1a1a" />
      <text x="160" y="154" textAnchor="middle" fill="#7dff9a" fontSize="14" fontFamily="ui-monospace, monospace">
        8.00 m
      </text>
      <rect x="210" y="150" width="36" height="10" fill={tone.face} />
    </g>
  );
}

function Level({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="48" y="148" width="224" height="28" rx="6" fill={tone.accent} />
      <rect x="120" y="152" width="80" height="20" rx="4" fill="#f4f6f8" />
      <circle cx="160" cy="162" r="6" fill="#3db36a" />
    </g>
  );
}

function Trowel({ tone, hawk }: { tone: Tone; hawk?: boolean }) {
  if (hawk) {
    return (
      <g>
        <rect x="88" y="78" width="144" height="144" rx="8" fill="#d8dee6" stroke="#8a9098" strokeWidth="3" />
        <rect x="148" y="210" width="24" height="56" rx="6" fill={tone.accent} />
      </g>
    );
  }
  return (
    <g>
      <path d="M90 200 L210 90 L250 120 L130 230 Z" fill="#c5ccd4" stroke="#8a9098" />
      <path d="M86 206 L70 250 L102 246 L118 214" fill={tone.accent} />
    </g>
  );
}

function Knife({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="70" y="150" width="120" height="22" rx="4" fill="#c5ccd4" />
      <path d="M186 148 L250 158 L186 174 Z" fill="#e8ecf0" />
      <rect x="70" y="146" width="54" height="30" rx="6" fill={tone.accent} />
    </g>
  );
}

function Hammer({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="148" y="86" width="22" height="160" rx="6" fill={tone.face} />
      <path d="M96 110 L224 96 L230 132 L90 148 Z" fill="#6a727c" />
    </g>
  );
}

function TileCutter({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="58" y="168" width="204" height="36" rx="4" fill="#6a727c" />
      <rect x="70" y="148" width="180" height="14" rx="2" fill="#c5ccd4" />
      <rect x="148" y="96" width="24" height="70" rx="4" fill={tone.accent} />
      <circle cx="160" cy="96" r="16" fill="#2a3038" />
      <circle cx="160" cy="96" r="6" fill="#9aa3ae" />
    </g>
  );
}

function Toilet({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="118" y="78" width="84" height="70" rx="10" fill={tone.face} stroke={tone.edge} />
      <ellipse cx="160" cy="200" rx="70" ry="48" fill={tone.face} stroke={tone.edge} />
      <ellipse cx="160" cy="198" rx="42" ry="28" fill="#dfe7f0" />
    </g>
  );
}

function Basin({ tone }: { tone: Tone }) {
  return (
    <g>
      <ellipse cx="160" cy="130" rx="90" ry="40" fill={tone.face} stroke={tone.edge} />
      <ellipse cx="160" cy="128" rx="58" ry="22" fill="#dfe7f0" />
      <rect x="138" y="168" width="44" height="70" rx="6" fill={tone.face} stroke={tone.edge} />
    </g>
  );
}

function Tap({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="148" y="96" width="24" height="70" rx="6" fill={tone.face} stroke={tone.edge} />
      <path d="M160 110 C210 110 220 150 220 168" fill="none" stroke={tone.face} strokeWidth="14" strokeLinecap="round" />
      <circle cx="160" cy="92" r="16" fill={tone.accent} />
    </g>
  );
}

function Shower({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="148" y="78" width="16" height="90" fill={tone.face} />
      <path d="M120 78 L200 78" stroke={tone.face} strokeWidth="10" strokeLinecap="round" />
      <circle cx="156" cy="188" r="36" fill={tone.accent} />
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={i} x1={140 + i * 7} y1="220" x2={136 + i * 8} y2="250" stroke="#7ec8e8" strokeWidth="2" />
      ))}
    </g>
  );
}

function Tray({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M70 140 L250 140 L230 210 L90 210 Z" fill={tone.face} stroke={tone.edge} strokeWidth="3" />
      <ellipse cx="200" cy="186" rx="12" ry="8" fill={tone.accent} />
    </g>
  );
}

function Screen({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="100" y="70" width="120" height="190" rx="6" fill="#cfe4f4" fillOpacity="0.7" stroke={tone.edge} strokeWidth="6" />
      <path d="M112 90 L208 230" stroke="white" strokeOpacity="0.6" strokeWidth="8" />
    </g>
  );
}

function Bath({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M64 150 C64 110 256 110 256 150 L248 210 C248 230 72 230 72 210 Z" fill={tone.face} stroke={tone.edge} strokeWidth="3" />
      <ellipse cx="160" cy="158" rx="78" ry="28" fill="#dfe7f0" />
    </g>
  );
}

function Roller({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="90" y="118" width="140" height="44" rx="16" fill={tone.face} stroke={tone.edge} />
      <path d="M230 140 L250 140 L250 200 L160 200 L160 188 L236 188 L236 140" fill="none" stroke={tone.accent} strokeWidth="8" />
    </g>
  );
}

function Brush({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="148" y="70" width="24" height="110" rx="6" fill={tone.face} />
      <rect x="128" y="176" width="64" height="70" rx="8" fill={tone.accent} />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={134 + i * 7} y="236" width="4" height="18" fill={tone.edge} />
      ))}
    </g>
  );
}

function DustSheet({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M80 110 C120 90 160 140 200 100 C230 80 250 120 250 150 L240 230 L90 230 Z" fill={tone.face} stroke={tone.edge} />
      <path d="M100 140 C150 160 200 120 230 150" fill="none" stroke={tone.edge} strokeOpacity="0.4" />
    </g>
  );
}

function Cartridge({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="120" y="70" width="80" height="170" rx="10" fill={tone.face} stroke={tone.edge} />
      <polygon points="160,70 148,48 172,48" fill={tone.edge} />
      <rect x="132" y="110" width="56" height="70" rx="4" fill="white" fillOpacity="0.9" />
    </g>
  );
}

function Sandpaper({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="86" y="90" width="130" height="160" rx="4" fill={tone.face} transform="rotate(-8 151 170)" />
      <rect x="104" y="78" width="130" height="160" rx="4" fill={tone.edge} transform="rotate(-3 169 158)" />
      <rect x="118" y="70" width="130" height="160" rx="4" fill="#c4a882" stroke={tone.edge} />
    </g>
  );
}

function Tile({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="78" y="78" width="164" height="164" rx="4" fill={tone.face} stroke={tone.edge} strokeWidth="3" />
      <path d="M90 90 L220 90 L220 220 L90 220 Z" fill="url(#tileShine)" />
    </g>
  );
}

function Mosaic({ tone }: { tone: Tone }) {
  return (
    <g>
      {Array.from({ length: 16 }).map((_, i) => (
        <rect
          key={i}
          x={88 + (i % 4) * 36}
          y={88 + Math.floor(i / 4) * 36}
          width="32"
          height="16"
          rx="2"
          fill={i % 3 === 0 ? tone.face : "#f7f8fa"}
          stroke={tone.edge}
        />
      ))}
    </g>
  );
}

function Spacers({ tone }: { tone: Tone }) {
  return (
    <g>
      {[[120, 120], [180, 120], [120, 180], [180, 180], [150, 150]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <rect x="-18" y="-4" width="36" height="8" rx="2" fill={tone.accent} />
          <rect x="-4" y="-18" width="8" height="36" rx="2" fill={tone.accent} />
        </g>
      ))}
    </g>
  );
}

function Laminate({ tone }: { tone: Tone }) {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={70 + i * 8} y={90 + i * 28} width="180" height="36" rx="3" fill={i === 1 ? tone.face : tone.edge} stroke={tone.accent} />
      ))}
      <path d="M86 108 L230 108 M94 136 L238 136 M102 164 L246 164" stroke="white" strokeOpacity="0.25" />
    </g>
  );
}

function Underlay({ tone }: { tone: Tone }) {
  return (
    <g>
      <ellipse cx="168" cy="176" rx="86" ry="54" fill={tone.edge} />
      <rect x="82" y="122" width="172" height="54" fill={tone.face} />
      <ellipse cx="168" cy="122" rx="86" ry="54" fill={tone.face} stroke={tone.edge} strokeWidth="3" />
      <ellipse cx="168" cy="122" rx="28" ry="16" fill="#eef2f6" stroke={tone.edge} />
      <path d="M82 150 C70 188 70 230 168 230" fill="none" stroke={tone.accent} strokeWidth="10" />
    </g>
  );
}

function Block({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M80 140 L160 100 L240 140 L160 180 Z" fill={tone.face} stroke={tone.edge} />
      <path d="M80 140 L80 210 L160 250 L160 180 Z" fill={tone.edge} />
      <path d="M240 140 L240 210 L160 250 L160 180 Z" fill={tone.accent} />
    </g>
  );
}

function Brick({ tone }: { tone: Tone }) {
  return (
    <g>
      {[0, 1, 2].map((row) =>
        [0, 1].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={78 + col * 86 + (row % 2) * 20}
            y={96 + row * 42}
            width="80"
            height="34"
            rx="3"
            fill={tone.face}
            stroke={tone.edge}
          />
        )),
      )}
    </g>
  );
}

function Lintel({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M48 150 L272 150 L260 186 L60 186 Z" fill={tone.face} stroke={tone.edge} strokeWidth="2" />
      <path d="M80 150 L80 186 M160 150 L160 186 M240 150 L240 186" stroke={tone.edge} />
    </g>
  );
}

function Insulation({ tone }: { tone: Tone }) {
  return (
    <g>
      <ellipse cx="160" cy="168" rx="96" ry="70" fill={tone.face} stroke={tone.edge} strokeWidth="3" />
      <path d="M80 168 C110 130 140 200 160 168 C180 136 210 206 240 168" fill="none" stroke={tone.accent} strokeWidth="8" />
    </g>
  );
}

function FencePanel({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="90" y="70" width="140" height="180" rx="4" fill={tone.edge} />
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x="100" y={80 + i * 24} width="120" height="18" rx="2" fill={tone.face} />
      ))}
    </g>
  );
}

function Post({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="138" y="64" width="44" height="200" rx="4" fill={tone.face} stroke={tone.edge} strokeWidth="2" />
      <rect x="138" y="64" width="12" height="200" fill="white" fillOpacity="0.15" />
    </g>
  );
}

function Slab({ tone }: { tone: Tone }) {
  return (
    <g>
      <path d="M70 140 L200 92 L262 150 L132 198 Z" fill={tone.face} stroke={tone.edge} strokeWidth="2" />
      <path d="M132 198 L262 150 L262 168 L132 216 Z" fill={tone.accent} />
    </g>
  );
}

function Membrane({ tone }: { tone: Tone }) {
  return (
    <g>
      <ellipse cx="160" cy="176" rx="88" ry="88" fill={tone.face} stroke={tone.edge} strokeWidth="8" />
      <path d="M160 88 A88 88 0 0 1 248 176" fill="none" stroke={tone.accent} strokeWidth="8" />
    </g>
  );
}

function Screws({ tone }: { tone: Tone }) {
  return (
    <g>
      <rect x="92" y="86" width="136" height="150" rx="8" fill={tone.face} stroke={tone.edge} />
      <rect x="108" y="102" width="104" height="70" rx="4" fill="white" fillOpacity="0.9" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${118 + i * 22} 200)`}>
          <rect x="0" y="0" width="8" height="36" fill={tone.accent} />
          <polygon points="4,-8 10,4 -2,4" fill={tone.edge} />
        </g>
      ))}
    </g>
  );
}

function Plugs({ tone }: { tone: Tone }) {
  return (
    <g>
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x={100 + (i % 4) * 32} y={100 + Math.floor(i / 4) * 40} width="18" height="28" rx="6" fill={tone.accent} />
      ))}
    </g>
  );
}

function ProductShape({ imageKey, tone, name }: { imageKey: string; tone: Tone; name: string }) {
  const litres = Number(/(\d+(?:\.\d+)?)\s*L/i.exec(name)?.[1] ?? 5);
  const caption =
    n(name).includes("moisture") ? "MR"
    : n(name).includes("fire") ? "FIRE"
    : n(name).includes("acoustic") ? "ACOUSTIC"
    : n(name).includes("cement") ? "CEMENT"
    : n(name).includes("plaster") ? "PLASTER"
    : n(name).includes("grout") ? "GROUT"
    : n(name).includes("adhesive") ? "ADHESIVE"
    : "TRADEPAL";

  switch (imageKey as ImageKey) {
    case "board":
      return <Board tone={tone} caption={caption} />;
    case "sheet":
      return <Sheet tone={tone} />;
    case "bag":
      return <Bag tone={tone} caption={caption} />;
    case "bulk-bag":
      return <BulkBag tone={tone} />;
    case "timber":
      return <Timber tone={tone} />;
    case "trim":
      return <Trim tone={tone} />;
    case "tape":
      return <Tape tone={tone} />;
    case "tub":
      return <Tub tone={tone} />;
    case "screws":
      return <Screws tone={tone} />;
    case "plugs":
      return <Plugs tone={tone} />;
    case "pipe":
      return <Pipe tone={tone} />;
    case "fitting":
      return <Fitting tone={tone} />;
    case "valve":
      return <Valve tone={tone} />;
    case "radiator":
      return <Radiator tone={tone} />;
    case "cable":
      return <Cable tone={tone} />;
    case "socket":
      return <Socket tone={tone} />;
    case "switch":
      return <SwitchPlate tone={tone} />;
    case "downlight":
      return <Downlight tone={tone} />;
    case "consumer-unit":
      return <ConsumerUnit tone={tone} />;
    case "junction":
      return <Junction tone={tone} />;
    case "drill":
      return <Drill tone={tone} />;
    case "saw":
      return <Saw tone={tone} />;
    case "tape-measure":
      return <Measure tone={tone} />;
    case "level":
      return <Level tone={tone} />;
    case "trowel":
      return <Trowel tone={tone} hawk={n(name).includes("hawk")} />;
    case "knife":
      return <Knife tone={tone} />;
    case "hammer":
      return <Hammer tone={tone} />;
    case "tile-cutter":
      return <TileCutter tone={tone} />;
    case "toilet":
      return <Toilet tone={tone} />;
    case "basin":
      return <Basin tone={tone} />;
    case "tap":
      return <Tap tone={tone} />;
    case "shower":
      return <Shower tone={tone} />;
    case "tray":
      return <Tray tone={tone} />;
    case "screen":
      return <Screen tone={tone} />;
    case "bath":
      return <Bath tone={tone} />;
    case "paint":
      return <PaintCan tone={tone} litres={litres} />;
    case "roller":
      return <Roller tone={tone} />;
    case "brush":
      return <Brush tone={tone} />;
    case "dust-sheet":
      return <DustSheet tone={tone} />;
    case "cartridge":
      return <Cartridge tone={tone} />;
    case "sandpaper":
      return <Sandpaper tone={tone} />;
    case "tile":
      return <Tile tone={tone} />;
    case "mosaic":
      return <Mosaic tone={tone} />;
    case "spacers":
      return <Spacers tone={tone} />;
    case "laminate":
      return <Laminate tone={tone} />;
    case "underlay":
      return <Underlay tone={tone} />;
    case "block":
      return <Block tone={tone} />;
    case "brick":
      return <Brick tone={tone} />;
    case "lintel":
      return <Lintel tone={tone} />;
    case "insulation":
      return <Insulation tone={tone} />;
    case "fence-panel":
      return <FencePanel tone={tone} />;
    case "post":
      return <Post tone={tone} />;
    case "slab":
      return <Slab tone={tone} />;
    case "membrane":
      return <Membrane tone={tone} />;
    default:
      return <Box tone={tone} />;
  }
}

export function ProductPhoto({
  imageKey,
  name,
  className,
}: {
  imageKey: string;
  name: string;
  className?: string;
}) {
  const tone = toneFromName(name, imageKey);
  const shine = uid("shine", imageKey + name);
  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-xl bg-[#eef2f6]", className)}>
      <svg viewBox="0 0 320 320" className="size-full" role="img" aria-hidden>
        <defs>
          <radialGradient id={`${shine}-bg`} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e4eaf1" />
          </radialGradient>
          <linearGradient id="tileShine" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.35" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="320" height="320" fill={`url(#${shine}-bg)`} />
        <ellipse cx="160" cy="268" rx="108" ry="16" fill="#172b4d" opacity="0.1" />
        <ProductShape imageKey={imageKey} tone={tone} name={name} />
      </svg>
    </div>
  );
}
