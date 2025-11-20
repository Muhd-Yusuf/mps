import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, SettingModel } from "@/lib/mongodb"

const stageSchema = z.object({
  value: z.string().min(1, "Stage value is required"),
})

export async function GET() {
  try {
    await connectToDatabase()
    const setting = await SettingModel.findOne({ key: "current_stage" }).lean()

    if (!setting) {
      return NextResponse.json({ stage: "Not Set" })
    }

    return NextResponse.json({ stage: setting.value })
  } catch (error) {
    console.error("[GET_STAGE_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch stage" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = stageSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    const updatedSetting = await SettingModel.findOneAndUpdate(
      { key: "current_stage" },
      { value: parsed.data.value },
      { upsert: true, new: true, lean: true }
    )

    return NextResponse.json({ stage: updatedSetting.value }, { status: 200 })
  } catch (error) {
    console.error("[UPDATE_STAGE_ERROR]", error)
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 })
  }
}
