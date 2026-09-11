import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { verifyAdminPassword } from "@/lib/admin-password"
import { getOtpEmail, issueOtp, maskEmail, OTP_EXPIRY_MINUTES } from "@/lib/admin-otp"
import { sendEmail, createAdminOtpEmailTemplate, createAdminOtpEmailText } from "@/lib/brevo"

// Step 1 of admin login: the password is checked here and, if an OTP address is
// configured, a one-time code is mailed out. The code itself is never returned —
// it only reaches the configured inbox. A valid password is required before any
// mail is sent, so this endpoint can't be used to flood the admin's inbox.
const schema = z.object({
  password: z.string().optional(),
  // Settings → "Send test code", for an already-authenticated admin verifying
  // delivery before they start relying on OTP.
  test: z.boolean().optional(),
})

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const { password, test } = parsed.data

    if (test) {
      const session = await requireAdmin()
      if (!session) {
        return NextResponse.json({ error: "Admin session required" }, { status: 401 })
      }
    } else if (!password || !(await verifyAdminPassword(password))) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
    }

    const email = await getOtpEmail()
    if (!email) {
      // No address configured — login stays password-only.
      return NextResponse.json({ otpRequired: false })
    }

    const result = await issueOtp()
    const sentTo = maskEmail(email)

    if ("cooldown" in result) {
      return NextResponse.json({
        otpRequired: true,
        sentTo,
        cooldown: result.cooldown,
        message: `A code was already sent to ${sentTo}. Check your inbox — you can request another in ${result.cooldown}s.`,
      })
    }

    await sendEmail({
      to: email,
      subject: `${result.code} is your admin login code`,
      htmlContent: createAdminOtpEmailTemplate(result.code, OTP_EXPIRY_MINUTES),
      textContent: createAdminOtpEmailText(result.code, OTP_EXPIRY_MINUTES),
    })

    return NextResponse.json({
      otpRequired: true,
      sentTo,
      message: `Code sent to ${sentTo}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    })
  } catch (error) {
    console.error("[ADMIN_OTP_ERROR]", error)
    return NextResponse.json(
      { error: "Could not send the login code. Check the email settings and try again." },
      { status: 502 }
    )
  }
}
