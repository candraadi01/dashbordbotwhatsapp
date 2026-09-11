import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  const { data: role } = await supabase.from("user_roles").select("role").eq("id", user.id).single();
  if (!role || !["OWNER", "ADMIN"].includes(role.role)) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_BYTES) return NextResponse.json({ error: "Gunakan gambar JPG, PNG, atau WebP maksimal 5 MB." }, { status: 400 });
  const cloud = process.env.CLOUDINARY_CLOUD_NAME; const key = process.env.CLOUDINARY_API_KEY; const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) return NextResponse.json({ error: "Cloudinary belum dikonfigurasi." }, { status: 503 });
  const timestamp = Math.floor(Date.now() / 1000); const folder = "candra-bot/products";
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest("hex");
  const upload = new FormData(); upload.set("file", file); upload.set("api_key", key); upload.set("timestamp", String(timestamp)); upload.set("folder", folder); upload.set("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: upload }); const result = await response.json();
  if (!response.ok) return NextResponse.json({ error: result?.error?.message ?? "Upload gagal." }, { status: 502 });
  return NextResponse.json({ url: result.secure_url, publicId: result.public_id });
}

export async function DELETE(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  const { data: role } = await supabase.from("user_roles").select("role").eq("id", user.id).single();
  if (!role || !["OWNER", "ADMIN"].includes(role.role)) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const { publicId } = await request.json();
  if (typeof publicId !== "string" || !publicId.startsWith("candra-bot/products/")) return NextResponse.json({ error: "Public ID gambar tidak valid." }, { status: 400 });
  const cloud = process.env.CLOUDINARY_CLOUD_NAME; const key = process.env.CLOUDINARY_API_KEY; const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) return NextResponse.json({ error: "Cloudinary belum dikonfigurasi." }, { status: 503 });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}${secret}`).digest("hex");
  const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: key, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, { method: "POST", body });
  const result = await response.json();
  if (!response.ok) return NextResponse.json({ error: result?.error?.message ?? "Gagal menghapus gambar." }, { status: 502 });
  return NextResponse.json({ ok: true, result: result.result });
}
