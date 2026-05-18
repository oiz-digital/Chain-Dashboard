import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateHash(hash: string, start = 6, end = 4) {
  if (!hash) return "";
  if (hash.length <= start + end) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

export function formatZbx(amountStr: string, decimals = 18): string {
  if (!amountStr) return "0.00";
  try {
    const value = BigInt(amountStr);
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;
    
    let fractionStr = fractionalPart.toString().padStart(decimals, "0");
    // Keep 4 decimal places for display, or trim trailing zeros
    fractionStr = fractionStr.slice(0, 4);
    
    const formattedInteger = new Intl.NumberFormat("en-US").format(integerPart);
    
    if (fractionStr === "0000") return formattedInteger;
    return `${formattedInteger}.${fractionStr}`;
  } catch (e) {
    return "0.00";
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function formatAge(timestamp: string | number): string {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (e) {
    return "";
  }
}
