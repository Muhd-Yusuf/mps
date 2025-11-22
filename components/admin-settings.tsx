"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { Save, Settings } from "lucide-react"

export default function AdminSettings() {
    const [maxVotes, setMaxVotes] = useState<number>(3)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            setIsLoading(true)
            const response = await fetch("/api/settings")
            if (!response.ok) throw new Error("Failed to fetch settings")
            const data = await response.json()
            setMaxVotes(data.maxVotes)
        } catch (error) {
            toast.error("Error loading settings")
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        try {
            setIsSaving(true)
            const response = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maxVotes }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to save settings")
            }

            toast.success("Settings saved successfully")
        } catch (error: any) {
            toast.error(error.message || "Error saving settings")
        } finally {
            setIsSaving(false)
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
        <Card className="bg-white border-border/40 backdrop-blur shadow-sm">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    <CardTitle>Voting Configuration</CardTitle>
                </div>
                <CardDescription>Manage global voting settings and restrictions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="maxVotes">Max Votes Per Ticket</Label>
                    <div className="flex gap-4 items-center">
                        <Input
                            id="maxVotes"
                            type="number"
                            min="1"
                            value={maxVotes}
                            onChange={(e) => setMaxVotes(parseInt(e.target.value) || 0)}
                            className="max-w-[200px]"
                        />
                        <p className="text-sm text-muted-foreground">
                            Voters can select up to this many contestants across all teams.
                        </p>
                    </div>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={isSaving || maxVotes < 1}
                    className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                >
                    {isSaving ? (
                        <>
                            <Spinner size="sm" className="mr-2" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    )
}
