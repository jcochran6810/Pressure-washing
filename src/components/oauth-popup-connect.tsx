"use client";

// Opens a third-party OAuth flow in a centered popup and listens for a
// postMessage from the callback page to know when it's done — then closes
// the popup and refreshes the host route so the just-stored connection is
// visible. If the browser blocks the popup we fall back to a full-page
// navigation so the connect still works.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const POPUP_W = 520;
const POPUP_H = 640;

type Provider = "google" | "qbo" | "stripe";

type Props = {
  connectHref: string;
  provider: Provider;
  className?: string;
  children: React.ReactNode;
};

type CallbackMessage = {
  source: `pw-oauth-${Provider}`;
  status: string;
  msg?: string | null;
};

export function OAuthPopupConnect({ connectHref, provider, className, children }: Props) {
  const router = useRouter();
  const popupRef = useRef<Window | null>(null);
  const [opening, setOpening] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const left = window.screenX + Math.max(0, (window.outerWidth - POPUP_W) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - POPUP_H) / 2);
      const features = `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const popup = window.open(connectHref, `oauth_${provider}`, features);
      if (!popup) {
        window.location.href = connectHref;
        return;
      }
      popupRef.current = popup;
      setOpening(true);
    },
    [connectHref, provider],
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as CallbackMessage | null | undefined;
      if (!data || data.source !== `pw-oauth-${provider}`) return;
      try {
        popupRef.current?.close();
      } catch {}
      popupRef.current = null;
      setOpening(false);
      const qp = data.msg ? `&msg=${encodeURIComponent(data.msg)}` : "";
      router.replace(`/settings?${provider}=${encodeURIComponent(data.status)}${qp}`);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [provider, router]);

  useEffect(() => {
    if (!opening) return;
    const id = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        popupRef.current = null;
        setOpening(false);
        clearInterval(id);
      }
    }, 600);
    return () => clearInterval(id);
  }, [opening]);

  return (
    <a
      href={connectHref}
      onClick={handleClick}
      className={className}
      aria-busy={opening || undefined}
      data-popup-open={opening || undefined}
    >
      {children}
    </a>
  );
}
