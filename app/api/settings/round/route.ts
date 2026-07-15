import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, SettingModel, TeamModel } from "@/lib/mongodb"

const ROUND_KEY = "current_round"

async function readRound() {
  const setting = await SettingModel.findOne({ key: ROUND_KEY }).lean()
  const round = setting ? parseInt(setting.value, 10) : 1
  return Number.isFinite(round) && round > 0 ? round : 1
}

export async function GET() {
  try {
    await connectToDatabase()
    return NextResponse.json({ round: await readRound() })
  } catch (error) {
    console.error("[GET_ROUND_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch round" }, { status: 500 })
  }
}

const roundSchema = z.object({
  // "advance" starts the next round; "set" jumps to a specific round number.
  action: z.enum(["advance", "set"]).default("advance"),
  round: z.number().int().positive().optional(),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}))
    const parsed = roundSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    const current = await readRound()
    const next = parsed.data.action === "set" && parsed.data.round ? parsed.data.round : current + 1

    await SettingModel.findOneAndUpdate(
      { key: ROUND_KEY },
      { value: String(next) },
      { upsert: true, new: true }
    )

    // A new round starts from a clean slate: close every team's voting.
    await TeamModel.updateMany({}, { $set: { votingOpen: false } })

    return NextResponse.json({ round: next })
  } catch (error) {
    console.error("[UPDATE_ROUND_ERROR]", error)
    return NextResponse.json({ error: "Failed to update round" }, { status: 500 })
  }
}
