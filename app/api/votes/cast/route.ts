import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"

import { connectToDatabase, TicketModel, VoteModel, TeamModel, SettingModel } from "@/lib/mongodb"

const voteSchema = z.object({
  votingCode: z.string().min(1, "Voting code is required"),
  selections: z.record(z.string(), z.string()).refine((data) => Object.keys(data).length > 0, {
    message: "At least one selection is required",
  }),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json()

    // Define schema here to handle the new structure
    const voteSchema = z.object({
      votingCode: z.string().min(1, "Voting code is required"),
      selections: z.array(z.object({
        teamId: z.string(),
        participantId: z.string()
      })).min(1, "At least one selection is required")
    })

    const parsed = voteSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    // Get max votes setting
    const setting = await SettingModel.findOne({ key: "max_votes_per_ticket" }).lean()
    const maxVotes = setting ? parseInt(setting.value, 10) : 3 // Default to 3

    if (parsed.data.selections.length > maxVotes) {
      return NextResponse.json({
        error: `You can only vote for up to ${maxVotes} contestants`
      }, { status: 400 })
    }

    // One contestant per team: reject duplicate teams in the same submission.
    const selectionTeamIds = parsed.data.selections.map((s) => s.teamId)
    if (new Set(selectionTeamIds).size !== selectionTeamIds.length) {
      return NextResponse.json({ error: "You can only vote for one contestant per team" }, { status: 400 })
    }

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
    const teamIds = [...new Set(parsed.data.selections.map(s => s.teamId))].map((id) => {
      try {
        return new mongoose.Types.ObjectId(id)
      } catch {
        return null
      }
    }).filter(Boolean) as mongoose.Types.ObjectId[]

    const teams = await TeamModel.find({ _id: { $in: teamIds } })

    // Verify participants belong to their teams and that each team is open for voting.
    for (const selection of parsed.data.selections) {
      const team = teams.find((t) => t._id.toString() === selection.teamId)
      if (!team) {
        return NextResponse.json({ error: `Team ${selection.teamId} not found` }, { status: 400 })
      }

      if (!team.votingOpen) {
        return NextResponse.json({ error: `Voting for ${team.name} is not open` }, { status: 400 })
      }

      const participant = team.participants?.find((p: any) => p._id.toString() === selection.participantId)
      if (!participant) {
        return NextResponse.json({ error: `Participant ${selection.participantId} not found in team ${selection.teamId}` }, { status: 400 })
      }
    }

    // Atomically claim this ticket for voting to prevent double-submit races.
    // Only one request can flip hasVoted false -> true; the rest get rejected here.
    const claimedTicket = await TicketModel.findOneAndUpdate(
      { _id: ticket._id, isPaid: true, hasVoted: false },
      { $set: { hasVoted: true } }
    )

    if (!claimedTicket) {
      return NextResponse.json({ error: "This voting code has already been used" }, { status: 400 })
    }

    // Create votes
    const votes = await Promise.all(
      parsed.data.selections.map(({ teamId, participantId }) =>
        VoteModel.create({
          ticketId: ticket._id,
          participantId,
          teamId,
        })
      )
    )

    // Update participant vote counts
    for (const { teamId, participantId } of parsed.data.selections) {
      try {
        await TeamModel.updateOne(
          { _id: new mongoose.Types.ObjectId(teamId), "participants._id": new mongoose.Types.ObjectId(participantId) },
          { $inc: { "participants.$.votes": 1 } }
        )
      } catch (error) {
        console.error(`Failed to update votes for team ${teamId}, participant ${participantId}:`, error)
      }
    }

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

