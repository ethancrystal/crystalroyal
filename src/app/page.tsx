import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RatesBand } from "@/components/rates-band";

export const dynamic = "force-dynamic";

// Placeholder until the home page (the canvas "01 Home") is built.
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <RatesBand />
      </main>
      <SiteFooter />
    </>
  );
}
