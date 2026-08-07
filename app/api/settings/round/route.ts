import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, SettingModel, TeamModel } from "@/lib/mongodb"

const ROUND_KEY = "current_round"
const ROUND_LABEL_KEY = "round_label"

async function readRound() {
  const setting = await SettingModel.findOne({ key: ROUND_KEY }).lean()
  const round = setting ? parseInt(setting.value, 10) : 1
  return Number.isFinite(round) && round > 0 ? round : 1
}

async function readLabel() {
  const setting = await SettingModel.findOne({ key: ROUND_LABEL_KEY }).lean()
  return setting?.value ?? ""
}

export async function GET() {
  try {
    await connectToDatabase()
    const [round, label] = await Promise.all([readRound(), readLabel()])
    return NextResponse.json({ round, label })
  } catch (error) {
    console.error("[GET_ROUND_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch round" }, { status: 500 })
  }
}

const roundSchema = z.object({
  // "advance" starts the next round; "set" jumps to a specific round number;
  // "label" only renames the current round (e.g. "Bauchi — Blind Audition Revival").
  action: z.enum(["advance", "set", "label"]).default("advance"),
  round: z.number().int().positive().optional(),
  label: z.string().max(80).optional(),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}))
    const parsed = roundSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    if (parsed.data.action === "label") {
      const label = (parsed.data.label ?? "").trim()
      await SettingModel.findOneAndUpdate(
        { key: ROUND_LABEL_KEY },
        { value: label },
        { upsert: true }
      )
      return NextResponse.json({ round: await readRound(), label })
    }

    const current = await readRound()
    const next = parsed.data.action === "set" && parsed.data.round ? parsed.data.round : current + 1

    await SettingModel.findOneAndUpdate(
      { key: ROUND_KEY },
      { value: String(next) },
      { upsert: true, new: true }
    )

    // A new round starts from a clean slate: close every team's voting, zero
    // every poet's vote counter (previous rounds' votes must not carry into the
    // next stage's ranking — full history stays in the votes collection), and
    // drop the old round's name so reports can't mislabel the new event.
    const label = (parsed.data.label ?? "").trim()
    await Promise.all([
      TeamModel.updateMany({}, { $set: { votingOpen: false, "participants.$[].votes": 0 } }),
      SettingModel.findOneAndUpdate({ key: ROUND_LABEL_KEY }, { value: label }, { upsert: true }),
    ])

    return NextResponse.json({ round: next, label })
  } catch (error) {
    console.error("[UPDATE_ROUND_ERROR]", error)
    return NextResponse.json({ error: "Failed to update round" }, { status: 500 })
  }
}
