import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { regionFromRequest, regionForWrite } from "@/lib/regions"
import { readRegionSetting, writeRegionSetting } from "@/lib/settings"

const STAGE_KEY = "current_stage"

const stageSchema = z.object({
  value: z.string().min(1, "Stage value is required"),
  region: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const region = await regionFromRequest(request)
    const value = await readRegionSetting(region, STAGE_KEY)
    return NextResponse.json({ stage: value || "Not Set", region })
  } catch (error) {
    console.error("[GET_STAGE_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch stage" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const payload = await request.json()
    const parsed = stageSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const region = await regionForWrite(request, parsed.data.region)
    await writeRegionSetting(region, STAGE_KEY, parsed.data.value)

    return NextResponse.json({ stage: parsed.data.value, region }, { status: 200 })
  } catch (error) {
    console.error("[UPDATE_STAGE_ERROR]", error)
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 })
  }
}
