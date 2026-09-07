import { NextResponse } from "next/server";
import { getRankedCompanies } from "@/lib/db";

function csvEscape(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city") || undefined;
    const companies = await getRankedCompanies(city);

    const header = [
      "Name",
      "Phone",
      "Website",
      "Address",
      "City",
      "Has Instagram",
      "Flagged Review Count",
      "Social Gap Score",
    ];

    const rows = companies.map((c) =>
      [
        c.name,
        c.phone,
        c.website,
        c.address,
        c.city,
        c.has_instagram === null ? "unknown" : c.has_instagram,
        c.flagged_review_count,
        c.social_gap_score,
      ]
        .map(csvEscape)
        .join(",")
    );

    const csv = [header.join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="social-gap-leads${city ? `-${city}` : ""}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
