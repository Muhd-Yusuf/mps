import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { verifyAdminPassword, setAdminPassword } from "@/lib/admin-password"

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
})

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

    // Re-verify the current password even though the session is valid, so a
    // walk-up on an open session can't silently change it.
    if (!(await verifyAdminPassword(parsed.data.currentPassword))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 })
    }

    await setAdminPassword(parsed.data.newPassword)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[CHANGE_PASSWORD_ERROR]", error)
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 })
  }
}
