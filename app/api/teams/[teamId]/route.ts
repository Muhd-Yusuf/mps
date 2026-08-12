import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"

import { connectToDatabase, TeamModel } from "@/lib/mongodb"

const coachSchema = z.object({
  name: z.string().min(1, "Coach name is required"),
  email: z
    .string()
    .email("Coach email must be valid")
    .optional()
    .or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  image: z.string().url("Coach image must be a valid URL").optional().or(z.literal("")),
})

const participantSchema = z.object({
  // Existing poets carry their id so edits (even renames) keep votes/flags.
  id: z.string().optional(),
  name: z.string().min(1, "Participant name is required"),
  image: z.string().url("Participant image must be a valid URL").optional().or(z.literal("")),
  votes: z.number().int().nonnegative().optional().default(0),
})

const teamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  color: z.string().min(1, "Team color is required"),
  coach: coachSchema,
  participants: z.array(participantSchema).optional(),
})

function normalizeString(value?: string | null) {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function serializeTeam(team: any) {
  return {
    id: team._id.toString(),
    name: team.name,
    color: team.color,
    coach: team.coach,
    votingOpen: team.votingOpen ?? false,
    order: team.order ?? 0,
    participants: (team.participants || []).map((participant: any) => ({
      id: participant._id.toString(),
      name: participant.name,
      image: participant.image,
      votes: participant.votes ?? 0,
      teamId: team._id.toString(),
      createdAt: participant.createdAt?.toISOString?.() ?? participant.createdAt,
      updatedAt: participant.updatedAt?.toISOString?.() ?? participant.updatedAt,
    })),
    createdAt: team.createdAt?.toISOString?.() ?? team.createdAt,
    updatedAt: team.updatedAt?.toISOString?.() ?? team.updatedAt,
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params

  if (!teamId) {
    return NextResponse.json({ error: "Team ID is required" }, { status: 400 })
  }

  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    return NextResponse.json({ error: "Invalid team ID" }, { status: 400 })
  }

  try {
    const payload = await request.json()
    const parsed = teamSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    // MERGE with the existing roster instead of replacing it: matched poets
    // (by id, else by name) keep their _id, votes, danger flag and history —
    // editing a team or renaming a poet must never wipe votes.
    const existingTeam = await TeamModel.findById(teamId)
    if (!existingTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }
    const existing = existingTeam.participants ?? []
    const claimed = new Set<string>()
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")
    const participants = (parsed.data.participants || []).map((participant) => {
      const match =
        (participant.id &&
          existing.find((e: any) => e._id.toString() === participant.id && !claimed.has(e._id.toString()))) ||
        existing.find((e: any) => norm(e.name) === norm(participant.name) && !claimed.has(e._id.toString()))
      if (match) {
        claimed.add(match._id.toString())
        return {
          _id: match._id,
          name: participant.name.trim(),
          image: normalizeString(participant.image) ?? match.image,
          votes: match.votes ?? 0,
          inDanger: match.inDanger ?? false,
          originTeam: match.originTeam,
          createdAt: match.createdAt,
          updatedAt: new Date(),
        }
      }
      return {
        name: participant.name.trim(),
        image: normalizeString(participant.image),
        votes: 0,
        inDanger: false,
      }
    })
    const coach = {
      name: parsed.data.coach.name.trim(),
      email: normalizeString(parsed.data.coach.email),
      phone: normalizeString(parsed.data.coach.phone),
      image: normalizeString(parsed.data.coach.image),
    }

    const updatedTeam = await TeamModel.findByIdAndUpdate(
      teamId,
      {
        name: parsed.data.name.trim(),
        color: parsed.data.color.trim(),
        coach,
        participants,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    )

    if (!updatedTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    return NextResponse.json({ team: serializeTeam(updatedTeam.toObject()) })
  } catch (error) {
    console.error("[UPDATE_TEAM_ERROR]", error)
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 })
  }
}

const patchSchema = z.object({
  votingOpen: z.boolean().optional(),
  order: z.number().int().nonnegative().optional(),
  // Bulk danger flag: set every poet in this team in/out of the Danger Zone at
  // once (used when a whole stage's roster faces the audience vote).
  dangerAll: z.boolean().optional(),
})

// Partial update that never touches names/votes. Used to open/close a team
// for voting (any number of teams may be open at once), set its ordering, or
// bulk-flag its poets for a danger stage.
export async function PATCH(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params

  if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
    return NextResponse.json({ error: "Invalid team ID" }, { status: 400 })
  }

  try {
    const payload = await request.json()
    const parsed = patchSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    const update: Record<string, unknown> = {}
    if (parsed.data.votingOpen !== undefined) update.votingOpen = parsed.data.votingOpen
    if (parsed.data.order !== undefined) update.order = parsed.data.order
    if (parsed.data.dangerAll !== undefined) update["participants.$[].inDanger"] = parsed.data.dangerAll

    const updatedTeam = await TeamModel.findByIdAndUpdate(teamId, { $set: update }, { new: true })

    if (!updatedTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    return NextResponse.json({ team: serializeTeam(updatedTeam.toObject()) })
  } catch (error) {
    console.error("[PATCH_TEAM_ERROR]", error)
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params

  if (!teamId) {
    return NextResponse.json({ error: "Team ID is required" }, { status: 400 })
  }

  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    return NextResponse.json({ error: "Invalid team ID" }, { status: 400 })
  }

  try {
    await connectToDatabase()

    const deletedTeam = await TeamModel.findByIdAndDelete(teamId)

    if (!deletedTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Team deleted successfully", teamId })
  } catch (error) {
    console.error("[DELETE_TEAM_ERROR]", error)
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 })
  }
}

