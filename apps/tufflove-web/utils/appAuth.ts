import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export type AppSessionUser = {
  email: string;
  role: "familyops_admin";
};

type AppSessionPayload = AppSessionUser & {
  iat: number;
  exp: number;
};

const APP_SESSION_COOKIE_NAME = "tufflove_app_session";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 12;

function normalize(value: string | undefined | null): string {
  return String(value || "").trim();
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSessionTtlSeconds(): number {
  return parsePositiveInt(
    normalize(process.env.APP_AUTH_SESSION_TTL_SECONDS),
    DEFAULT_SESSION_TTL_SECONDS,
  );
}

function getSessionSecret(): string | null {
  const explicit = normalize(process.env.APP_AUTH_SECRET);
  if (explicit) return explicit;
  const fallback = normalize(process.env.AGENT_ADMIN_TOKEN);
  if (fallback) return fallback;
  return null;
}

function getFamilyOpsPassword(): string {
  const explicit = normalize(process.env.FAMILYOPS_ADMIN_PASSWORD);
  if (explicit) return explicit;
  const fallback = normalize(process.env.AGENT_ADMIN_TOKEN);
  if (fallback) return fallback;
  return "";
}

function signBase64Payload(payloadBase64: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  return createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("base64url");
}

function toBase64(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function fromBase64(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf-8");
  const right = Buffer.from(b, "utf-8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseSessionToken(rawToken: string): AppSessionPayload | null {
  const token = normalize(rawToken);
  if (!token.includes(".")) return null;

  const [payloadBase64, signature] = token.split(".", 2);
  if (!payloadBase64 || !signature) return null;

  const expectedSignature = signBase64Payload(payloadBase64);
  if (!expectedSignature) return null;
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const decoded = fromBase64(payloadBase64);
    const parsed = JSON.parse(decoded) as Partial<AppSessionPayload>;
    if (!parsed || typeof parsed !== "object") return null;

    const email = normalize(parsed.email || "");
    const role = parsed.role;
    const exp = Number(parsed.exp || 0);
    const iat = Number(parsed.iat || 0);
    const now = Math.floor(Date.now() / 1000);

    if (!email || role !== "familyops_admin" || !Number.isFinite(exp) || exp <= now) {
      return null;
    }
    if (!Number.isFinite(iat) || iat <= 0) {
      return null;
    }

    return { email, role, iat, exp };
  } catch {
    return null;
  }
}

function makeSessionToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AppSessionPayload = {
    email: normalize(email).toLowerCase(),
    role: "familyops_admin",
    iat: now,
    exp: now + getSessionTtlSeconds(),
  };
  const payloadBase64 = toBase64(JSON.stringify(payload));
  const signature = signBase64Payload(payloadBase64);
  if (!signature) {
    throw new Error("APP_AUTH_SECRET or AGENT_ADMIN_TOKEN must be set for app sessions.");
  }
  return `${payloadBase64}.${signature}`;
}

export function parseFamilyOpsAdminAllowlist(): Set<string> {
  const raw = normalize(process.env.FAMILYOPS_ADMIN_EMAILS);
  return new Set(
    raw
      .split(",")
      .map((email) => normalize(email).toLowerCase())
      .filter(Boolean),
  );
}

export function isFamilyOpsAdminEmail(email: string): boolean {
  const normalizedEmail = normalize(email).toLowerCase();
  if (!normalizedEmail) return false;
  return parseFamilyOpsAdminAllowlist().has(normalizedEmail);
}

export function verifyFamilyOpsAdminPassword(password: string): boolean {
  const expected = getFamilyOpsPassword();
  if (!expected) return false;
  return safeEqual(password, expected);
}

export function isAppSessionSigningConfigured(): boolean {
  return Boolean(getSessionSecret());
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    normalize(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      normalize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export async function createFamilyOpsSession(email: string): Promise<void> {
  const cookieStore = await cookies();
  const token = makeSessionToken(email);
  cookieStore.set(APP_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });
}

export async function clearFamilyOpsSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getFamilyOpsSession(): Promise<AppSessionUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(APP_SESSION_COOKIE_NAME)?.value || "";
  const payload = parseSessionToken(rawToken);
  if (!payload) return null;
  return {
    email: payload.email,
    role: payload.role,
  };
}
