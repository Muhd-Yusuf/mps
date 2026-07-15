"use client"

import Image from "next/image"

import type { Team } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/spinner"

type AdminVotingResultsProps = {
  teams: Team[]
  isLoading: boolean
}

const placeholderImage = "/placeholder.svg"

export default function AdminVotingResults({ teams, isLoading }: AdminVotingResultsProps) {
  if (isLoading) {
    return (
      <Card className="border-border/40 bg-white backdrop-blur">
        <CardContent className="py-10">
          <LoadingSpinner size="lg" text="Loading voting results..." />
        </CardContent>
      </Card>
    )
  }

  if (!teams?.length) {
    return (
      <Card className="border-dashed border-border/50 bg-white backdrop-blur">
        <CardContent className="py-10 text-center text-muted-foreground">
          No teams found. Create a team to start tracking votes.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {teams.map((team) => {
        const teamParticipants = [...(team.participants ?? [])].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
        const totalVotes = teamParticipants.reduce((sum, participant) => sum + (participant.votes ?? 0), 0)
        const maxVotes = teamParticipants.length ? Math.max(...teamParticipants.map((participant) => participant.votes ?? 0)) : 0

        return (
          <Card key={team.id} className="bg-white border-border/40">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-border/40">
                  <Image
                    src={team.coach?.image || placeholderImage}
                    alt={team.coach?.name ?? "Coach"}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                <div>
                  <CardTitle className="text-foreground">{team.name}</CardTitle>
                  <CardDescription>
                    Coach: {team.coach?.name ?? "Unknown"} • Total votes: {totalVotes}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                {teamParticipants.length === 0 && (
                  <p className="text-sm text-muted-foreground">No poets yet for this team.</p>
                )}
                {teamParticipants.map((participant, index) => {
                  const votes = participant.votes ?? 0
                  const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0
                  const isLeading = index === 0 && votes > 0

                  return (
                    <div key={participant.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-border/40">
                            <Image
                              src={participant.image || placeholderImage}
                              alt={participant.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          {isLeading && <span className="text-yellow-500">★</span>}
                          <span className="font-medium text-foreground">{participant.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-muted-foreground">{votes} votes</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
