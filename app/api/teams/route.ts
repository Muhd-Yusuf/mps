import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"

import { connectToDatabase, TeamModel } from "@/lib/mongodb"
import { authOptions } from "@/lib/auth"
import { finalizeStageIfDue } from "@/lib/finalize"

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

// Vote counts are admin-only: the audience must never see results or
// leaderboards, so public responses always report votes as 0.
function serializeTeam(team: any, includeVotes = true) {
  return {
    id: team._id.toString(),
    name: team.name,
    color: team.color,
    coach: team.coach,
    votingOpen: team.votingOpen ?? false,
    order: team.order ?? 0,
    participants: (team.participants || []).map((participant: any) => ({
      id: participant._id?.toString() ?? "",
      name: participant.name,
      image: participant.image,
      votes: includeVotes ? participant.votes ?? 0 : 0,
      inDanger: participant.inDanger ?? false,
      teamId: team._id.toString(),
      createdAt: participant.createdAt?.toISOString?.() ?? participant.createdAt,
      updatedAt: participant.updatedAt?.toISOString?.() ?? participant.updatedAt,
    })),
    createdAt: team.createdAt?.toISOString?.() ?? team.createdAt,
    updatedAt: team.updatedAt?.toISOString?.() ?? team.updatedAt,
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    await connectToDatabase()
    // Applies the automatic top-N advancement the first time anyone loads
    // teams after a danger-stage deadline has passed.
    await finalizeStageIfDue().catch((error) => console.error("[AUTO_FINALIZE_ERROR]", error))
    const teams = await TeamModel.find().sort({ order: 1, createdAt: 1 }).lean()

    return NextResponse.json({ teams: teams.map((team) => serializeTeam(team, Boolean(session))) })
  } catch (error) {
    console.error("[GET_TEAMS_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = teamSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    const participants = (parsed.data.participants || []).map((participant) => ({
      name: participant.name.trim(),
      image: normalizeString(participant.image),
      votes: participant.votes ?? 0,
    }))
    const coach = {
      name: parsed.data.coach.name.trim(),
      email: normalizeString(parsed.data.coach.email),
      phone: normalizeString(parsed.data.coach.phone),
      image: normalizeString(parsed.data.coach.image),
    }

    const document = {
      name: parsed.data.name.trim(),
      color: parsed.data.color.trim(),
      coach,
      participants,
    }

    const createdTeam = await TeamModel.create(document)

    return NextResponse.json({ team: serializeTeam(createdTeam.toObject()) }, { status: 201 })
  } catch (error) {
    console.error("[CREATE_TEAM_ERROR]", error)
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 })
  }
}

