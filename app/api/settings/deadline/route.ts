import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { regionFromRequest, regionForWrite } from "@/lib/regions"
import { readRegionSetting, writeRegionSetting } from "@/lib/settings"

const DEADLINE_KEY = "voting_deadline"

// Voting deadline is stored per region as an ISO timestamp; empty string means
// no deadline. The cast route enforces it server-side, so voting auto-closes on
// time even if no admin is online.
const deadlineSchema = z.object({
  deadline: z.union([z.string().datetime({ offset: true }), z.literal(""), z.null()]),
  region: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const region = await regionFromRequest(request)
    const value = await readRegionSetting(region, DEADLINE_KEY)
    return NextResponse.json({ deadline: value || null, region })
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

    const region = await regionForWrite(request, parsed.data.region)
    const value = parsed.data.deadline || ""
    await writeRegionSetting(region, DEADLINE_KEY, value)

    return NextResponse.json({ deadline: value || null, region })
  } catch (error) {
    console.error("[UPDATE_DEADLINE_ERROR]", error)
    return NextResponse.json({ error: "Failed to update deadline" }, { status: 500 })
  }
}
