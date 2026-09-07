import { NextResponse } from "next/server";
import { getRankedCompanies } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city") || undefined;
    const companies = await getRankedCompanies(city);
    return NextResponse.json({ ok: true, companies });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
