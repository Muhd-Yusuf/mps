import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, SettingModel } from "@/lib/mongodb"

const REVEAL_KEY = "results_revealed"

// The manual forbids revealing results before the official announcement, so the
// public results page stays hidden until the admin flips this after the live event.
const revealSchema = z.object({
  revealed: z.boolean(),
})

export async function GET() {
  try {
    await connectToDatabase()
    const setting = await SettingModel.findOne({ key: REVEAL_KEY }).lean()
    return NextResponse.json({ revealed: setting?.value === "true" })
  } catch (error) {
    console.error("[GET_REVEAL_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch reveal state" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = revealSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: "Send { revealed: true | false }" }, { status: 400 })
    }

    await connectToDatabase()

    await SettingModel.findOneAndUpdate(
      { key: REVEAL_KEY },
      { value: parsed.data.revealed ? "true" : "false" },
      { upsert: true }
    )

    return NextResponse.json({ revealed: parsed.data.revealed })
  } catch (error) {
    console.error("[UPDATE_REVEAL_ERROR]", error)
    return NextResponse.json({ error: "Failed to update reveal state" }, { status: 500 })
  }
}
