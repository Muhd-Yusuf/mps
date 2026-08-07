import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, SettingModel } from "@/lib/mongodb"

const START_KEY = "voting_start"

// When voting OPENS, stored as an ISO timestamp; empty string means voting is
// open immediately (no scheduled start). The cast route enforces it server-side
// and the landing page shows a live "Voting starts in…" countdown.
const startSchema = z.object({
  start: z.union([z.string().datetime({ offset: true }), z.literal(""), z.null()]),
})

export async function GET() {
  try {
    await connectToDatabase()
    const setting = await SettingModel.findOne({ key: START_KEY }).lean()
    return NextResponse.json({ start: setting?.value || null })
  } catch (error) {
    console.error("[GET_START_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch voting start" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = startSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid start time — send an ISO date-time or empty to clear" }, { status: 400 })
    }

    await connectToDatabase()

    const value = parsed.data.start || ""
    await SettingModel.findOneAndUpdate({ key: START_KEY }, { value }, { upsert: true })

    return NextResponse.json({ start: value || null })
  } catch (error) {
    console.error("[UPDATE_START_ERROR]", error)
    return NextResponse.json({ error: "Failed to update voting start" }, { status: 500 })
  }
}
