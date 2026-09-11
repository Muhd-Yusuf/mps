import { connectToDatabase, SettingModel } from "./mongodb"
import { DEFAULT_REGION } from "./regions"

// Per-region settings live under a namespaced key: "kaduna:current_round".
// Everything that describes where a competition is right now — round, stage,
// schedule, labels — is scoped this way so each edition advances on its own.
//
// Genuinely global keys (admin_password_hash, admin_otp_email, active_region)
// keep their bare names and must NOT go through these helpers.
export function regionSettingKey(region: string, key: string): string {
  return `${region}:${key}`
}

/**
 * Read a region-scoped setting.
 *
 * Bauchi ran before regions existed, so its values may still sit under the old
 * un-namespaced key. For Bauchi only, fall back to that legacy key — this keeps
 * the live site correct whether or not the migration script has been run.
 */
export async function readRegionSetting(region: string, key: string): Promise<string | null> {
  await connectToDatabase()
  const scoped = await SettingModel.findOne({ key: regionSettingKey(region, key) }).lean()
  if (scoped?.value !== undefined && scoped?.value !== null) return scoped.value

  if (region === DEFAULT_REGION) {
    const legacy = await SettingModel.findOne({ key }).lean()
    if (legacy?.value !== undefined && legacy?.value !== null) return legacy.value
  }
  return null
}

export async function writeRegionSetting(region: string, key: string, value: string): Promise<void> {
  await connectToDatabase()
  await SettingModel.findOneAndUpdate(
    { key: regionSettingKey(region, key) },
    { value },
    { upsert: true }
  )
  // Keep the legacy un-namespaced key in step for Bauchi so anything still
  // reading the old key (and the pre-migration fallback above) stays accurate.
  if (region === DEFAULT_REGION) {
    await SettingModel.findOneAndUpdate({ key }, { value }, { upsert: true })
  }
}

export async function readRegionNumber(region: string, key: string, fallback: number): Promise<number> {
  const raw = await readRegionSetting(region, key)
  if (raw === null) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
