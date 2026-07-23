import { NextResponse } from "next/server"
import { isValidObjectId, Types } from "mongoose"
import { z } from "zod"

import { connectToDatabase, TeamModel } from "@/lib/mongodb"

const patchSchema = z.object({
  inDanger: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; participantId: string }> }
) {
  const { teamId, participantId } = await params

  if (!isValidObjectId(teamId) || !isValidObjectId(participantId)) {
    return NextResponse.json({ error: "Invalid team or participant ID" }, { status: 400 })
  }

  try {
    const payload = await request.json()
    const parsed = patchSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const update: Record<string, unknown> = {}
    if (parsed.data.inDanger !== undefined) {
      update["participants.$.inDanger"] = parsed.data.inDanger
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    await connectToDatabase()

    const result = await TeamModel.updateOne(
      {
        _id: new Types.ObjectId(teamId),
        "participants._id": new Types.ObjectId(participantId),
      },
      { $set: update }
    )

    if (!result.matchedCount) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[PATCH_PARTICIPANT_ERROR]", error)
    return NextResponse.json({ error: "Failed to update participant" }, { status: 500 })
  }
}
