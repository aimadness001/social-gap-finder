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
  rating: number | null; // Google star rating, e.g. 4.8
  reviewCount: number | null; // total number of Google reviews
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

// Fetches phone, website, address, star rating and total review count for a single place.
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  requireApiKey();

  const fieldMask = [
    "id",
    "displayName",
    "nationalPhoneNumber",
    "websiteUri",
    "formattedAddress",
    "rating",
    "userRatingCount",
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

  return {
    placeId: data.id,
    name: data.displayName?.text || "Unknown",
    phone: data.nationalPhoneNumber || null,
    website: data.websiteUri || null,
    address: data.formattedAddress || null,
    rating: typeof data.rating === "number" ? data.rating : null,
    // A company with no reviews comes back without this field.
    reviewCount: typeof data.userRatingCount === "number" ? data.userRatingCount : 0,
  };
}

// Fetches only the star rating and total review count (used to fill these in
// for companies saved before the app started collecting them).
export async function getPlaceRating(
  placeId: string
): Promise<{ rating: number | null; reviewCount: number }> {
  requireApiKey();
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": API_KEY as string,
      "X-Goog-FieldMask": "rating,userRatingCount",
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Places details failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return {
    rating: typeof data.rating === "number" ? data.rating : null,
    reviewCount: typeof data.userRatingCount === "number" ? data.userRatingCount : 0,
  };
}
