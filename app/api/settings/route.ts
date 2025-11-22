import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, SettingModel } from "@/lib/mongodb"

const settingsSchema = z.object({
    maxVotes: z.number().min(1, "Max votes must be at least 1"),
})

export async function GET() {
    try {
        await connectToDatabase()
        const setting = await SettingModel.findOne({ key: "max_votes_per_ticket" }).lean()

        if (!setting) {
            // Default to 3 if not set
            return NextResponse.json({ maxVotes: 3 })
        }

        return NextResponse.json({ maxVotes: parseInt(setting.value, 10) })
    } catch (error) {
        console.error("[GET_SETTINGS_ERROR]", error)
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const payload = await request.json()
        const parsed = settingsSchema.safeParse(payload)

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
        }

        await connectToDatabase()

        const updatedSetting = await SettingModel.findOneAndUpdate(
            { key: "max_votes_per_ticket" },
            { value: parsed.data.maxVotes.toString() },
            { upsert: true, new: true, lean: true }
        )

        if (!updatedSetting) {
            throw new Error("Failed to save setting")
        }

        return NextResponse.json({ maxVotes: parseInt(updatedSetting.value, 10) }, { status: 200 })
    } catch (error) {
        console.error("[UPDATE_SETTINGS_ERROR]", error)
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
    }
}
