"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Lock, AlertCircle, TrendingUp, Trophy, Users, BarChart3, PieChart } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/spinner"
import type { Team, Participant } from "@/lib/types"
import Image from "next/image"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from "recharts"

export default function LeaderboardPage() {
  const { status } = useSession()
  const isAdmin = status === "authenticated"
  const [teams, setTeams] = useState<Team[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchTeams = useCallback(async () => {
    try {
      setIsLoading(true)
      setLoadError(null)
      const response = await fetch("/api/teams", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to load teams")
      }
      const data = await response.json()
      const teamsData = data?.teams ?? []
      setTeams(teamsData)
      
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
      console.error("[LEADERBOARD_FETCH_ERROR]", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchTeams()
    }
  }, [isAdmin, fetchTeams])

  // Compute comprehensive statistics
  const stats = useMemo(() => {
    const allParticipants = participants
    const totalVotes = allParticipants.reduce((sum, p) => sum + (p.votes ?? 0), 0)
    const totalParticipants = allParticipants.length
    const totalTeams = teams.length
    const avgVotesPerParticipant = totalParticipants > 0 ? (totalVotes / totalParticipants).toFixed(1) : "0"
    const avgVotesPerTeam = totalTeams > 0 ? (totalVotes / totalTeams).toFixed(1) : "0"
    const topParticipant = [...allParticipants].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))[0]

    return {
      totalVotes,
      totalParticipants,
      totalTeams,
      avgVotesPerParticipant,
      avgVotesPerTeam,
      topParticipant,
    }
  }, [participants, teams])

  // Prepare team performance data for charts
  const teamPerformanceData = useMemo(() => {
    return teams
      .map((team) => {
        const teamParticipants = participants.filter((p) => p.teamId === team.id)
        const totalVotes = teamParticipants.reduce((sum, p) => sum + (p.votes ?? 0), 0)
        const participantCount = teamParticipants.length
        const avgVotes = participantCount > 0 ? (totalVotes / participantCount).toFixed(1) : "0"
        return {
          name: team.name,
          totalVotes,
          participantCount,
          avgVotes: parseFloat(avgVotes),
        }
      })
      .sort((a, b) => b.totalVotes - a.totalVotes)
  }, [teams, participants])

  // Prepare top participants data
  const topParticipantsData = useMemo(() => {
    return [...participants]
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
      .slice(0, 10)
      .map((p) => {
        const team = teams.find((t) => t.id === p.teamId)
        return {
          name: p.name,
          votes: p.votes ?? 0,
          team: team?.name || "Unknown",
        }
      })
  }, [participants, teams])

  // Prepare pie chart data for vote distribution
  const voteDistributionData = useMemo(() => {
    return teams.map((team) => {
      const teamParticipants = participants.filter((p) => p.teamId === team.id)
      const totalVotes = teamParticipants.reduce((sum, p) => sum + (p.votes ?? 0), 0)
      return {
        name: team.name,
        value: totalVotes,
      }
    })
  }, [teams, participants])

  // Overall participant rankings
  const overallRankings = useMemo(() => {
    return [...participants]
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
      .map((p, idx) => {
        const team = teams.find((t) => t.id === p.teamId)
        return {
          ...p,
          rank: idx + 1,
          teamName: team?.name || "Unknown",
        }
      })
  }, [participants, teams])

  const COLORS = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#00f2fe", "#43e97b", "#fa709a", "#fee140", "#30cfd0", "#a8edea"]

  if (!isAdmin) {
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
                Admin Access Required
              </CardTitle>
              <CardDescription>The leaderboard is only available to administrators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Live rankings are restricted. Please sign in from the admin dashboard to view results.
              </p>
              <Link href="/admin" className="block">
                <Button
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                  size="lg"
                >
                  Go to Admin Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-5 h-5" />
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MPS Poetry Challenge
            </h1>
          </Link>
          <Link href="/vote">
            <Button variant="outline" className="border-primary/20 hover:bg-primary/5 bg-transparent">
              Vote Now
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8 sm:mb-12 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <TrendingUp className="w-6 sm:w-8 h-6 sm:h-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Live Leaderboard</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">Real-time voting results across all teams</p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="xl" text="Loading leaderboard..." />
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
              <p className="text-muted-foreground">No teams available yet. Please check back later.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !loadError && teams.length > 0 && (
          <div className="space-y-8 sm:space-y-12">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="bg-white border-border/40">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Votes</p>
                      <p className="text-3xl font-bold text-foreground">{stats.totalVotes.toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-border/40">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Participants</p>
                      <p className="text-3xl font-bold text-foreground">{stats.totalParticipants}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-border/40">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Avg Votes/Participant</p>
                      <p className="text-3xl font-bold text-foreground">{stats.avgVotesPerParticipant}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-border/40">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Top Participant</p>
                      <p className="text-lg font-bold text-foreground truncate">
                        {stats.topParticipant?.name || "N/A"}
                      </p>
                      <p className="text-sm text-muted-foreground">{stats.topParticipant?.votes ?? 0} votes</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overall Rankings */}
            <Card className="bg-white border-border/40 mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Overall Rankings
                </CardTitle>
                <CardDescription>Complete participant rankings across all teams</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overallRankings.slice(0, 20).map((participant) => (
                    <Card
                      key={participant.id}
                      className={`border-border/40 ${
                        participant.rank <= 3
                          ? "bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30"
                          : "bg-white"
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                              participant.rank === 1
                                ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white"
                                : participant.rank === 2
                                ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white"
                                : participant.rank === 3
                                ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white"
                                : "bg-gradient-to-br from-primary/20 to-accent/20 text-foreground"
                            }`}
                          >
                            {participant.rank === 1 ? "🥇" : participant.rank === 2 ? "🥈" : participant.rank === 3 ? "🥉" : `#${participant.rank}`}
                          </div>
                          <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border border-primary/20">
                            <Image
                              src={participant.image || "/placeholder.svg"}
                              alt={participant.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{participant.name}</p>
                            <p className="text-sm text-muted-foreground truncate">{participant.teamName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                              {participant.votes ?? 0}
                            </p>
                            <p className="text-xs text-muted-foreground">votes</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Team Performance Bar Chart */}
              <Card className="bg-white border-border/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Team Performance
                  </CardTitle>
                  <CardDescription>Total votes per team</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={teamPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          border: "1px solid #e5e5e5",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="totalVotes" fill="#667eea" name="Total Votes" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Vote Distribution Pie Chart */}
              <Card className="bg-white border-border/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" />
                    Vote Distribution
                  </CardTitle>
                  <CardDescription>Votes across all teams</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={voteDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {voteDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          border: "1px solid #e5e5e5",
                          borderRadius: "8px",
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Top Participants Chart */}
            <Card className="bg-white border-border/40 mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Top 10 Participants
                </CardTitle>
                <CardDescription>Highest voted participants across all teams</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={topParticipantsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis type="number" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={120} fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        border: "1px solid #e5e5e5",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="votes" fill="#764ba2" name="Votes" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Team Details Section */}
            <div className="space-y-8 sm:space-y-12">
            {teams.map((team, teamIdx) => {
              const teamParticipants = participants.filter((p) => p.teamId === team.id).sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))

            const totalVotes = teamParticipants.reduce((sum, p) => sum + (p.votes ?? 0), 0)

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
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground">{team.name}</h2>
                      <p className="text-xs sm:text-sm text-muted-foreground">Coach: {team.coach.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        {totalVotes}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">Total Votes</p>
                    </div>
                  </div>
                </Card>

                <div className="space-y-2 sm:space-y-3">
                  {teamParticipants.map((participant, idx) => (
                    <Card
                      key={participant.id}
                      className="bg-card/50 border-border/40 backdrop-blur hover:border-primary/30 transition-all duration-300 overflow-hidden"
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                          {/* Rank */}
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs sm:text-base font-bold text-foreground">#{idx + 1}</span>
                          </div>

                          {/* Participant Info */}
                          <div className="flex items-center gap-2 sm:gap-3 flex-1">
                            <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden flex-shrink-0 border border-primary/20">
                              <Image
                                src={participant.image || "/placeholder.svg"}
                                alt={participant.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                                {participant.name}
                              </p>
                            </div>
                          </div>

                          {/* Vote Count */}
                          <div className="text-right ml-auto sm:ml-0">
                            <p className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                              {participant.votes ?? 0}
                            </p>
                            <p className="text-xs text-muted-foreground">votes</p>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-16 sm:w-24 h-2 bg-secondary rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                              style={{
                                width: `${((participant.votes ?? 0) / Math.max(...teamParticipants.map((p) => p.votes ?? 0), 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
            </div>
          </div>
        )}

        {!isLoading && !loadError && teams.length > 0 && (
          <div className="mt-12 sm:mt-16 text-center">
          <Link href="/vote">
            <Button
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 text-sm sm:text-base"
            >
              Cast Your Vote Now
            </Button>
          </Link>
          </div>
        )}
      </div>
    </div>
  )
}
