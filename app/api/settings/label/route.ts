import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { regionFromRequest, regionForWrite } from "@/lib/regions"
import { readRegionSetting, writeRegionSetting } from "@/lib/settings"

const LABEL_KEY = "team_label"
const DEFAULT_LABEL = "Team"

export async function GET(request: Request) {
  try {
    const region = await regionFromRequest(request)
    const value = await readRegionSetting(region, LABEL_KEY)
    return NextResponse.json({ label: value || DEFAULT_LABEL, region })
  } catch (error) {
    console.error("[GET_LABEL_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch label" }, { status: 500 })
  }
}

const labelSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(30),
  region: z.string().optional(),
})

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const payload = await request.json()
    const parsed = labelSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const region = await regionForWrite(request, parsed.data.region)
    await writeRegionSetting(region, LABEL_KEY, parsed.data.label)

    return NextResponse.json({ label: parsed.data.label, region })
  } catch (error) {
    console.error("[UPDATE_LABEL_ERROR]", error)
    return NextResponse.json({ error: "Failed to update label" }, { status: 500 })
  }
}
