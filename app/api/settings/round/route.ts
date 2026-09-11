import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, TeamModel } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import { regionFromRequest, regionForWrite, regionFilter } from "@/lib/regions"
import { readRegionNumber, readRegionSetting, writeRegionSetting } from "@/lib/settings"

const ROUND_KEY = "current_round"
const ROUND_LABEL_KEY = "round_label"

export async function GET(request: Request) {
  try {
    await connectToDatabase()
    const region = await regionFromRequest(request)
    const [round, label] = await Promise.all([
      readRegionNumber(region, ROUND_KEY, 1),
      readRegionSetting(region, ROUND_LABEL_KEY),
    ])
    return NextResponse.json({ round, label: label ?? "", region })
  } catch (error) {
    console.error("[GET_ROUND_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch round" }, { status: 500 })
  }
}

const roundSchema = z.object({
  // "advance" starts the next round; "set" jumps to a specific round number;
  // "label" only renames the current round (e.g. "Kaduna — Blind Audition Revival").
  action: z.enum(["advance", "set", "label"]).default("advance"),
  round: z.number().int().positive().optional(),
  label: z.string().max(80).optional(),
  region: z.string().optional(),
})

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const payload = await request.json().catch(() => ({}))
    const parsed = roundSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()
    const region = await regionForWrite(request, parsed.data.region)

    if (parsed.data.action === "label") {
      const label = (parsed.data.label ?? "").trim()
      await writeRegionSetting(region, ROUND_LABEL_KEY, label)
      return NextResponse.json({ round: await readRegionNumber(region, ROUND_KEY, 1), label, region })
    }

    const current = await readRegionNumber(region, ROUND_KEY, 1)
    const next = parsed.data.action === "set" && parsed.data.round ? parsed.data.round : current + 1

    await writeRegionSetting(region, ROUND_KEY, String(next))

    // A new round starts from a clean slate: close every team's voting, zero
    // every poet's vote counter (previous rounds' votes must not carry into the
    // next stage's ranking — full history stays in the votes collection), and
    // drop the old round's name so reports can't mislabel the new event.
    //
    // Scoped to THIS region: advancing Kaduna must never touch Bauchi's teams.
    const label = (parsed.data.label ?? "").trim()
    await Promise.all([
      TeamModel.updateMany(
        regionFilter(region),
        { $set: { votingOpen: false, "participants.$[].votes": 0, "participants.$[].inDanger": false } }
      ),
      writeRegionSetting(region, ROUND_LABEL_KEY, label),
    ])

    return NextResponse.json({ round: next, label, region })
  } catch (error) {
    console.error("[UPDATE_ROUND_ERROR]", error)
    return NextResponse.json({ error: "Failed to update round" }, { status: 500 })
  }
}
