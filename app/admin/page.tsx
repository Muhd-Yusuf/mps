"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LogOut, Lock, BarChart3, RefreshCw } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { useSession, signIn, signOut } from "next-auth/react"

import type { Participant, Team, Ticket } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import AdminTeamManager from "@/components/admin-team-manager"
import AdminVotingResults from "@/components/admin-voting-results"
import AdminCharts from "@/components/admin-charts"
import AdminStageManager from "@/components/admin-stage-manager"
import AdminRevenue from "@/components/admin-revenue"
import AdminSettings from "@/components/admin-settings"
import AdminReport from "@/components/admin-report"

const statsIcons = ["📊", "👥", "🎤", "📈"] as const

type TeamWithParticipants = Team & { participants: Participant[] }

export default function AdminPage() {
  const { data: session, status } = useSession()
  const [password, setPassword] = useState("")
  const [isLoginLoading, setIsLoginLoading] = useState(false)

  const [teams, setTeams] = useState<TeamWithParticipants[]>([])
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [teamsError, setTeamsError] = useState<string | null>(null)
  const [totalRevenue, setTotalRevenue] = useState(0)

  const isAuthenticated = status === "authenticated"
  const isLoadingAuth = status === "loading"

  const handleLogin = async () => {
    if (!password) return

    setIsLoginLoading(true)
    try {
      const result = await signIn("credentials", {
        password,
        redirect: false,
      })

      if (result?.error) {
        toast.error("Access Denied", {
          description: "Incorrect password",
        })
      } else {
        toast.success("Success", {
          description: "Logged in successfully",
        })
      }
    } catch (error) {
      toast.error("Error", {
        description: "Something went wrong during login",
      })
    } finally {
      setIsLoginLoading(false)
    }
  }

  const fetchTeams = useCallback(async () => {
    try {
      setIsLoadingTeams(true)
      setTeamsError(null)
      const response = await fetch("/api/teams", { cache: "no-store" })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to fetch teams")
      }
      const data = await response.json()
      const normalized = (data?.teams ?? []).map((team: TeamWithParticipants) => ({
        ...team,
        participants: team.participants ?? [],
      }))
      setTeams(normalized)
    } catch (error: any) {
      setTeamsError(error?.message ?? "Unable to fetch teams")
      toast.error("Failed to load teams", {
        description: error?.message ?? "Please check your database connection.",
      })
    } finally {
      setIsLoadingTeams(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchTeams()
    } else {
      setTeams([])
      setTeamsError(null)
    }
  }, [isAuthenticated, fetchTeams])

  useEffect(() => {
    if (!isAuthenticated) {
      setTotalRevenue(0)
      return
    }
    const fetchRevenue = async () => {
      try {
        const response = await fetch("/api/payments", { cache: "no-store" })
        if (!response.ok) {
          console.error("Failed to fetch revenue data")
          return
        }
        const data = await response.json()
        const tickets: Ticket[] = data?.tickets ?? []
        const revenue = tickets.reduce((sum, ticket) => sum + ticket.amount, 0)
        setTotalRevenue(revenue)
      } catch (error) {
        console.error("Error fetching revenue:", error)
      }
    }
    fetchRevenue()
  }, [isAuthenticated])

  const totalParticipants = useMemo(
    () => teams.reduce((sum, team) => sum + (team.participants?.length ?? 0), 0),
    [teams]
  )
  const totalVotes = useMemo(
    () =>
      teams.reduce(
        (sum, team) => sum + (team.participants ?? []).reduce((inner, participant) => inner + (participant.votes ?? 0), 0),
        0
      ),
    [teams]
  )

  const formattedTotalRevenue = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalRevenue)

  const stats = [
    { label: "Total Votes", value: totalVotes },
    { label: "Teams", value: teams.length },
    { label: "Poets", value: totalParticipants },
    { label: "Total Revenue", value: formattedTotalRevenue },
  ]

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background flex items-center justify-center p-4">
        <Card className="bg-white border-border/40 backdrop-blur w-full max-w-md shadow-2xl animate-fade-in-up">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-foreground">Admin Login</CardTitle>
            <CardDescription>Enter admin password to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="bg-input border-border/40 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
            />
            <Button
              onClick={handleLogin}
              disabled={isLoginLoading}
              className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
            >
              {isLoginLoading ? <Spinner size="sm" className="mr-2" /> : null}
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchTeams}
              className="border-border/40 hover:bg-primary/10"
              disabled={isLoadingTeams}
            >
              {isLoadingTeams ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  <span className="hidden sm:inline">Refreshing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="border-border/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card
              key={stat.label}
              className="bg-white border-border/40 backdrop-blur hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 group animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3">
                  <div className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {stat.value ?? 0}
                  </div>
                  <div className="text-3xl mb-1">{statsIcons[index]}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {teamsError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {teamsError}. You can retry with the refresh button above.
          </div>
        )}

        <AdminReport />

        <Tabs defaultValue="results" className="space-y-6 w-full">
          <div className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
              <TabsTrigger value="results" className="data-[state=active]:bg-primary/20">
                Voting Results
              </TabsTrigger>
              <TabsTrigger value="charts" className="data-[state=active]:bg-primary/20">
                Charts & Analytics
              </TabsTrigger>
              <TabsTrigger value="teams" className="data-[state=active]:bg-primary/20">
                Teams & Poets
              </TabsTrigger>
              <TabsTrigger value="revenue" className="data-[state=active]:bg-primary/20">
                Revenue
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-primary/20">
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="results" className="animate-fade-in-up">
            <AdminStageManager />
            <AdminVotingResults teams={teams} isLoading={isLoadingTeams} />
          </TabsContent>

          <TabsContent value="charts" className="animate-fade-in-up">
            <AdminCharts teams={teams} isLoading={isLoadingTeams} />
          </TabsContent>

          <TabsContent value="teams" className="animate-fade-in-up">
            <AdminTeamManager teams={teams} isLoading={isLoadingTeams} onRefresh={fetchTeams} />
          </TabsContent>
          <TabsContent value="revenue" className="animate-fade-in-up">
            <AdminRevenue />
          </TabsContent>
          <TabsContent value="settings" className="animate-fade-in-up">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
