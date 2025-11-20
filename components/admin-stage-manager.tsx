"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Spinner } from "@/components/ui/spinner"
import { Edit, Save } from "lucide-react"

export default function AdminStageManager() {
  const { toast } = useToast()
  const [stage, setStage] = useState("")
  const [editingValue, setEditingValue] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchStage = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("/api/settings/stage")
        if (!response.ok) throw new Error("Failed to fetch stage")
        const data = await response.json()
        setStage(data.stage)
        setEditingValue(data.stage)
      } catch (error) {
        toast({
          title: "Error",
          description: "Could not load competition stage.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    fetchStage()
  }, [toast])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const response = await fetch("/api/settings/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: editingValue }),
      })
      if (!response.ok) throw new Error("Failed to save stage")
      const data = await response.json()
      setStage(data.stage)
      setIsEditing(false)
      toast({
        title: "Success",
        description: "Competition stage updated.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not save competition stage.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="mb-6 bg-white border-border/40 backdrop-blur">
      <CardHeader>
        <CardTitle>Competition Stage</CardTitle>
        <CardDescription>Set the current stage of the poetry challenge (e.g., Quarter-Final, Semi-Final, Final).</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span>Loading stage...</span>
          </div>
        ) : isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              className="max-w-xs"
              disabled={isSaving}
            />
            <Button onClick={handleSave} size="icon" disabled={isSaving}>
              {isSaving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
            </Button>
            <Button onClick={() => setIsEditing(false)} variant="ghost" size="icon" disabled={isSaving}>
              &times;
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <p className="text-lg font-semibold text-primary">{stage}</p>
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
