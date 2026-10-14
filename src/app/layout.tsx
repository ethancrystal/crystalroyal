import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const jost = Jost({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jost", display: "swap" });

const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Crystal Royal Apartment — Serviced apartments in Karachi, reserved by the night",
    template: "%s",
  },
  description:
    "Fully serviced two- and three-bedroom apartments with lounges in [Neighbourhood], Karachi. Reserve online and settle by bank transfer. PKR 17,000 and PKR 25,000 per night, plus applicable taxes.",
  applicationName: SITE.name,
  openGraph: { type: "website", siteName: SITE.name, locale: "en_PK" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/brand/mark-c.svg" },
};

export const viewport: Viewport = { themeColor: "#171512", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
