"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { InstallAppPrompt } from "@/components/install-app-prompt";

const links = [
  { href: "/", label: "Séances", match: (path: string) => path === "/" },
  { href: "/moi", label: "Mon espace", match: (path: string) => path === "/moi" || path.startsWith("/m/") },
  { href: "/recherche", label: "Recherche", match: (path: string) => path.startsWith("/recherche") },
  { href: "/classement", label: "Top 10", match: (path: string) => path.startsWith("/classement") },
  { href: "/admin", label: "Admin", match: (path: string) => path.startsWith("/admin") },
];

function navClass(active: boolean, mobile = false) {
  return [
    mobile ? "block w-full rounded-xl px-4 py-3 text-base font-semibold" : "rounded-full px-3 py-1.5 text-sm font-semibold",
    "transition-colors",
    active
      ? "bg-[var(--accent)] text-white shadow-sm"
      : "text-[var(--ink)] hover:bg-[var(--accent-soft)]",
  ].join(" ");
}

type Props = {
  participantName: string | null;
  scheduleTagline?: string;
};

export function SiteHeader({ participantName, scheduleTagline = "Préparation physique" }: Props) {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="site-header sticky top-0 z-[100] border-b border-[var(--border)] bg-white/95 backdrop-blur">
        <div className="container flex items-center justify-between gap-3 py-3 md:py-4">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <Link href="/" className="shrink-0">
              <Image
                src="/ppg-logo.png"
                alt="PPG Courir à Sausset"
                width={120}
                height={120}
                className="h-11 w-auto md:h-14"
                priority
              />
            </Link>
            <div className="min-w-0">
              <Link href="/" className="block truncate text-base font-bold text-[var(--accent)] md:text-lg">
                PPG Courir à Sausset
              </Link>
              <p className="muted hidden text-sm sm:block">{scheduleTagline}</p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 lg:flex" aria-label="Navigation principale">
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

          <div className="hidden items-center gap-2 md:flex">
            {participantName ? (
              <span className="badge badge-ok max-w-[12rem] truncate">Connecté · {participantName}</span>
            ) : (
              <Link href="/connexion" className="btn btn-secondary text-sm">
                Se connecter
              </Link>
            )}
          </div>

          <button
            type="button"
            className="burger-btn relative z-[101] shrink-0 touch-manipulation lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={menuOpen ? "burger-line open" : "burger-line"} />
            <span className={menuOpen ? "burger-line open" : "burger-line"} />
            <span className={menuOpen ? "burger-line open" : "burger-line"} />
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="mobile-menu-backdrop lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      ) : null}

      <div id="mobile-menu" className={menuOpen ? "mobile-menu open lg:hidden" : "mobile-menu lg:hidden"}>
        <nav className="space-y-2" aria-label="Navigation mobile">
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={navClass(active, true)}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          {participantName ? (
            <p className="badge badge-ok w-fit">Connecté · {participantName}</p>
          ) : (
            <Link href="/connexion" className="btn btn-secondary w-full" onClick={() => setMenuOpen(false)}>
              Se connecter
            </Link>
          )}
          <InstallAppPrompt compact />
        </div>
      </div>

      <InstallAppPrompt />
    </>
  );
}
