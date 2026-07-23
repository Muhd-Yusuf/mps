import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, SettingModel } from "@/lib/mongodb"

const MODE_KEY = "voting_mode"
const DEFAULT_MODE = "teams"

// "teams"  — regular stage: voters pick a poet from the open teams.
// "danger" — blind-audition Danger Zone: poets not chosen by any coach are
//            listed with no team grouping and the public votes on who stays.
const modeSchema = z.object({
  mode: z.enum(["teams", "danger"]),
})

export async function GET() {
  try {
    await connectToDatabase()
    const setting = await SettingModel.findOne({ key: MODE_KEY }).lean()
    const mode = setting?.value === "danger" ? "danger" : DEFAULT_MODE
    return NextResponse.json({ mode })
  } catch (error) {
    console.error("[GET_MODE_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch voting mode" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = modeSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    const updated = await SettingModel.findOneAndUpdate(
      { key: MODE_KEY },
      { value: parsed.data.mode },
      { upsert: true, new: true, lean: true }
    )

    return NextResponse.json({ mode: updated?.value === "danger" ? "danger" : DEFAULT_MODE })
  } catch (error) {
    console.error("[UPDATE_MODE_ERROR]", error)
    return NextResponse.json({ error: "Failed to update voting mode" }, { status: 500 })
  }
}
