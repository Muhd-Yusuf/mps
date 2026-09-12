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
 * Region for a READ request: `?region=` when an admin is scoping the dashboard
 * (including "all"), otherwise the live edition the public is voting in.
 */
export async function regionFromRequest(request: Request): Promise<string> {
  const param = new URL(request.url).searchParams.get("region")
  return resolveRegionParam(param, await getActiveRegion())
}

/**
 * Region for a WRITE request. Same resolution, but "all" is meaningless when
 * storing a value, so it collapses to the live edition.
 */
export async function regionForWrite(request: Request, bodyRegion?: string | null): Promise<string> {
  if (isRegionKey(bodyRegion)) return bodyRegion as string
  const region = await regionFromRequest(request)
  return region === ALL_REGIONS ? await getActiveRegion() : region
}

/**
 * Mongo filter for a region-scoped collection. "all" matches everything;
 * a real region also matches legacy documents written before regions existed,
 * which are Bauchi's.
 *
 * CAUTION: for Bauchi this returns an `$or`. Spreading it into an object that
 * also has its own `$or` key silently drops the region filter — combine them
 * with `$and: [regionFilter(region), { $or: [...] }]` instead.
 */
export function regionFilter(region: string): Record<string, unknown> {
  if (region === ALL_REGIONS) return {}
  if (region === DEFAULT_REGION) {
    return { $or: [{ region: DEFAULT_REGION }, { region: { $exists: false } }, { region: null }] }
  }
  return { region }
}
