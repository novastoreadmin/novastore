/**
 * Coordinates of Ukrainian cities for the logistics map (lat/lon, WGS84).
 * Covers oblast centers + the larger cities Nova Poshta ships to most often.
 * A city missing here still appears in the tables — it just has no dot on the
 * map. Keys are normalized via normalizeCityKey().
 */

export const UA_CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "київ": { lat: 50.45, lon: 30.52 },
  "харків": { lat: 49.99, lon: 36.23 },
  "одеса": { lat: 46.48, lon: 30.73 },
  "дніпро": { lat: 48.46, lon: 35.04 },
  "донецьк": { lat: 48.02, lon: 37.8 },
  "запоріжжя": { lat: 47.84, lon: 35.14 },
  "львів": { lat: 49.84, lon: 24.03 },
  "кривий ріг": { lat: 47.91, lon: 33.39 },
  "миколаїв": { lat: 46.98, lon: 32.0 },
  "маріуполь": { lat: 47.1, lon: 37.55 },
  "луганськ": { lat: 48.57, lon: 39.3 },
  "вінниця": { lat: 49.23, lon: 28.47 },
  "херсон": { lat: 46.64, lon: 32.61 },
  "полтава": { lat: 49.59, lon: 34.55 },
  "чернігів": { lat: 51.5, lon: 31.28 },
  "черкаси": { lat: 49.44, lon: 32.06 },
  "житомир": { lat: 50.25, lon: 28.66 },
  "суми": { lat: 50.91, lon: 34.8 },
  "хмельницький": { lat: 49.42, lon: 27.0 },
  "чернівці": { lat: 48.29, lon: 25.93 },
  "рівне": { lat: 50.62, lon: 26.25 },
  "кропивницький": { lat: 48.51, lon: 32.26 },
  "івано-франківськ": { lat: 48.92, lon: 24.71 },
  "тернопіль": { lat: 49.55, lon: 25.6 },
  "луцьк": { lat: 50.75, lon: 25.34 },
  "ужгород": { lat: 48.62, lon: 22.3 },
  "сімферополь": { lat: 44.95, lon: 34.1 },
  "севастополь": { lat: 44.62, lon: 33.53 },
  "біла церква": { lat: 49.8, lon: 30.11 },
  "кременчук": { lat: 49.07, lon: 33.42 },
  "бровари": { lat: 50.51, lon: 30.79 },
  "ірпінь": { lat: 50.52, lon: 30.25 },
  "буча": { lat: 50.55, lon: 30.21 },
  "мукачево": { lat: 48.44, lon: 22.72 },
  "кам'янець-подільський": { lat: 48.68, lon: 26.58 },
  "бердичів": { lat: 49.9, lon: 28.58 },
  "ніжин": { lat: 51.05, lon: 31.89 },
  "умань": { lat: 48.75, lon: 30.22 },
  "павлоград": { lat: 48.52, lon: 35.87 },
  "мелітополь": { lat: 46.85, lon: 35.37 },
  "бердянськ": { lat: 46.76, lon: 36.79 },
  "слов'янськ": { lat: 48.85, lon: 37.6 },
  "краматорськ": { lat: 48.72, lon: 37.55 },
  "дрогобич": { lat: 49.35, lon: 23.51 },
  "стрий": { lat: 49.26, lon: 23.85 },
  "калуш": { lat: 49.02, lon: 24.37 },
  "коломия": { lat: 48.53, lon: 25.04 },
  "вишневе": { lat: 50.38, lon: 30.37 },
  "вишгород": { lat: 50.58, lon: 30.49 },
  "обухів": { lat: 50.11, lon: 30.62 },
  "фастів": { lat: 50.08, lon: 29.92 },
  "васильків": { lat: 50.18, lon: 30.31 },
  "бориспіль": { lat: 50.35, lon: 30.95 },
}

/** "Київ, Київська обл." / "м. Львів" → dictionary key. */
export function normalizeCityKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^м\.\s*/, "")
    .split(",")[0]
    .trim()
}

export function cityCoords(name: string): { lat: number; lon: number } | null {
  return UA_CITY_COORDS[normalizeCityKey(name)] ?? null
}
