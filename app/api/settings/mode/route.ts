import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { regionFromRequest, regionForWrite } from "@/lib/regions"
import { readRegionSetting, writeRegionSetting } from "@/lib/settings"

const MODE_KEY = "voting_mode"
const DEFAULT_MODE = "teams"

// "teams"  — regular stage: voters pick a poet from the open teams.
// "danger" — blind-audition Danger Zone: poets not chosen by any coach are
//            listed with no team grouping and the public votes on who stays.
const modeSchema = z.object({
  mode: z.enum(["teams", "danger"]),
  region: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const region = await regionFromRequest(request)
    const value = await readRegionSetting(region, MODE_KEY)
    return NextResponse.json({ mode: value === "danger" ? "danger" : DEFAULT_MODE, region })
  } catch (error) {
    console.error("[GET_MODE_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch voting mode" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const payload = await request.json()
    const parsed = modeSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const region = await regionForWrite(request, parsed.data.region)
    await writeRegionSetting(region, MODE_KEY, parsed.data.mode)

    return NextResponse.json({ mode: parsed.data.mode, region })
  } catch (error) {
    console.error("[UPDATE_MODE_ERROR]", error)
    return NextResponse.json({ error: "Failed to update voting mode" }, { status: 500 })
  }
}
