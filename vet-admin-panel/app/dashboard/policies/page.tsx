"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { database } from "@/lib/firebase"
import { ref, push, set, onValue, remove } from "firebase/database"
import { Loader2, Plus, Trash2, Edit } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Policy {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  createdBy: string
  createdByEmail: string
}

export default function PoliciesPage() {
  const { user, userRole } = useAuth()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
  const [policyTitle, setPolicyTitle] = useState("")
  const [policyContent, setPolicyContent] = useState("")
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  // Redirect if not admin
  useEffect(() => {
    if (!loading && userRole !== "admin") {
      router.push("/dashboard")
    }
  }, [loading, userRole, router])

  useEffect(() => {
    const fetchPolicies = async () => {
      if (!user) return

      try {
        const policiesRef = ref(database, "policies")

        onValue(policiesRef, (snapshot) => {
          const policyList: Policy[] = []

          snapshot.forEach((childSnapshot) => {
            const policy = childSnapshot.val() as Omit<Policy, "id">
            policyList.push({
              id: childSnapshot.key as string,
              ...policy,
            })
          })

          // Sort by date (newest first)
          policyList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

          setPolicies(policyList)
          setLoading(false)
        })
      } catch (error) {
        console.error("Error fetching policies:", error)
        setLoading(false)
      }
    }

    fetchPolicies()
  }, [user])

  const handleOpenDialog = (policy: Policy | null = null) => {
    if (policy) {
      setEditingPolicy(policy)
      setPolicyTitle(policy.title)
      setPolicyContent(policy.content)
    } else {
      setEditingPolicy(null)
      setPolicyTitle("")
      setPolicyContent("")
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingPolicy(null)
    setPolicyTitle("")
    setPolicyContent("")
  }

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setSaving(true)
      const now = new Date().toISOString()

      if (editingPolicy) {
        // Update existing policy
        const policyRef = ref(database, `policies/${editingPolicy.id}`)
        await set(policyRef, {
          ...editingPolicy,
          title: policyTitle,
          content: policyContent,
          updatedAt: now,
        })
      } else {
        // Create new policy
        const newPolicyRef = push(ref(database, "policies"))
        const newPolicy = {
          title: policyTitle,
          content: policyContent,
          createdAt: now,
          updatedAt: now,
          createdBy: user.uid,
          createdByEmail: user.email || "unknown",
        }

        await set(newPolicyRef, newPolicy)
      }

      handleCloseDialog()
    } catch (error) {
      console.error("Error saving policy:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePolicy = async (policy: Policy) => {
    if (!user) return

    try {
      const policyRef = ref(database, `policies/${policy.id}`)
      await remove(policyRef)
    } catch (error) {
      console.error("Error deleting policy:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (userRole !== "admin") {
    return null // Will redirect in useEffect
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
          <p className="text-muted-foreground">Manage system policies and guidelines for veterinarians</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Policy
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {policies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No policies found. Create your first policy using the "Add Policy" button.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.title}</TableCell>
                    <TableCell>{policy.createdByEmail}</TableCell>
                    <TableCell>{format(new Date(policy.updatedAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(policy)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500"
                          onClick={() => handleDeletePolicy(policy)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Policy Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit Policy" : "Add New Policy"}</DialogTitle>
            <DialogDescription>
              {editingPolicy ? "Update the policy details below" : "Create a new policy for veterinarians"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePolicy}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="policyTitle">Policy Title</Label>
                <Input
                  id="policyTitle"
                  value={policyTitle}
                  onChange={(e) => setPolicyTitle(e.target.value)}
                  placeholder="Document Submission Guidelines"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="policyContent">Policy Content</Label>
                <Textarea
                  id="policyContent"
                  value={policyContent}
                  onChange={(e) => setPolicyContent(e.target.value)}
                  placeholder="Enter the policy details here..."
                  className="min-h-[200px]"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingPolicy ? "Update Policy" : "Create Policy"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
