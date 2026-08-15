import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, SettingModel } from "@/lib/mongodb"
import { STAGE_PRESETS, getPreset, presetFromMode } from "@/lib/stages"
import { requireAdmin } from "@/lib/auth"

const PRESET_KEY = "stage_preset"
const MODE_KEY = "voting_mode"

const presetSchema = z.object({
  preset: z.enum(STAGE_PRESETS.map((p) => p.key) as [string, ...string[]]),
})

export async function GET() {
  try {
    await connectToDatabase()
    const [presetSetting, modeSetting] = await Promise.all([
      SettingModel.findOne({ key: PRESET_KEY }).lean(),
      SettingModel.findOne({ key: MODE_KEY }).lean(),
    ])
    // Older deployments only stored voting_mode — map it to the closest preset.
    const preset = presetSetting?.value
      ? getPreset(presetSetting.value)
      : presetFromMode(modeSetting?.value)
    return NextResponse.json({ preset: preset.key })
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

    await connectToDatabase()

    const preset = getPreset(parsed.data.preset)

    // The preset is the admin-facing choice; voting_mode stays the low-level
    // mechanic the cast/payment routes read. Keep them in sync atomically-ish.
    await Promise.all([
      SettingModel.findOneAndUpdate({ key: PRESET_KEY }, { value: preset.key }, { upsert: true }),
      SettingModel.findOneAndUpdate({ key: MODE_KEY }, { value: preset.mode }, { upsert: true }),
    ])

    return NextResponse.json({ preset: preset.key })
  } catch (error) {
    console.error("[UPDATE_PRESET_ERROR]", error)
    return NextResponse.json({ error: "Failed to update stage preset" }, { status: 500 })
  }
}
