"use client";

import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Toggle fullscreen viewport pakai Fullscreen API.
 * Klik → masuk fullscreen, klik lagi → keluar.
 */
export function FullscreenToggle() {
  const [isFs, setIsFs] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setSupported(
      Boolean(
        document.fullscreenEnabled ??
          // @ts-expect-error vendor prefix
          document.webkitFullscreenEnabled,
      ),
    );

    function onChange() {
      setIsFs(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggle() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* abaikan — beberapa browser butuh user gesture langsung */
    }
  }

  if (!supported) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isFs ? "Keluar fullscreen" : "Masuk fullscreen"}
      title={isFs ? "Keluar fullscreen" : "Fullscreen"}
    >
      {isFs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
    </Button>
  );
}
