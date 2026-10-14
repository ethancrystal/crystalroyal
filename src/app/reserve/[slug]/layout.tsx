import type { Metadata } from "next";
import { loadType, reservableType } from "@/components/reserve/flow";
import { ReserveHeader } from "@/components/reserve/reserve-header";

// The folio shell of the four reserve steps: the midnight header ("Reserve · {type name}" and the step indicator)
// on an ivory page. Each step renders its own column and the folio spine through ReserveFrame, because the spine
// is priced from the step's choices (a layout does not receive the query string).

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const type = await loadType(slug);
  return {
    title: type ? `Reserve · ${type.name} — Crystal Royal Apartment` : "Reserve — Crystal Royal Apartment",
    robots: { index: false, follow: false },
  };
}

export default async function ReserveLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const type = await reservableType(slug);
  return (
    <div className="on-ivory flex min-h-screen flex-col" data-stone={type.stone}>
      <ReserveHeader slug={type.slug} typeName={type.name} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
