"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { Save, RotateCw, Tag } from "lucide-react"

export default function AdminSettings() {
    const [teamLabel, setTeamLabel] = useState<string>("Team")
    const [round, setRound] = useState<number>(1)
    const [isLoading, setIsLoading] = useState(true)
    const [isSavingLabel, setIsSavingLabel] = useState(false)
    const [isAdvancing, setIsAdvancing] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            setIsLoading(true)
            const [labelRes, roundRes] = await Promise.all([
                fetch("/api/settings/label"),
                fetch("/api/settings/round"),
            ])
            if (labelRes.ok) setTeamLabel((await labelRes.json()).label)
            if (roundRes.ok) setRound((await roundRes.json()).round)
        } catch (error) {
            toast.error("Error loading settings")
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSaveLabel = async () => {
        try {
            setIsSavingLabel(true)
            const response = await fetch("/api/settings/label", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label: teamLabel.trim() || "Team" }),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to save label")
            }
            const data = await response.json()
            setTeamLabel(data.label)
            toast.success("Label saved successfully")
        } catch (error: any) {
            toast.error(error.message || "Error saving label")
        } finally {
            setIsSavingLabel(false)
        }
    }

    const handleAdvanceRound = async () => {
        if (!confirm("Start a new round? This closes voting on all teams and lets everyone buy a new ticket.")) {
            return
        }
        try {
            setIsAdvancing(true)
            const response = await fetch("/api/settings/round", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "advance" }),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to start new round")
            }
            const data = await response.json()
            setRound(data.round)
            toast.success(`Round ${data.round} started. All teams closed — open the ones for this round.`)
        } catch (error: any) {
            toast.error(error.message || "Error starting new round")
        } finally {
            setIsAdvancing(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Spinner size="lg" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="bg-white border-border/40 backdrop-blur shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Tag className="w-5 h-5 text-primary" />
                        <CardTitle>Team Label</CardTitle>
                    </div>
                    <CardDescription>
                        What each group represents across the app (e.g. Team, State, LGA, Coach).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4 items-center">
                        <Input
                            id="teamLabel"
                            value={teamLabel}
                            onChange={(e) => setTeamLabel(e.target.value)}
                            placeholder="Team"
                            maxLength={30}
                            className="max-w-[200px]"
                        />
                        <p className="text-sm text-muted-foreground">
                            Shown wherever groups are referenced (e.g. &ldquo;{teamLabel || "Team"}&rdquo;).
                        </p>
                    </div>
                    <Button
                        onClick={handleSaveLabel}
                        disabled={isSavingLabel || !teamLabel.trim()}
                        className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                    >
                        {isSavingLabel ? (
                            <>
                                <Spinner size="sm" className="mr-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Label
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            <Card className="bg-white border-border/40 backdrop-blur shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <RotateCw className="w-5 h-5 text-primary" />
                        <CardTitle>Voting Round</CardTitle>
                    </div>
                    <CardDescription>
                        Current round is <strong>{round}</strong>. Voters pick one contestant from each open team.
                        Starting a new round closes all teams and lets every voter buy a fresh ticket.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={handleAdvanceRound}
                        disabled={isAdvancing}
                        variant="outline"
                        className="border-border/40 hover:bg-muted"
                    >
                        {isAdvancing ? (
                            <>
                                <Spinner size="sm" className="mr-2" />
                                Starting...
                            </>
                        ) : (
                            <>
                                <RotateCw className="w-4 h-4 mr-2" />
                                Start New Round
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
