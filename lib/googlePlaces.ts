// Uses Places API (New). Make sure "Places API (New)" is enabled on your
// Google Cloud project and GOOGLE_PLACES_API_KEY is set.

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export type PlaceSummary = {
  placeId: string;
  name: string;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  reviews: { text: string; rating: number | null; publishTime: string | null }[];
};

function requireApiKey() {
  if (!API_KEY) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is not set. Add it in Vercel Project Settings -> Environment Variables."
    );
  }
}

// Text-searches Google Places for a query + location, e.g. "construction company" + "Austin, TX".
export async function searchPlaces(query: string, location: string): Promise<PlaceSummary[]> {
  requireApiKey();

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY as string,
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({
      textQuery: `${query} in ${location}`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Places text search failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const places = (data.places || []) as any[];

  return places.map((p) => ({
    placeId: p.id,
    name: p.displayName?.text || "Unknown",
  }));
}

// Fetches phone, website, address, and up to 5 reviews for a single place.
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  requireApiKey();

  const fieldMask = [
    "id",
    "displayName",
    "nationalPhoneNumber",
    "websiteUri",
    "formattedAddress",
    "reviews",
  ].join(",");

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": API_KEY as string,
      "X-Goog-FieldMask": fieldMask,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Places details failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const reviews = (data.reviews || []) as any[];

  return {
    placeId: data.id,
    name: data.displayName?.text || "Unknown",
    phone: data.nationalPhoneNumber || null,
    website: data.websiteUri || null,
    address: data.formattedAddress || null,
    reviews: reviews.map((r) => ({
      text: r.text?.text || "",
      rating: typeof r.rating === "number" ? r.rating : null,
      publishTime: r.publishTime || null,
    })),
  };
}
