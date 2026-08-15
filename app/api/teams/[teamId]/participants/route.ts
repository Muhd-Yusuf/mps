import { NextResponse } from "next/server"
import { isValidObjectId, Types } from "mongoose"
import { z } from "zod"

import { connectToDatabase, TeamModel } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"

const participantSchema = z.object({
  name: z.string().min(1, "Participant name is required"),
  image: z.string().url("Participant image must be a valid URL").optional().or(z.literal("")),
  votes: z.number().int().nonnegative().optional().default(0),
})

const payloadSchema = z.object({
  participants: z.array(participantSchema).min(1, "At least one participant is required"),
})

function normalizeString(value?: string | null) {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function serializeParticipant(participant: any, teamId: string) {
  return {
    id: (participant._id || new Types.ObjectId()).toString(),
    name: participant.name,
    image: participant.image,
    votes: participant.votes ?? 0,
    inDanger: participant.inDanger ?? false,
    teamId,
    createdAt: participant.createdAt?.toISOString?.() ?? participant.createdAt,
    updatedAt: participant.updatedAt?.toISOString?.() ?? participant.updatedAt,
  }
}

function serializeTeam(team: any) {
  return {
    id: team._id.toString(),
    name: team.name,
    color: team.color,
    coach: team.coach,
    participants: (team.participants || []).map((participant: any) => serializeParticipant(participant, team._id.toString())),
    createdAt: team.createdAt?.toISOString?.() ?? team.createdAt,
    updatedAt: team.updatedAt?.toISOString?.() ?? team.updatedAt,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  const { teamId } = await params

  if (!teamId) {
    return NextResponse.json({ error: "Team ID is required" }, { status: 400 })
  }

  if (!isValidObjectId(teamId)) {
    return NextResponse.json({ error: "Team ID is invalid" }, { status: 400 })
  }

  try {
    const payload = await request.json()
    const parsed = payloadSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    const participantsToAdd = parsed.data.participants.map((participant) => ({
      _id: new Types.ObjectId(),
      name: participant.name.trim(),
      image: normalizeString(participant.image),
      votes: participant.votes ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    const updateResult = await TeamModel.findByIdAndUpdate(
      teamId,
      {
        $push: {
          participants: {
            $each: participantsToAdd,
          },
        },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    )

    if (!updateResult) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    return NextResponse.json({ team: serializeTeam(updateResult.toObject()) })
  } catch (error) {
    console.error("[ADD_PARTICIPANTS_ERROR]", error)
    return NextResponse.json({ error: "Failed to add participants" }, { status: 500 })
  }
}

