"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof window === "undefined") {
    return false;
  }
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

const DISMISS_KEY = "ppg-install-dismissed";

export function InstallAppPrompt({ compact = false }: { compact?: boolean }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) {
      return;
    }

    if (!compact && localStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }

    setHidden(false);

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [compact]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
    setShowIosHelp(false);
  }

  async function install() {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setHidden(true);
      }
      setInstallEvent(null);
      return;
    }

    if (isIos()) {
      setShowIosHelp(true);
    }
  }

  if (isStandalone()) {
    return null;
  }

  if (!compact && hidden && !showIosHelp) {
    return null;
  }

  if (compact) {
    return (
      <>
        <button type="button" className="btn btn-primary w-full" onClick={install}>
          Installer l&apos;appli
        </button>
        {showIosHelp ? <IosHelp onClose={() => setShowIosHelp(false)} onDismiss={dismiss} compact /> : null}
      </>
    );
  }

  return (
    <>
      <div className="install-banner">
        <div className="install-banner-inner">
          <div>
            <p className="font-semibold">Installer PPG sur votre téléphone</p>
            <p className="muted mt-1 text-sm">Accès rapide aux séances depuis l&apos;écran d&apos;accueil.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn btn-primary text-sm" onClick={install}>
              Installer
            </button>
            <button type="button" className="btn btn-secondary text-sm" onClick={dismiss} aria-label="Fermer">
              ✕
            </button>
          </div>
        </div>
      </div>
      {showIosHelp ? <IosHelp onClose={() => setShowIosHelp(false)} onDismiss={dismiss} /> : null}
    </>
  );
}

function IosHelp({
  onClose,
  onDismiss,
  compact = false,
}: {
  onClose: () => void;
  onDismiss: () => void;
  compact?: boolean;
}) {
  const card = (
    <div className={compact ? "rounded-xl border border-[var(--border)] bg-white p-4 text-sm" : "ios-help-card"}>
      <p className="font-semibold">Sur iPhone / iPad</p>
      <ol className="muted mt-2 list-decimal space-y-1 pl-5">
        <li>
          Touchez le bouton <strong>Partager</strong> (carré avec flèche)
        </li>
        <li>
          Choisissez <strong>Sur l&apos;écran d&apos;accueil</strong>
        </li>
        <li>
          Validez avec <strong>Ajouter</strong>
        </li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary text-sm" onClick={onClose}>
          Compris
        </button>
        <button type="button" className="btn btn-secondary text-sm" onClick={onDismiss}>
          Ne plus afficher
        </button>
      </div>
    </div>
  );

  if (compact) {
    return card;
  }

  return (
    <div className="install-ios-overlay" role="dialog" aria-modal="true" aria-label="Installer sur iPhone">
      {card}
    </div>
  );
}
