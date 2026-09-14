import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");
const PREFS_FILE = path.join(DATA_DIR, "notification_preferences.json");

export interface ServerNotificationPreferences {
  notificationEnabled: boolean;
  notificationNewTransaction: boolean;
  notificationStatusSuccess: boolean;
  notificationStatusPending: boolean;
  notificationStatusCancelled: boolean;
  notificationSound: string;
  notificationVolume: number;
  updatedAt: number;
}

const defaultPreferences: ServerNotificationPreferences = {
  notificationEnabled: true,
  notificationNewTransaction: true,
  notificationStatusSuccess: true,
  notificationStatusPending: true,
  notificationStatusCancelled: true,
  notificationSound: "soft",
  notificationVolume: 65,
  updatedAt: Date.now(),
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getServerPreferences(): ServerNotificationPreferences {
  try {
    if (fs.existsSync(PREFS_FILE)) {
      const raw = fs.readFileSync(PREFS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...defaultPreferences, ...parsed };
    }
  } catch (err) {
    console.warn("[preferences] Could not read preferences file, using defaults:", err);
  }
  return defaultPreferences;
}

export async function GET() {
  const prefs = getServerPreferences();
  return NextResponse.json({ ok: true, preferences: prefs });
}

export async function POST(req: NextRequest) {
  try {
    ensureDataDir();
    const body = await req.json().catch(() => ({}));
    const current = getServerPreferences();

    const updated: ServerNotificationPreferences = {
      ...current,
      ...(typeof body.notificationEnabled === "boolean" ? { notificationEnabled: body.notificationEnabled } : {}),
      ...(typeof body.notificationNewTransaction === "boolean" ? { notificationNewTransaction: body.notificationNewTransaction } : {}),
      ...(typeof body.notificationStatusSuccess === "boolean" ? { notificationStatusSuccess: body.notificationStatusSuccess } : {}),
      ...(typeof body.notificationStatusPending === "boolean" ? { notificationStatusPending: body.notificationStatusPending } : {}),
      ...(typeof body.notificationStatusCancelled === "boolean" ? { notificationStatusCancelled: body.notificationStatusCancelled } : {}),
      ...(typeof body.notificationSound === "string" ? { notificationSound: body.notificationSound } : {}),
      ...(typeof body.notificationVolume === "number" ? { notificationVolume: body.notificationVolume } : {}),
      updatedAt: Date.now(),
    };

    fs.writeFileSync(PREFS_FILE, JSON.stringify(updated, null, 2), "utf-8");
    return NextResponse.json({ ok: true, preferences: updated });
  } catch (err: any) {
    console.warn("[preferences POST]", err?.message || err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
