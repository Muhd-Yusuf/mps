"use client"

import { useState, useEffect, useCallback } from "react"
import type { VoteSelection, Team, Participant } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import VotingCard from "@/components/voting-card"
import { ArrowLeft, Lock, AlertCircle } from "lucide-react"
import { Spinner, LoadingSpinner } from "@/components/ui/spinner"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"

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
  const [maxVotes, setMaxVotes] = useState(3)
  const [teamLabel, setTeamLabel] = useState("Team")

  const fetchTeams = useCallback(async () => {
    try {
      setIsLoading(true)
      setLoadError(null)
      const [teamsResponse, settingsResponse, labelResponse] = await Promise.all([
        fetch("/api/teams", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/settings/label", { cache: "no-store" })
      ])

      if (!teamsResponse.ok) {
        throw new Error("Failed to load teams")
      }

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json()
        setMaxVotes(settingsData.maxVotes)
      }

      if (labelResponse.ok) {
        const labelData = await labelResponse.json()
        setTeamLabel(labelData.label || "Team")
      }

      const data = await teamsResponse.json()
      // Sequential "objective" voting: only teams the admin has opened are votable.
      const teamsData = (data?.teams ?? []).filter((team: Team) => team.votingOpen)
      setTeams(teamsData)

      // Voter picks exactly one contestant per open team.
      setMaxVotes(teamsData.length)

      // Flatten all participants from all teams
      const allParticipants: Participant[] = []
      teamsData.forEach((team: Team) => {
        if (team.participants) {
          team.participants.forEach((participant) => {
            allParticipants.push({
              ...participant,
              teamId: team.id,
            })
          })
        }
      })
      setParticipants(allParticipants)
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

  const handleVoteSelect = (teamId: string, participantId: string) => {
    setSelections((prev) => {
      const isSelected = prev.some((s) => s.participantId === participantId)

      if (isSelected) {
        // Toggle off if the same contestant is tapped again.
        return prev.filter((s) => s.participantId !== participantId)
      }

      // One contestant per team: drop any existing pick for this team, then add.
      return [...prev.filter((s) => s.teamId !== teamId), { teamId, participantId }]
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
    if (selections.length !== maxVotes) {
      toast.error(`Please select exactly ${maxVotes} contestants`)
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
        throw new Error(errorData?.error ?? "Failed to submit votes")
      }

      // Mark as voted in localStorage
      const votedCodes = JSON.parse(localStorage.getItem("votedCodes") || "[]")
      if (!votedCodes.includes(votingCode)) {
        votedCodes.push(votingCode)
        localStorage.setItem("votedCodes", JSON.stringify(votedCodes))
      }

      setCodeHasVoted(true)
      setHasVoted(true)
      toast.success("Votes cast successfully!")
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to submit votes. Please try again.")
    } finally {
      setIsSubmittingVotes(false)
    }
  }

  if (!codeVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
        <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              <ArrowLeft className="w-5 h-5" />
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                MPS Poetry Challenge
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
                MPS Poetry Challenge
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
              <p className="text-muted-foreground mb-2">Thank you for voting in the MPS Poetry Challenge</p>
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
              MPS Poetry Challenge
            </h1>
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="xl" text="Loading teams..." />
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

        {!isLoading && !loadError && teams.length === 0 && (
          <Card className="bg-card/50 border-border/40 backdrop-blur">
            <CardContent className="pt-6 text-center py-12">
              <p className="text-muted-foreground">Voting is not open right now. Please check back later.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !loadError && teams.length > 0 && (
          <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2">
              <div className="mb-6 sm:mb-8 animate-fade-in-up">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 sm:mb-3">
                  Select Your Votes
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Choose one participant from each {teamLabel.toLowerCase()} to advance to the next stage.
                </p>
              </div>

              <div className="space-y-8 sm:space-y-10">
                {teams.map((team, teamIdx) => {
                  const teamParticipants = participants.filter((p) => p.teamId === team.id)
                  const selectedCount = selections.filter((s) => s.teamId === team.id).length

                  return (
                    <div key={team.id} className="animate-fade-in-up" style={{ animationDelay: `${teamIdx * 100}ms` }}>
                      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 backdrop-blur mb-6 p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                          <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-primary/40 shadow-md">
                            <Image
                              src={team.coach.image || "/placeholder.svg"}
                              alt={team.coach.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl sm:text-2xl font-bold text-foreground">{team.name}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">Coach: {team.coach.name}</p>
                          </div>
                          <div className="flex items-center gap-3 ml-auto">
                            <div className="w-5 h-5 rounded-full shadow-lg" style={{ backgroundColor: team.color }} />
                            {selectedCount > 0 && (
                              <span className="text-xs sm:text-sm font-medium px-3 py-1 rounded-full bg-accent/20 text-accent whitespace-nowrap">
                                ✓ {selectedCount} Selected
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>

                      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
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
            </div>

            <div className="lg:col-span-1">
              <Card className="bg-card/50 border-border/40 backdrop-blur sticky top-24 animate-slide-in-right">
                <CardHeader>
                  <CardTitle className="text-foreground">Your Votes</CardTitle>
                  <CardDescription>
                    {selections.length} of {maxVotes} votes used
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Voting Code</p>
                    <p className="text-lg font-mono font-bold text-foreground">{votingCode}</p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground text-sm">Selected Votes:</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selections.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No votes selected yet</p>
                      ) : (
                        selections.map((selection) => {
                          const participant = participants.find((p) => p.id === selection.participantId)
                          const team = teams.find((t) => t.id === selection.teamId)

                          if (!participant || !team) return null

                          return (
                            <div key={selection.participantId} className="text-sm text-muted-foreground flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                              <span className="font-medium text-foreground">{team.name}:</span>{" "}
                              {participant.name}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Each voting code can only be used once. To vote again, purchase another ticket.
                    </p>
                    <Button
                      onClick={handleSubmitVotes}
                      disabled={selections.length !== maxVotes || isSubmittingVotes}
                      className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 transition-all duration-300 group"
                      size="lg"
                    >
                      {isSubmittingVotes ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Submitting Votes...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                          Submit Votes
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
