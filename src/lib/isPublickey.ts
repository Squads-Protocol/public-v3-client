"use client";
import { PublicKey } from "@solana/web3.js";

export function isPublickey(key: string) {
  try {
    return !!new PublicKey(key);
  } catch {
    return false;
  }
}
