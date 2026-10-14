import type { Metadata } from "next";

// Every reservation page is reached with a private access token in the URL: never indexed, never followed, and
// the token never leaves for another site in a Referer header. "same-origin" rather than "no-referrer": with
// no-referrer the browser sends "Origin: null" on a plain form POST, which Next refuses, so the receipt and
// cancellation forms would fail without JavaScript. (next.config.ts also sends X-Robots-Tag and no-store.)

export const metadata: Metadata = {
  title: "Your reservation — Crystal Royal Apartment",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "same-origin",
};

export default function ReservationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
