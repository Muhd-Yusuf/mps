"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

import type { Team, Participant } from "@/lib/types"
import { getPreset, type StagePreset } from "@/lib/stages"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/spinner"

type AdminVotingResultsProps = {
  teams: Team[]
  isLoading: boolean
}

const placeholderImage = "/placeholder.svg"

type RankedPoet = Participant & { teamName: string }

function AdvanceBadge({ preset }: { preset: StagePreset }) {
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white whitespace-nowrap"
      style={{ backgroundColor: preset.accentColor }}
    >
      {preset.results.advanceLabel}
    </span>
  )
}

function RankedList({
  poets,
  preset,
  cutoff,
  // Overall-slice stages rank across ALL teams: pass each poet's overall rank
  // and qualification so the list can render per-team without lying.
  rankOf,
  qualifiedIds,
  maxVotesOverride,
}: {
  poets: RankedPoet[]
  preset: StagePreset
  cutoff: number
  rankOf?: (poet: RankedPoet) => number
  qualifiedIds?: Set<string>
  maxVotesOverride?: number
}) {
  const maxVotes = maxVotesOverride ?? (poets.length ? Math.max(...poets.map((p) => p.votes ?? 0)) : 0)

  return (
    <div className="space-y-4">
      {poets.map((poet, index) => {
        const votes = poet.votes ?? 0
        const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0
        const qualifies = qualifiedIds
          ? qualifiedIds.has(poet.id)
          : cutoff > 0 && index < cutoff && votes > 0

        return (
          <div key={poet.id}>
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-bold text-muted-foreground w-5 text-right flex-shrink-0">
                  {rankOf ? rankOf(poet) : index + 1}
                </span>
                <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-border/40">
                  <Image src={poet.image || placeholderImage} alt={poet.name} fill className="object-cover" />
                </div>
                <span className="font-medium text-foreground truncate">{poet.name}</span>
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                  {poet.originTeam ? `from ${poet.originTeam}` : poet.teamName}
                </span>
                {qualifies && <AdvanceBadge preset={preset} />}
              </div>
              <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">{votes} votes</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${percentage}%`,
                  background: qualifies
                    ? preset.accentColor
                    : "linear-gradient(to right, #3b82f6, #2563eb)",
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminVotingResults({ teams, isLoading }: AdminVotingResultsProps) {
  const [preset, setPreset] = useState<StagePreset>(getPreset(null))

  useEffect(() => {
    fetch("/api/settings/preset", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPreset(getPreset(data.preset)))
      .catch(() => {})
  }, [])

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

  const { slice, advance } = preset.results
  const isDanger = preset.mode === "danger"

  // Danger stages: only flagged poets are votable, so results rank them alone.
  if (isDanger) {
    const dangerPoets: RankedPoet[] = teams.flatMap((team) =>
      (team.participants ?? [])
        .filter((p) => p.inDanger)
        .map((p) => ({ ...p, teamName: team.name }))
    )

    const banner = (
      <Card
        className="border-2"
        style={{ borderColor: preset.accentColor, background: `${preset.accentColor}0d` }}
      >
        <CardHeader>
          <CardTitle className="text-foreground">{preset.name}</CardTitle>
          <CardDescription>
            {slice === "perTeam"
              ? `The top ${advance} poet${advance > 1 ? "s" : ""} per team qualify by audience vote.`
              : `The top ${advance} poets overall qualify by audience vote.`}
          </CardDescription>
        </CardHeader>
      </Card>
    )

    if (!dangerPoets.length) {
      return (
        <div className="space-y-6">
          {banner}
          <Card className="border-dashed border-border/50 bg-white backdrop-blur">
            <CardContent className="py-10 text-center text-muted-foreground">
              No poets are flagged for this stage yet. Flag them from the Teams tab.
            </CardContent>
          </Card>
        </div>
      )
    }

    if (slice === "perTeam") {
      // Semi Final: rank within each team, top N per team qualify.
      const groups = teams
        .map((team) => ({
          team,
          poets: dangerPoets
            .filter((p) => (team.participants ?? []).some((tp) => tp.id === p.id))
            .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)),
        }))
        .filter((g) => g.poets.length > 0)

      return (
        <div className="space-y-6">
          {banner}
          {groups.map(({ team, poets }) => (
            <Card key={team.id} className="bg-white border-border/40">
              <CardHeader>
                <CardTitle className="text-foreground">{team.name}</CardTitle>
                <CardDescription>
                  Total votes: {poets.reduce((sum, p) => sum + (p.votes ?? 0), 0)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RankedList poets={poets} preset={preset} cutoff={advance} />
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    // Overall slice, displayed per team: rank and qualification are computed
    // across ALL flagged poets, then shown grouped under each team's card.
    const ranked = [...dangerPoets].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    const rankMap = new Map(ranked.map((p, i) => [p.id, i + 1]))
    const qualifiedIds = new Set(
      ranked.slice(0, advance).filter((p) => (p.votes ?? 0) > 0).map((p) => p.id)
    )
    const overallMax = ranked.length ? Math.max(...ranked.map((p) => p.votes ?? 0)) : 0
    const teamGroups = teams
      .map((team) => ({
        team,
        poets: dangerPoets
          .filter((p) => (team.participants ?? []).some((tp) => tp.id === p.id))
          .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)),
      }))
      .filter((g) => g.poets.length > 0)

    return (
      <div className="space-y-6">
        {banner}
        {teamGroups.map(({ team, poets }) => (
          <Card key={team.id} className="bg-white border-border/40">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-border/40">
                  <Image
                    src={team.coach?.image || placeholderImage}
                    alt={team.coach?.name ?? "Coach"}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                <div>
                  <CardTitle className="text-foreground">{team.name}</CardTitle>
                  <CardDescription>
                    {team.coach?.name ? `Coach: ${team.coach.name} • ` : ""}
                    Team votes: {poets.reduce((sum, p) => sum + (p.votes ?? 0), 0)}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <RankedList
                poets={poets}
                preset={preset}
                cutoff={advance}
                rankOf={(p) => rankMap.get(p.id) ?? 0}
                qualifiedIds={qualifiedIds}
                maxVotesOverride={overallMax}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Team stages: rank inside each team; Quarter Final highlights the top N per team.
  const perTeamCutoff = slice === "perTeam" ? advance : 0

  return (
    <div className="space-y-6">
      {perTeamCutoff > 0 && (
        <Card
          className="border-2"
          style={{ borderColor: preset.accentColor, background: `${preset.accentColor}0d` }}
        >
          <CardHeader>
            <CardTitle className="text-foreground">{preset.name}</CardTitle>
            <CardDescription>
              The top {perTeamCutoff} poets per team advance by audience vote.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      {teams.map((team) => {
        const teamParticipants: RankedPoet[] = [...(team.participants ?? [])]
          .map((p) => ({ ...p, teamName: team.name }))
          .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
        const totalVotes = teamParticipants.reduce((sum, participant) => sum + (participant.votes ?? 0), 0)

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
              {teamParticipants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No poets yet for this team.</p>
              ) : (
                <RankedList poets={teamParticipants} preset={preset} cutoff={perTeamCutoff} />
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
