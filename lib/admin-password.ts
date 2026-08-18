import { scryptSync, randomBytes, timingSafeEqual } from "crypto"

import { connectToDatabase, SettingModel } from "./mongodb"

const HASH_KEY = "admin_password_hash"

// Format: scrypt$<saltHex>$<hashHex>
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
}

export function verifyHash(password: string, stored: string): boolean {
  const parts = stored.split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false
  const salt = Buffer.from(parts[1], "hex")
  const expected = Buffer.from(parts[2], "hex")
  const actual = scryptSync(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// Verify a login attempt. The database hash is the source of truth once set;
// before an admin has ever changed the password, we fall back to the
// ADMIN_PASSWORD env var (bootstrap) and migrate it into the DB on first use.
export async function verifyAdminPassword(password: string): Promise<boolean> {
  await connectToDatabase()
  const setting = await SettingModel.findOne({ key: HASH_KEY }).lean()

  if (setting?.value) {
    return verifyHash(password, setting.value)
  }

  const envPassword = process.env.ADMIN_PASSWORD
  if (!envPassword) return false
  if (password !== envPassword) return false

  // First successful env-based login: migrate to a stored hash.
  await SettingModel.findOneAndUpdate(
    { key: HASH_KEY },
    { value: hashPassword(envPassword) },
    { upsert: true }
  )
  return true
}

export async function setAdminPassword(newPassword: string): Promise<void> {
  await connectToDatabase()
  await SettingModel.findOneAndUpdate(
    { key: HASH_KEY },
    { value: hashPassword(newPassword) },
    { upsert: true }
  )
}
