import Link from "next/link";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Worker Studio home">
      <span className="brand-mark"><Sparkle size={17} weight="fill" /></span>
      <span>Worker Studio</span>
    </Link>
  );
}

export function Topbar({ note = "A working service, built with you" }: { note?: string }) {
  return <header className="topbar"><Brand /><span className="topbar-note">{note}</span></header>;
}
