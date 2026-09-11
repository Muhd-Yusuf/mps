import { NextResponse } from "next/server"
import { z } from "zod"

import { STAGE_PRESETS, getPreset, presetFromMode } from "@/lib/stages"
import { requireAdmin } from "@/lib/auth"
import { regionFromRequest, regionForWrite } from "@/lib/regions"
import { readRegionSetting, writeRegionSetting } from "@/lib/settings"

const PRESET_KEY = "stage_preset"
const MODE_KEY = "voting_mode"

const presetSchema = z.object({
  preset: z.enum(STAGE_PRESETS.map((p) => p.key) as [string, ...string[]]),
  region: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const region = await regionFromRequest(request)
    const [presetValue, modeValue] = await Promise.all([
      readRegionSetting(region, PRESET_KEY),
      readRegionSetting(region, MODE_KEY),
    ])
    // Older deployments only stored voting_mode — map it to the closest preset.
    const preset = presetValue ? getPreset(presetValue) : presetFromMode(modeValue ?? undefined)
    return NextResponse.json({ preset: preset.key, region })
  } catch (error) {
    console.error("[GET_PRESET_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch stage preset" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const payload = await request.json()
    const parsed = presetSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const region = await regionForWrite(request, parsed.data.region)
    const preset = getPreset(parsed.data.preset)

    // The preset is the admin-facing choice; voting_mode stays the low-level
    // mechanic the cast/payment routes read. Keep them in sync.
    await Promise.all([
      writeRegionSetting(region, PRESET_KEY, preset.key),
      writeRegionSetting(region, MODE_KEY, preset.mode),
    ])

    return NextResponse.json({ preset: preset.key, region })
  } catch (error) {
    console.error("[UPDATE_PRESET_ERROR]", error)
    return NextResponse.json({ error: "Failed to update stage preset" }, { status: 500 })
  }
}
