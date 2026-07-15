import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, SettingModel } from "@/lib/mongodb"

const LABEL_KEY = "team_label"
const DEFAULT_LABEL = "Team"

export async function GET() {
  try {
    await connectToDatabase()
    const setting = await SettingModel.findOne({ key: LABEL_KEY }).lean()
    return NextResponse.json({ label: setting?.value || DEFAULT_LABEL })
  } catch (error) {
    console.error("[GET_LABEL_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch label" }, { status: 500 })
  }
}

const labelSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(30),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = labelSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    const updated = await SettingModel.findOneAndUpdate(
      { key: LABEL_KEY },
      { value: parsed.data.label },
      { upsert: true, new: true, lean: true }
    )

    return NextResponse.json({ label: updated?.value || DEFAULT_LABEL })
  } catch (error) {
    console.error("[UPDATE_LABEL_ERROR]", error)
    return NextResponse.json({ error: "Failed to update label" }, { status: 500 })
  }
}
