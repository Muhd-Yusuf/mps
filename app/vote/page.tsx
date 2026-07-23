"use client"

import { useState, useEffect, useCallback } from "react"
import type { VoteSelection, Team, Participant } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import VotingCard from "@/components/voting-card"
import { ArrowLeft, Lock, AlertCircle, Flame } from "lucide-react"
import { Spinner, LoadingSpinner } from "@/components/ui/spinner"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"

type VotingMode = "teams" | "danger"

const DANGER_COLOR = "#DC2626"

// Danger Zone poets are shown in a random order with no team grouping.
function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export default function VotePage() {
  const [selections, setSelections] = useState<VoteSelection>([])
  const [votingCode, setVotingCode] = useState("")
  const [codeVerified, setCodeVerified] = useState(false)
  const [codeInput, setCodeInput] = useState("")
  const [error, setError] = useState("")
  const [hasVoted, setHasVoted] = useState(false)
  const [codeHasVoted, setCodeHasVoted] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSubmittingVotes, setIsSubmittingVotes] = useState(false)
  const [teamLabel, setTeamLabel] = useState("Team")
  const [mode, setMode] = useState<VotingMode>("teams")

  const fetchTeams = useCallback(async () => {
    try {
      setIsLoading(true)
      setLoadError(null)
      const [teamsResponse, labelResponse, modeResponse] = await Promise.all([
        fetch("/api/teams", { cache: "no-store" }),
        fetch("/api/settings/label", { cache: "no-store" }),
        fetch("/api/settings/mode", { cache: "no-store" }),
      ])

      if (!teamsResponse.ok) {
        throw new Error("Failed to load teams")
      }

      if (labelResponse.ok) {
        const labelData = await labelResponse.json()
        setTeamLabel(labelData.label || "Team")
      }

      let currentMode: VotingMode = "teams"
      if (modeResponse.ok) {
        const modeData = await modeResponse.json()
        currentMode = modeData.mode === "danger" ? "danger" : "teams"
      }
      setMode(currentMode)

      const data = await teamsResponse.json()
      const allTeams: Team[] = data?.teams ?? []

      if (currentMode === "danger") {
        // Blind audition: poets not chosen by any coach, no team grouping, random order.
        setTeams([])
        const dangerPoets: Participant[] = []
        allTeams.forEach((team) => {
          team.participants?.forEach((participant) => {
            if (participant.inDanger) {
              dangerPoets.push({ ...participant, teamId: team.id })
            }
          })
        })
        setParticipants(shuffle(dangerPoets))
      } else {
        // Regular stage: only teams the admin has opened are votable.
        const openTeams = allTeams.filter((team) => team.votingOpen)
        setTeams(openTeams)

        const allParticipants: Participant[] = []
        openTeams.forEach((team) => {
          team.participants?.forEach((participant) => {
            allParticipants.push({ ...participant, teamId: team.id })
          })
        })
        setParticipants(allParticipants)
      }
    } catch (error: any) {
      setLoadError(error?.message ?? "Failed to load teams")
      console.error("[VOTE_PAGE_FETCH_ERROR]", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem("votingCode")
    const votedCodes = JSON.parse(localStorage.getItem("votedCodes") || "[]")
    if (stored) {
      setVotingCode(stored)
      // Verify code with API
      fetch("/api/tickets/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: stored }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.valid) {
            setCodeVerified(true)
            if (data.ticket?.hasVoted || votedCodes.includes(stored)) {
              setCodeHasVoted(true)
            }
          }
        })
        .catch(() => {
          // If verification fails, still allow them to try
          setCodeVerified(true)
        })
    }
  }, [])

  useEffect(() => {
    if (codeVerified) {
      fetchTeams()
    }
  }, [codeVerified, fetchTeams])

  // One ticket = one vote: picking a poet replaces any previous pick,
  // tapping the selected poet again deselects them.
  const handleVoteSelect = (teamId: string, participantId: string) => {
    setSelections((prev) => {
      if (prev.some((s) => s.participantId === participantId)) {
        return []
      }
      return [{ teamId, participantId }]
    })
  }

  const handleVerifyCode = async () => {
    if (!codeInput.trim()) {
      setError("Please enter your voting code")
      return
    }

    try {
      setError("")
      const response = await fetch("/api/tickets/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData?.error ?? "Invalid voting code")
      }

      const data = await response.json()

      if (data.ticket?.hasVoted) {
        setError("This code has already been used to vote. Purchase a new ticket to vote again.")
        setCodeHasVoted(true)
        return
      }

      setVotingCode(codeInput.trim().toUpperCase())
      setCodeVerified(true)
      localStorage.setItem("votingCode", codeInput.trim().toUpperCase())
      setError("")
    } catch (error: any) {
      setError(error?.message ?? "Failed to verify code. Please try again.")
    }
  }

  const handleSubmitVotes = async () => {
    if (selections.length !== 1) {
      toast.error("Please select the one poet you want to vote for")
      return
    }

    try {
      setIsSubmittingVotes(true)
      const response = await fetch("/api/votes/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          votingCode: votingCode,
          selections: selections,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData?.error ?? "Failed to submit vote")
      }

      // Mark as voted in localStorage
      const votedCodes = JSON.parse(localStorage.getItem("votedCodes") || "[]")
      if (!votedCodes.includes(votingCode)) {
        votedCodes.push(votingCode)
        localStorage.setItem("votedCodes", JSON.stringify(votedCodes))
      }

      setCodeHasVoted(true)
      setHasVoted(true)
      toast.success("Vote cast successfully!")
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to submit vote. Please try again.")
    } finally {
      setIsSubmittingVotes(false)
    }
  }

  const selectedParticipant = participants.find((p) => p.id === selections[0]?.participantId)
  const hasVotableContent = mode === "danger" ? participants.length > 0 : teams.length > 0

  if (!codeVerified) {
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

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="bg-card/50 border-border/40 backdrop-blur shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                Code Required to Vote
              </CardTitle>
              <CardDescription>Enter your voting code to proceed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">Voting Code</label>
                <Input
                  placeholder="MPS-2025-ABC123"
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value.toUpperCase())
                    setError("")
                  }}
                  className="bg-input border-border/40 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors text-lg tracking-widest text-center font-mono"
                />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
              <Button
                onClick={handleVerifyCode}
                className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                size="lg"
              >
                Enter Code & Vote
              </Button>
              <Link href="/purchase" className="block">
                <Button variant="outline" className="w-full bg-transparent">
                  Don't have a code? Get one now
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }



  if (hasVoted || codeHasVoted) {
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

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <Card className="bg-card/50 border-border/40 backdrop-blur shadow-2xl">
            <CardContent className="pt-12 text-center pb-12">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                  <span className="text-3xl">✓</span>
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Your Vote is Recorded!</h3>
              <p className="text-muted-foreground mb-2">Thank you for voting in the MPS Media Poetry Challenge</p>
              <p className="text-sm text-muted-foreground mb-8">
                This code has completed its voting. To vote again, purchase another voting code.
              </p>
              <div className="space-y-4">
                <Link href="/">
                  <Button
                    className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                    size="lg"
                  >
                    Purchase Another Ticket
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="xl" text="Loading poets..." />
          </div>
        )}

        {loadError && (
          <Card className="bg-destructive/10 border-destructive/30 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <p className="text-destructive">{loadError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !loadError && !hasVotableContent && (
          <Card className="bg-card/50 border-border/40 backdrop-blur">
            <CardContent className="pt-6 text-center py-12">
              <p className="text-muted-foreground">Voting is not open right now. Please check back later.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !loadError && hasVotableContent && (
          <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2">
              {mode === "danger" ? (
                <>
                  {/* Danger Zone: blind-audition save vote — no team grouping, random order */}
                  <div className="mb-6 sm:mb-8 animate-fade-in-up">
                    <Card
                      className="relative overflow-hidden border-2 mb-6 p-4 sm:p-6 shadow-lg rounded-2xl"
                      style={{
                        borderColor: DANGER_COLOR,
                        background: `linear-gradient(135deg, ${DANGER_COLOR}26, ${DANGER_COLOR}0a)`,
                      }}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: DANGER_COLOR }} />
                      <div className="flex items-center gap-3 pl-2">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-md"
                          style={{ backgroundColor: `${DANGER_COLOR}1a` }}
                        >
                          <Flame className="w-6 h-6" style={{ color: DANGER_COLOR }} />
                        </div>
                        <div>
                          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                            Danger Zone
                          </h2>
                          <p className="text-sm sm:text-base text-muted-foreground mt-1">
                            Choose who you want to keep in the competition. These poets were not picked by any
                            coach — your vote decides who stays.
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {participants.map((participant) => (
                      <VotingCard
                        key={participant.id}
                        participant={participant}
                        isSelected={selections.some((s) => s.participantId === participant.id)}
                        onSelect={() => handleVoteSelect(participant.teamId ?? "", participant.id)}
                        teamColor={DANGER_COLOR}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-6 sm:mb-8 animate-fade-in-up">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 sm:mb-3">
                      Cast Your Vote
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      Choose the one poet you want to support. Each voting code gives you a single vote.
                    </p>
                  </div>

                  <div className="space-y-8 sm:space-y-10">
                    {teams.map((team, teamIdx) => {
                      const teamParticipants = participants.filter((p) => p.teamId === team.id)
                      const teamHasSelection = selections.some((s) => s.teamId === team.id)

                      return (
                        <div key={team.id} className="animate-fade-in-up" style={{ animationDelay: `${teamIdx * 100}ms` }}>
                          <Card
                            className="relative overflow-hidden border-2 mb-6 p-4 sm:p-6 shadow-lg rounded-2xl"
                            style={{
                              borderColor: team.color,
                              background: `linear-gradient(135deg, ${team.color}26, ${team.color}0a)`,
                            }}
                          >
                            {/* Bold left accent bar in the team's own color */}
                            <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: team.color }} />
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 pl-2">
                              <div
                                className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-[3px] shadow-md"
                                style={{ borderColor: team.color }}
                              >
                                <Image
                                  src={team.coach.image || "/placeholder.svg"}
                                  alt={team.coach.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block w-3 h-3 rounded-full shadow"
                                    style={{ backgroundColor: team.color }}
                                  />
                                  <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                                    {team.name}
                                  </h3>
                                </div>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Coach: {team.coach.name}</p>
                              </div>
                              <div className="flex items-center gap-3 ml-auto">
                                {teamHasSelection && (
                                  <span
                                    className="text-xs sm:text-sm font-semibold px-3 py-1 rounded-full text-white shadow whitespace-nowrap"
                                    style={{ backgroundColor: team.color }}
                                  >
                                    ✓ Selected
                                  </span>
                                )}
                              </div>
                            </div>
                          </Card>

                          <div className="grid grid-cols-1 gap-3 sm:gap-4">
                            {teamParticipants.map((participant) => (
                              <VotingCard
                                key={participant.id}
                                participant={participant}
                                isSelected={selections.some(s => s.participantId === participant.id)}
                                onSelect={() => handleVoteSelect(team.id, participant.id)}
                                teamColor={team.color}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="lg:col-span-1">
              <Card className="bg-card/50 border-border/40 backdrop-blur sticky top-24 animate-slide-in-right">
                <CardHeader>
                  <CardTitle className="text-foreground">Your Vote</CardTitle>
                  <CardDescription>One vote per voting code</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Voting Code</p>
                    <p className="text-lg font-mono font-bold text-foreground">{votingCode}</p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground text-sm">Selected Poet:</h4>
                    {selectedParticipant ? (
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor:
                              mode === "danger"
                                ? DANGER_COLOR
                                : teams.find((t) => t.id === selections[0]?.teamId)?.color ?? DANGER_COLOR,
                          }}
                        />
                        <span className="font-medium text-foreground">{selectedParticipant.name}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No poet selected yet</p>
                    )}
                  </div>

                  <div className="border-t border-border/40 pt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Each voting code can only be used once. To vote again, purchase another ticket.
                    </p>
                    <Button
                      onClick={handleSubmitVotes}
                      disabled={selections.length !== 1 || isSubmittingVotes}
                      className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 transition-all duration-300 group"
                      size="lg"
                    >
                      {isSubmittingVotes ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Submitting Vote...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                          Submit Vote
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
