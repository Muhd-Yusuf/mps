"use client"

import { useMemo } from "react"
import type { Team, Participant } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/spinner"
import { BarChart3, PieChart, Trophy } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts"

type AdminChartsProps = {
  teams: Team[]
  isLoading: boolean
}

const COLORS = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#00f2fe", "#43e97b", "#fa709a", "#fee140", "#30cfd0", "#a8edea"]

export default function AdminCharts({ teams, isLoading }: AdminChartsProps) {
  // Flatten all participants from all teams
  const allParticipants = useMemo(() => {
    const participants: (Participant & { teamId?: string })[] = []
    teams.forEach((team) => {
      if (team.participants) {
        team.participants.forEach((participant) => {
          participants.push({
            ...participant,
            teamId: team.id,
          })
        })
      }
    })
    return participants
  }, [teams])

  // Prepare team performance data for charts
  const teamPerformanceData = useMemo(() => {
    return teams
      .map((team) => {
        const teamParticipants = allParticipants.filter((p) => p.teamId === team.id)
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
  }, [teams, allParticipants])

  // Prepare top participants data
  const topParticipantsData = useMemo(() => {
    return [...allParticipants]
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
  }, [allParticipants, teams])

  // Prepare pie chart data for vote distribution
  const voteDistributionData = useMemo(() => {
    return teams.map((team) => {
      const teamParticipants = allParticipants.filter((p) => p.teamId === team.id)
      const totalVotes = teamParticipants.reduce((sum, p) => sum + (p.votes ?? 0), 0)
      return {
        name: team.name,
        value: totalVotes,
      }
    })
  }, [teams, allParticipants])

  if (isLoading) {
    return (
      <Card className="border-border/40 bg-white backdrop-blur">
        <CardContent className="py-10">
          <LoadingSpinner size="lg" text="Loading charts..." />
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
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      <Card className="bg-white border-border/40">
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
    </div>
  )
}

