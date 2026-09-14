import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const SOUND_FILE = path.join(DATA_DIR, "custom_notification_sound.bin");
const META_FILE = path.join(DATA_DIR, "custom_notification_sound.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * HEAD /api/notifications/sound
 * Cek ketersediaan file audio custom di server tanpa men-download buffer
 */
export async function HEAD() {
  try {
    if (!fs.existsSync(SOUND_FILE) || !fs.existsSync(META_FILE)) {
      return new NextResponse(null, { status: 404 });
    }
    const meta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
    const stats = fs.statSync(SOUND_FILE);
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": meta.mimeType || "audio/mpeg",
        "Content-Length": String(stats.size),
        "X-Audio-Filename": encodeURIComponent(meta.fileName || "custom_sound.mp3"),
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

/**
 * GET /api/notifications/sound
 * Mengembalikan file audio custom yang tersimpan di server
 */
export async function GET() {
  try {
    if (!fs.existsSync(SOUND_FILE) || !fs.existsSync(META_FILE)) {
      return NextResponse.json({ error: "Sound not found" }, { status: 404 });
    }

    const meta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
    const buffer = fs.readFileSync(SOUND_FILE);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": meta.mimeType || "audio/mpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Accept-Ranges": "bytes",
        "X-Audio-Filename": encodeURIComponent(meta.fileName || "custom_sound.mp3"),
      },
    });
  } catch (err: any) {
    console.error("[api/notifications/sound GET]", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

/**
 * POST /api/notifications/sound
 * Menyimpan file audio custom dari client ke server
 */
export async function POST(req: NextRequest) {
  try {
    ensureDataDir();

    let buffer: Buffer | null = null;
    let mimeType = "audio/mpeg";
    let fileName = "custom_sound.mp3";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = file.type || "audio/mpeg";
      fileName = file.name || "custom_sound.mp3";
    } else {
      const body = await req.json().catch(() => ({}));
      const audioData = body.audio as string | undefined;
      fileName = body.fileName || "custom_sound.mp3";

      if (!audioData) {
        return NextResponse.json({ error: "No audio data provided" }, { status: 400 });
      }

      if (audioData.startsWith("data:")) {
        const matches = audioData.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], "base64");
        } else {
          return NextResponse.json({ error: "Invalid data URL format" }, { status: 400 });
        }
      } else {
        buffer = Buffer.from(audioData, "base64");
      }
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: "Empty audio payload" }, { status: 400 });
    }

    // Tulis ke disk
    fs.writeFileSync(SOUND_FILE, buffer);
    fs.writeFileSync(META_FILE, JSON.stringify({ mimeType, fileName, updatedAt: Date.now() }));

    return NextResponse.json({
      ok: true,
      url: "/api/notifications/sound",
      fileName,
      size: buffer.length,
    });
  } catch (err: any) {
    console.error("[api/notifications/sound POST]", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

/**
 * DELETE /api/notifications/sound
 * Menghapus file audio custom di server
 */
export async function DELETE() {
  try {
    if (fs.existsSync(SOUND_FILE)) fs.unlinkSync(SOUND_FILE);
    if (fs.existsSync(META_FILE)) fs.unlinkSync(META_FILE);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[api/notifications/sound DELETE]", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
