"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface Ctx {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const SidebarCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "ptopup_admin_sidebar_collapsed";

export function AdminSidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsedState(true);
    } catch {}
  }, []);

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {}
  };

  return (
    <SidebarCtx.Provider
      value={{
        collapsed,
        setCollapsed,
        toggle: () => setCollapsed(!collapsed),
        mobileOpen,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarCtx.Provider>
  );
}

export function useAdminSidebar() {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error("useAdminSidebar must be used within AdminSidebarProvider");
  return ctx;
}
