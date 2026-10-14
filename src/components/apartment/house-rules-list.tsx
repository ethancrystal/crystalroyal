import { SITE } from "@/lib/site";
import { PhText } from "@/components/ph";

/** The house rules from the config, plus the occupancy and identity line from the copy deck. */
export const HOUSE_RULES: readonly string[] = [
  ...SITE.houseRules,
  "Occupancy as reserved; a valid CNIC or passport is shown at check-in.",
];

export function HouseRulesList({ className = "" }: { className?: string }) {
  return (
    <ul className={`m-0 list-none p-0 ${className}`} style={{ borderTop: "1px solid var(--color-taupe)" }}>
      {HOUSE_RULES.map((rule, i) => (
        <li key={`${i}-${rule}`} className="py-3.5 max-[900px]:py-3" style={{ borderBottom: "1px solid var(--color-taupe)" }}>
          <PhText text={rule} />
        </li>
      ))}
    </ul>
  );
}
