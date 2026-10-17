import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Readable German message for a Supabase/Postgres error. */
export function dbErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  if (err?.code === "23503") return "Wird noch verwendet (z. B. von Produkten oder Bestellungen) und kann nicht gelöscht werden.";
  if (err?.code === "23505") return "Existiert bereits.";
  if (err?.code === "42501") return "Keine Berechtigung.";
  return err?.message ?? "Unbekannter Fehler";
}

const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
/** German price format: 1.234,50 € */
export function eur(n: number | string | null | undefined): string {
  return EUR.format(Number(n ?? 0));
}
