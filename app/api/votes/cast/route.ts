import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"

import { connectToDatabase, TicketModel, VoteModel, TeamModel } from "@/lib/mongodb"

const voteSchema = z.object({
  votingCode: z.string().min(1, "Voting code is required"),
  selections: z.record(z.string(), z.string()).refine((data) => Object.keys(data).length > 0, {
    message: "At least one selection is required",
  }),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = voteSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    // Verify ticket
    const ticket = await TicketModel.findOne({
      votingCode: parsed.data.votingCode.toUpperCase().trim(),
    })

    if (!ticket) {
      return NextResponse.json({ error: "Invalid voting code" }, { status: 404 })
    }

    if (!ticket.isPaid) {
      return NextResponse.json({ error: "Ticket payment not completed" }, { status: 400 })
    }

    if (ticket.hasVoted) {
      return NextResponse.json({ error: "This voting code has already been used" }, { status: 400 })
    }

    // Verify all teams and participants exist
    const teamIds = Object.keys(parsed.data.selections).map((id) => {
      try {
        return new mongoose.Types.ObjectId(id)
      } catch {
        return null
      }
    }).filter(Boolean) as mongoose.Types.ObjectId[]

    const teams = await TeamModel.find({ _id: { $in: teamIds } })
    if (teams.length !== Object.keys(parsed.data.selections).length) {
      return NextResponse.json({ error: "Invalid team selection" }, { status: 400 })
    }

    // Verify participants belong to their teams
    for (const [teamId, participantId] of Object.entries(parsed.data.selections)) {
      const team = teams.find((t) => t._id.toString() === teamId)
      if (!team) {
        return NextResponse.json({ error: `Team ${teamId} not found` }, { status: 400 })
      }

      const participant = team.participants?.find((p: any) => p._id.toString() === participantId)
      if (!participant) {
        return NextResponse.json({ error: `Participant ${participantId} not found in team ${teamId}` }, { status: 400 })
      }
    }

    // Create votes
    const votes = await Promise.all(
      Object.entries(parsed.data.selections).map(([teamId, participantId]) =>
        VoteModel.create({
          ticketId: ticket._id,
          participantId,
          teamId,
        })
      )
    )

    // Update participant vote counts
    for (const [teamId, participantId] of Object.entries(parsed.data.selections)) {
      try {
        await TeamModel.updateOne(
          { _id: new mongoose.Types.ObjectId(teamId), "participants._id": new mongoose.Types.ObjectId(participantId) },
          { $inc: { "participants.$.votes": 1 } }
        )
      } catch (error) {
        console.error(`Failed to update votes for team ${teamId}, participant ${participantId}:`, error)
      }
    }

    // Mark ticket as voted
    await TicketModel.findByIdAndUpdate(ticket._id, {
      hasVoted: true,
    })

    return NextResponse.json({
      success: true,
      message: "Votes cast successfully",
      votesCount: votes.length,
    })
  } catch (error: any) {
    console.error("[CAST_VOTE_ERROR]", error)
    return NextResponse.json({ error: error?.message ?? "Failed to cast votes" }, { status: 500 })
  }
}

