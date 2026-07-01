import { randomBytes } from "crypto";
import { cookies } from "next/headers";

export const PARTICIPANT_COOKIE = "ppg_token";
export const ADMIN_COOKIE = "ppg_admin";

export type AdminRole = "admin" | "super_admin";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8;

export function generateAccessToken() {
  return randomBytes(16).toString("base64url");
}

export async function setParticipantCookie(token: string) {
  const jar = await cookies();
  jar.set(PARTICIPANT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearParticipantCookie() {
  const jar = await cookies();
  jar.delete(PARTICIPANT_COOKIE);
}

export async function getParticipantToken() {
  const jar = await cookies();
  return jar.get(PARTICIPANT_COOKIE)?.value ?? null;
}

export async function setAdminCookie(role: AdminRole) {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, role === "super_admin" ? "super" : "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function getAdminRole(): Promise<AdminRole | null> {
  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE)?.value;
  if (value === "super") {
    return "super_admin";
  }
  if (value === "1") {
    return "admin";
  }
  return null;
}

export async function isAdminAuthenticated() {
  return (await getAdminRole()) !== null;
}

export async function isSuperAdminAuthenticated() {
  return (await getAdminRole()) === "super_admin";
}

export function resolveAdminPin(pin: string): AdminRole | null {
  const superPin = process.env.PPG_SUPER_ADMIN_PIN ?? "";
  const adminPin = process.env.PPG_ADMIN_PIN ?? "";

  if (superPin.length > 0 && pin === superPin) {
    return "super_admin";
  }
  if (adminPin.length > 0 && pin === adminPin) {
    return "admin";
  }
  return null;
}

export function verifyAdminPin(pin: string) {
  return resolveAdminPin(pin) !== null;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getPersonalLink(token: string) {
  return `${getAppUrl()}/m/${token}`;
}
