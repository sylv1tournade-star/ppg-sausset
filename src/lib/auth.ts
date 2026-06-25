import { randomBytes } from "crypto";
import { cookies } from "next/headers";

export const PARTICIPANT_COOKIE = "ppg_token";
export const ADMIN_COOKIE = "ppg_admin";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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

export async function setAdminCookie() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function isAdminAuthenticated() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === "1";
}

export function verifyAdminPin(pin: string) {
  const expected = process.env.PPG_ADMIN_PIN ?? "";
  return expected.length > 0 && pin === expected;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getPersonalLink(token: string) {
  return `${getAppUrl()}/m/${token}`;
}
