import Link from "next/link";
import type { Legacy } from "@/lib/types";

const TABS = [
  { key: "overview", label: "Overview", href: "" },
  { key: "interview", label: "Interview", href: "/interview" },
  { key: "voice", label: "Voice", href: "/voice" },
  { key: "chat", label: "Talk", href: "/chat" },
] as const;

export function LegacyNav({ legacy, active }: { legacy: Legacy; active: (typeof TABS)[number]["key"] }) {
  return (
    <>
      <div className="legacy-head">
        <div className="eyebrow">Digital Legacy</div>
        <h1>{legacy.name}</h1>
        {legacy.birthYear ? <div className="muted">Born {legacy.birthYear}</div> : null}
      </div>
      <nav className="tabs" aria-label="Legacy sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/legacy/${legacy.id}${t.href}`}
            className="tab"
            aria-current={t.key === active ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
