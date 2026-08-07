import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"

import { connectToDatabase, TicketModel, VoteModel, TeamModel, SettingModel } from "@/lib/mongodb"

export async function POST(request: Request) {
  try {
    const payload = await request.json()

    // One ticket = one vote, in every stage. The array shape is kept for
    // backwards compatibility with the client, but exactly one pick is allowed.
    const voteSchema = z.object({
      votingCode: z.string().min(1, "Voting code is required"),
      selections: z
        .array(
          z.object({
            teamId: z.string(),
            participantId: z.string(),
          })
        )
        .length(1, "Select exactly one poet to vote for"),
    })

    const parsed = voteSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    // Current round: a ticket may only be used to vote in the round it was bought for.
    const roundSetting = await SettingModel.findOne({ key: "current_round" }).lean()
    const currentRound = roundSetting ? parseInt(roundSetting.value, 10) || 1 : 1

    // Stage mode: "teams" (regular team voting) or "danger" (blind-audition save vote).
    const modeSetting = await SettingModel.findOne({ key: "voting_mode" }).lean()
    const votingMode = modeSetting?.value === "danger" ? "danger" : "teams"

    // Voting window: both ends enforced server-side so the public countdown is
    // real — no votes before the scheduled start or after the deadline.
    const [startSetting, deadlineSetting] = await Promise.all([
      SettingModel.findOne({ key: "voting_start" }).lean(),
      SettingModel.findOne({ key: "voting_deadline" }).lean(),
    ])
    if (startSetting?.value) {
      const start = new Date(startSetting.value)
      if (!Number.isNaN(start.getTime()) && Date.now() < start.getTime()) {
        return NextResponse.json({ error: "Voting has not started yet" }, { status: 400 })
      }
    }
    if (deadlineSetting?.value) {
      const deadline = new Date(deadlineSetting.value)
      if (!Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime()) {
        return NextResponse.json({ error: "Voting has closed for this stage" }, { status: 400 })
      }
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

    // A ticket bought in an earlier round can't be used once a new round has started.
    if (ticket.round !== undefined && ticket.round !== null && ticket.round !== currentRound) {
      return NextResponse.json(
        { error: "This voting code was for a previous round and can no longer be used" },
        { status: 400 }
      )
    }

    const selection = parsed.data.selections[0]

    let teamObjectId: mongoose.Types.ObjectId
    try {
      teamObjectId = new mongoose.Types.ObjectId(selection.teamId)
    } catch {
      return NextResponse.json({ error: "Invalid team" }, { status: 400 })
    }

    const team = await TeamModel.findById(teamObjectId)
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 400 })
    }

    const participant = team.participants?.find((p: any) => p._id.toString() === selection.participantId)
    if (!participant) {
      return NextResponse.json({ error: "Poet not found" }, { status: 400 })
    }

    if (votingMode === "danger") {
      // Danger Zone: only poets not chosen by any coach are votable, regardless
      // of whether their original team is open.
      if (!participant.inDanger) {
        return NextResponse.json({ error: "This poet is not in the Danger Zone vote" }, { status: 400 })
      }
    } else {
      if (!team.votingOpen) {
        return NextResponse.json({ error: `Voting for ${team.name} is not open` }, { status: 400 })
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

    await VoteModel.create({
      ticketId: ticket._id,
      participantId: selection.participantId,
      teamId: selection.teamId,
      round: currentRound,
    })

    await TeamModel.updateOne(
      { _id: teamObjectId, "participants._id": new mongoose.Types.ObjectId(selection.participantId) },
      { $inc: { "participants.$.votes": 1 } }
    )

    return NextResponse.json({
      success: true,
      message: "Vote cast successfully",
      votesCount: 1,
    })
  } catch (error: any) {
    console.error("[CAST_VOTE_ERROR]", error)
    return NextResponse.json({ error: error?.message ?? "Failed to cast vote" }, { status: 500 })
  }
}
