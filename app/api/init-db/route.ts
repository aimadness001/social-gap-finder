import { NextResponse } from "next/server";
import { initSchema } from "@/lib/db";

// One-time setup: hit this route once after your first deploy (or whenever
// you add a fresh Postgres database) to create the companies/reviews tables.
export async function POST() {
  try {
    await initSchema();
    return NextResponse.json({ ok: true, message: "Database tables ready." });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
