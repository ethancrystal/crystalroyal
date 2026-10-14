import { ImageResponse } from "next/og";

// Open Graph image, 1200 × 630: the midnight ground, the mark, the stacked lockup with the gold rule, and the
// tagline. Satori cannot read CSS variables, so the token values are written out here (globals.css @theme).

export const alt = "Crystal Royal Apartment, Karachi. A royal address for unhurried stays.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MIDNIGHT = "#171512";
const GOLD = "#C5A880";
const ON_DARK = "#F3EEE3";
const ON_DARK_2 = "#BFB3A0";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<polygon points="56,78 56,44 78,62 100,30 122,62 144,44 144,78" fill="#C5A880"/>
<rect x="56" y="78" width="88" height="12" fill="#7A5F3B"/>
<g stroke="#7A5F3B" stroke-width="1.5" stroke-linejoin="round">
<polygon points="76,100 124,100 136,124 64,124" fill="#D9D4C7"/>
<polygon points="60,100 76,100 64,124 44,124" fill="#EBE5D9"/>
<polygon points="124,100 140,100 156,124 136,124" fill="#EBE5D9"/>
<polygon points="44,124 72,124 100,188" fill="#C5A880"/>
<polygon points="72,124 100,124 100,188" fill="#B89C6E"/>
<polygon points="100,124 128,124 100,188" fill="#A8905F"/>
<polygon points="128,124 156,124 100,188" fill="#93784F"/>
</g></svg>`;

export default function OpengraphImage() {
  const mark = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(MARK)}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: MIDNIGHT,
          color: ON_DARK,
          border: `1px solid ${GOLD}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mark} width={150} height={150} alt="" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", marginTop: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", fontSize: 48, letterSpacing: "0.22em", paddingLeft: "0.22em" }}>
            CRYSTAL ROYAL
          </div>
          <div style={{ display: "flex", height: 2, background: GOLD, marginTop: 18, marginBottom: 18 }} />
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              fontSize: 22,
              letterSpacing: "0.5em",
              paddingLeft: "0.5em",
              fontWeight: 500,
            }}
          >
            APARTMENT
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 44, fontSize: 30, color: ON_DARK_2 }}>A royal address for unhurried stays.</div>
        <div style={{ display: "flex", marginTop: 14, fontSize: 18, letterSpacing: "0.2em", color: GOLD }}>
          SERVICED APARTMENTS · KARACHI
        </div>
      </div>
    ),
    size,
  );
}
