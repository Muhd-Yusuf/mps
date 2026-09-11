import { randomInt } from "crypto"

import { connectToDatabase, SettingModel } from "./mongodb"
import { hashPassword, verifyHash } from "./admin-password"

// Second factor for admin login. The destination address is set by an admin in
// Settings → Login Security; OTP is required ONLY while an address is stored, so
// the dashboard can never lock itself out before the feature is configured.
// Break-glass: delete the `admin_otp_email` doc from the settings collection.
export const OTP_EMAIL_KEY = "admin_otp_email"
const OTP_PENDING_KEY = "admin_otp_pending"

const CODE_LENGTH = 6
export const OTP_EXPIRY_MINUTES = 10
const EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000
const MAX_ATTEMPTS = 5
const RESEND_COOLDOWN_MS = 60 * 1000

interface PendingOtp {
  hash: string
  expiresAt: number
  sentAt: number
  attempts: number
}

export async function getOtpEmail(): Promise<string | null> {
  await connectToDatabase()
  const setting = await SettingModel.findOne({ key: OTP_EMAIL_KEY }).lean()
  return setting?.value?.trim() || null
}

export async function setOtpEmail(email: string): Promise<void> {
  await connectToDatabase()
  await SettingModel.findOneAndUpdate(
    { key: OTP_EMAIL_KEY },
    { value: email.trim().toLowerCase() },
    { upsert: true }
  )
  // Changing (or clearing) the destination invalidates any code already in
  // flight, so a code mailed to the old address can't be used afterwards.
  await SettingModel.deleteOne({ key: OTP_PENDING_KEY })
}

// "muhammad@gmail.com" -> "muh•••@gmail.com". Enough for an admin to recognise
// their own inbox without disclosing the full address on the login screen.
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return "•••"
  const visible = local.slice(0, Math.min(3, local.length))
  return `${visible}•••@${domain}`
}

async function readPending(): Promise<PendingOtp | null> {
  const setting = await SettingModel.findOne({ key: OTP_PENDING_KEY }).lean()
  if (!setting?.value) return null
  try {
    return JSON.parse(setting.value) as PendingOtp
  } catch {
    return null
  }
}

/**
 * Generate a fresh code, store it hashed, and return the plaintext for mailing.
 * Returns `cooldown` (seconds) instead when one was sent less than a minute ago,
 * so a caller with the right password still can't flood the admin's inbox.
 */
export async function issueOtp(): Promise<{ code: string } | { cooldown: number }> {
  await connectToDatabase()

  const pending = await readPending()
  const now = Date.now()
  if (pending && now - pending.sentAt < RESEND_COOLDOWN_MS) {
    return { cooldown: Math.ceil((RESEND_COOLDOWN_MS - (now - pending.sentAt)) / 1000) }
  }

  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0")
  const record: PendingOtp = {
    hash: hashPassword(code),
    expiresAt: now + EXPIRY_MS,
    sentAt: now,
    attempts: 0,
  }

  await SettingModel.findOneAndUpdate(
    { key: OTP_PENDING_KEY },
    { value: JSON.stringify(record) },
    { upsert: true }
  )

  return { code }
}

/**
 * Check a submitted code and burn it. A code is single-use: any outcome other
 * than "wrong but attempts remain" clears the pending record.
 */
export async function verifyAndConsumeOtp(code: string): Promise<boolean> {
  await connectToDatabase()

  const pending = await readPending()
  if (!pending) return false

  if (Date.now() > pending.expiresAt || pending.attempts >= MAX_ATTEMPTS) {
    await SettingModel.deleteOne({ key: OTP_PENDING_KEY })
    return false
  }

  const submitted = code.trim()
  const isMatch = submitted.length === CODE_LENGTH && verifyHash(submitted, pending.hash)

  if (!isMatch) {
    const attempts = pending.attempts + 1
    if (attempts >= MAX_ATTEMPTS) {
      await SettingModel.deleteOne({ key: OTP_PENDING_KEY })
    } else {
      await SettingModel.findOneAndUpdate(
        { key: OTP_PENDING_KEY },
        { value: JSON.stringify({ ...pending, attempts }) }
      )
    }
    return false
  }

  await SettingModel.deleteOne({ key: OTP_PENDING_KEY })
  return true
}
