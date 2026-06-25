"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Séances", match: (path: string) => path === "/" },
  { href: "/moi", label: "Mon espace", match: (path: string) => path === "/moi" || path.startsWith("/m/") },
  { href: "/recherche", label: "Recherche", match: (path: string) => path.startsWith("/recherche") },
  { href: "/classement", label: "Top 10", match: (path: string) => path.startsWith("/classement") },
  { href: "/admin", label: "Admin", match: (path: string) => path.startsWith("/admin") },
];

function navClass(active: boolean) {
  return [
    "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
    active
      ? "bg-[var(--accent)] text-white shadow-sm"
      : "text-[var(--ink)] hover:bg-[var(--accent-soft)]",
  ].join(" ");
}

type Props = {
  participantName: string | null;
};

export function SiteHeader({ participantName }: Props) {
  const pathname = usePathname() ?? "/";

  return (
    <header className="border-b border-[var(--border)] bg-white/80 backdrop-blur">
      <div className="container flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="shrink-0">
            <Image
              src="/ppg-logo.png"
              alt="PPG Courir à Sausset"
              width={120}
              height={120}
              className="h-14 w-auto"
              priority
            />
          </Link>
          <div>
            <Link href="/" className="text-lg font-bold text-[var(--accent)]">
              PPG Courir à Sausset
            </Link>
            <p className="muted text-sm">Jeudi 19h — préparation physique</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2" aria-label="Navigation principale">
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={navClass(active)}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="text-sm">
          {participantName ? (
            <span className="badge badge-ok">Connecté · {participantName}</span>
          ) : (
            <Link href="/connexion" className="btn btn-secondary text-sm">
              Se connecter
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
