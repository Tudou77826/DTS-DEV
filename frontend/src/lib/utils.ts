import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function htmlToText(value?: string) {
  if (!value) return ""
  const doc = new DOMParser().parseFromString(value, "text/html")
  return doc.body.textContent?.trim() || ""
}
