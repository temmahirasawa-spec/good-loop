"use client";

import { createContext, useContext } from "react";

/**
 * ログイン中テナントの店舗名。AdminSidebar・AdminMobileTopBarの両方が同じ値を表示するため、
 * ページごとにpropsで渡す代わりにContextで配る（app/admin/(dashboard)/layout.tsxが供給元）。
 */
const StoreNameContext = createContext<string>("");

export function StoreNameProvider({ value, children }: { value: string; children: React.ReactNode }) {
  return <StoreNameContext.Provider value={value}>{children}</StoreNameContext.Provider>;
}

export function useStoreName(): string {
  return useContext(StoreNameContext);
}
