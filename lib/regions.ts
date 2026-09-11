import { connectToDatabase, SettingModel } from "./mongodb"

// The competition runs as a sequence of independent regional editions (see the
// Official Contestants' Manual): three subregions, then the finals in Abuja.
// Each edition keeps its OWN rounds, stage, schedule, teams, tickets and votes,
// so starting Kaduna never disturbs Bauchi's finished numbers.
export interface Region {
  key: string
  name: string
  short: string
  order: number
}

export const REGIONS: Region[] = [
  { key: "bauchi", name: "Bauchi — North East", short: "Bauchi", order: 1 },
  { key: "kaduna", name: "Kaduna — North West", short: "Kaduna", order: 2 },
  { key: "nasarawa", name: "Nasarawa — North Central", short: "Nasarawa", order: 3 },
  { key: "abuja", name: "Abuja — Regional Finals", short: "Abuja Finals", order: 4 },
]

// Bauchi ran before regions existed, so every pre-existing team, ticket and
// vote belongs to it — both as the schema default and as the migration target.
export const DEFAULT_REGION = "bauchi"

// Admin-only pseudo-region for season-wide totals. Never a value stored on a
// document, and never the active region.
export const ALL_REGIONS = "all"

const ACTIVE_REGION_KEY = "active_region"

export function getRegion(key: string | null | undefined): Region {
  return REGIONS.find((region) => region.key === key) ?? REGIONS[0]
}

export function isRegionKey(key: string | null | undefined): boolean {
  return REGIONS.some((region) => region.key === key)
}

/**
 * Resolve a `?region=` query parameter for ADMIN reads. Accepts any known
 * region or "all"; anything else falls back to the caller's default.
 */
export function resolveRegionParam(param: string | null, fallback: string): string {
  if (param === ALL_REGIONS) return ALL_REGIONS
  if (isRegionKey(param)) return param as string
  return fallback
}

/** The edition the PUBLIC site is currently voting in. */
export async function getActiveRegion(): Promise<string> {
  await connectToDatabase()
  const setting = await SettingModel.findOne({ key: ACTIVE_REGION_KEY }).lean()
  return isRegionKey(setting?.value) ? (setting!.value as string) : DEFAULT_REGION
}

export async function setActiveRegion(key: string): Promise<string> {
  if (!isRegionKey(key)) throw new Error("Unknown region")
  await connectToDatabase()
  await SettingModel.findOneAndUpdate({ key: ACTIVE_REGION_KEY }, { value: key }, { upsert: true })
  return key
}

/**
 * Mongo filter for a region-scoped collection. "all" matches everything;
 * a real region also matches legacy documents written before regions existed,
 * which are Bauchi's.
 */
export function regionFilter(region: string): Record<string, unknown> {
  if (region === ALL_REGIONS) return {}
  if (region === DEFAULT_REGION) {
    return { $or: [{ region: DEFAULT_REGION }, { region: { $exists: false } }, { region: null }] }
  }
  return { region }
}
