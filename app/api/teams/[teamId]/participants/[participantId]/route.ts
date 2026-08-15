import { NextResponse } from "next/server"
import { isValidObjectId, Types } from "mongoose"
import { z } from "zod"

import { connectToDatabase, TeamModel } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"

const patchSchema = z.object({
  inDanger: z.boolean().optional(),
  // Move the poet to another team (used when coaches pick their teams at the
  // Blind Audition). Votes, photo and danger flag travel with the poet.
  toTeamId: z.string().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; participantId: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
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

    await connectToDatabase()

    if (parsed.data.toTeamId !== undefined) {
      const { toTeamId } = parsed.data
      if (!isValidObjectId(toTeamId)) {
        return NextResponse.json({ error: "Invalid destination team ID" }, { status: 400 })
      }
      if (toTeamId === teamId) {
        return NextResponse.json({ error: "Poet is already in that team" }, { status: 400 })
      }

      const [sourceTeam, targetTeam] = await Promise.all([
        TeamModel.findById(teamId),
        TeamModel.findById(toTeamId),
      ])
      if (!sourceTeam || !targetTeam) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      const participant = sourceTeam.participants?.find((p: any) => p._id.toString() === participantId)
      if (!participant) {
        return NextResponse.json({ error: "Participant not found" }, { status: 404 })
      }

      // Copy into the destination first, then remove from the source — a crash
      // between the two leaves a visible duplicate rather than a lost poet.
      const poet = participant.toObject ? participant.toObject() : participant
      // Moving INTO Revived/Eliminated records where the poet came from;
      // moving into a real team clears it (they belong somewhere again).
      const archives = ["Revived", "Eliminated"]
      const originTeam = archives.includes(targetTeam.name)
        ? poet.originTeam || (archives.includes(sourceTeam.name) ? "" : sourceTeam.name)
        : ""
      await TeamModel.updateOne(
        { _id: targetTeam._id, "participants._id": { $ne: poet._id } },
        { $push: { participants: { ...poet, originTeam, updatedAt: new Date() } } }
      )
      await TeamModel.updateOne(
        { _id: sourceTeam._id },
        { $pull: { participants: { _id: poet._id } } }
      )

      return NextResponse.json({ success: true, movedTo: targetTeam.name })
    }

    const update: Record<string, unknown> = {}
    if (parsed.data.inDanger !== undefined) {
      update["participants.$.inDanger"] = parsed.data.inDanger
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

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
