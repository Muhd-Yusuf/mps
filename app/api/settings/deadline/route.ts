import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, SettingModel } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"

const DEADLINE_KEY = "voting_deadline"

// Voting deadline is stored as an ISO timestamp; empty string means no deadline.
// The cast route enforces it server-side, so voting auto-closes on time even if
// no admin is online.
const deadlineSchema = z.object({
  deadline: z.union([z.string().datetime({ offset: true }), z.literal(""), z.null()]),
})

export async function GET() {
  try {
    await connectToDatabase()
    const setting = await SettingModel.findOne({ key: DEADLINE_KEY }).lean()
    return NextResponse.json({ deadline: setting?.value || null })
  } catch (error) {
    console.error("[GET_DEADLINE_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch deadline" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const payload = await request.json()
    const parsed = deadlineSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid deadline — send an ISO date-time or empty to clear" }, { status: 400 })
    }

    await connectToDatabase()

    const value = parsed.data.deadline || ""
    await SettingModel.findOneAndUpdate({ key: DEADLINE_KEY }, { value }, { upsert: true })

    return NextResponse.json({ deadline: value || null })
  } catch (error) {
    console.error("[UPDATE_DEADLINE_ERROR]", error)
    return NextResponse.json({ error: "Failed to update deadline" }, { status: 500 })
  }
}
