"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Trophy, EyeOff } from "lucide-react"

import type { Team, Participant } from "@/lib/types"
import { getPreset, type StagePreset } from "@/lib/stages"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/spinner"

const placeholderImage = "/placeholder.svg"

type RankedPoet = Participant & { teamName: string }

function RankedList({ poets, preset, cutoff }: { poets: RankedPoet[]; preset: StagePreset; cutoff: number }) {
  const maxVotes = poets.length ? Math.max(...poets.map((p) => p.votes ?? 0)) : 0

  return (
    <div className="space-y-4">
      {poets.map((poet, index) => {
        const votes = poet.votes ?? 0
        const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0
        const qualifies = cutoff > 0 && index < cutoff && votes > 0

        return (
          <div key={poet.id}>
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-bold text-muted-foreground w-5 text-right flex-shrink-0">{index + 1}</span>
                <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-border/40">
                  <Image src={poet.image || placeholderImage} alt={poet.name} fill className="object-cover" />
                </div>
                <span className="font-medium text-foreground truncate">{poet.name}</span>
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">{poet.teamName}</span>
                {qualifies && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white whitespace-nowrap"
                    style={{ backgroundColor: preset.accentColor }}
                  >
                    {preset.results.advanceLabel}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">{votes} votes</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${percentage}%`,
                  background: qualifies ? preset.accentColor : "linear-gradient(to right, #667eea, #764ba2)",
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ResultsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [preset, setPreset] = useState<StagePreset>(getPreset(null))
  const [roundLabel, setRoundLabel] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const revealRes = await fetch("/api/settings/reveal", { cache: "no-store" })
        const isRevealed = revealRes.ok ? (await revealRes.json()).revealed === true : false
        setRevealed(isRevealed)
        if (!isRevealed) return

        const [teamsRes, presetRes, roundRes] = await Promise.all([
          fetch("/api/teams", { cache: "no-store" }),
          fetch("/api/settings/preset", { cache: "no-store" }),
          fetch("/api/settings/round", { cache: "no-store" }),
        ])
        if (teamsRes.ok) setTeams((await teamsRes.json())?.teams ?? [])
        if (presetRes.ok) setPreset(getPreset((await presetRes.json())?.preset))
        if (roundRes.ok) setRoundLabel((await roundRes.json())?.label ?? "")
      } catch (error) {
        console.error("[RESULTS_PAGE_ERROR]", error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const { slice, advance } = preset.results
  const isDanger = preset.mode === "danger"

  const pool: RankedPoet[] = teams.flatMap((team) =>
    (team.participants ?? [])
      .filter((p) => (isDanger ? p.inDanger : true))
      .map((p) => ({ ...p, teamName: team.name }))
  )

  const perTeamGroups = teams
    .map((team) => ({
      team,
      poets: pool
        .filter((p) => (team.participants ?? []).some((tp) => tp.id === p.id))
        .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)),
    }))
    .filter((g) => g.poets.length > 0)

  const overallRanked = [...pool].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-5 h-5" />
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MPS Media Poetry Challenge
            </h1>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="xl" text="Loading results..." />
          </div>
        )}

        {!isLoading && !revealed && (
          <Card className="bg-card/50 border-border/40 backdrop-blur">
            <CardContent className="pt-6 text-center py-14">
              <EyeOff className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold text-foreground mb-1">Results Not Announced Yet</p>
              <p className="text-muted-foreground max-w-md mx-auto">
                Official results are announced live by MPS Media first. Check back here right after the
                announcement.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && revealed && (
          <div className="space-y-6">
            <Card
              className="border-2"
              style={{ borderColor: preset.accentColor, background: `${preset.accentColor}0d` }}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6" style={{ color: preset.accentColor }} />
                  <div>
                    <CardTitle className="text-foreground">Official Results — {preset.name}</CardTitle>
                    <CardDescription>{roundLabel || "As announced by MPS Media"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {pool.length === 0 && (
              <Card className="bg-card/50 border-border/40 backdrop-blur">
                <CardContent className="pt-6 text-center py-12">
                  <p className="text-muted-foreground">No results to show for this stage yet.</p>
                </CardContent>
              </Card>
            )}

            {pool.length > 0 && slice === "perTeam" ? (
              perTeamGroups.map(({ team, poets }) => (
                <Card key={team.id} className="bg-white border-border/40">
                  <CardHeader>
                    <CardTitle className="text-foreground">{team.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RankedList poets={poets} preset={preset} cutoff={advance} />
                  </CardContent>
                </Card>
              ))
            ) : pool.length > 0 ? (
              <Card className="bg-white border-border/40">
                <CardContent className="pt-6">
                  <RankedList poets={overallRanked} preset={preset} cutoff={advance} />
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
