import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { verifyAdminPassword } from "@/lib/admin-password"
import { getOtpEmail, setOtpEmail } from "@/lib/admin-otp"

// The address that receives admin login codes. Storing one turns the second
// factor ON; clearing it turns it back off (password-only login).
// Admin-session gated in BOTH directions — the address is never public, and
// changing it also requires the current admin password, so a walk-up on an open
// dashboard can't redirect login codes to an attacker's inbox.
const schema = z.object({
  email: z.union([z.string().trim().email("Enter a valid email address"), z.literal("")]),
  currentPassword: z.string().min(1, "Your admin password is required"),
})

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const email = await getOtpEmail()
    return NextResponse.json({ email, enabled: Boolean(email) })
  } catch (error) {
    console.error("[GET_OTP_EMAIL_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch login email" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request"
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (!(await verifyAdminPassword(parsed.data.currentPassword))) {
      return NextResponse.json({ error: "Admin password is incorrect" }, { status: 403 })
    }

    await setOtpEmail(parsed.data.email)
    const email = await getOtpEmail()
    return NextResponse.json({ email, enabled: Boolean(email) })
  } catch (error) {
    console.error("[UPDATE_OTP_EMAIL_ERROR]", error)
    return NextResponse.json({ error: "Failed to save login email" }, { status: 500 })
  }
}
