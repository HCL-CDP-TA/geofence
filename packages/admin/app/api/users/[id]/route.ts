// User Management API - Update and delete user operations

import { isAuthenticated } from "@/src/lib/api-auth"
import { prisma } from "@/src/lib/prisma"
import { corsJsonResponse, handleOptions } from "@/src/lib/cors"
import { updateUserSchema } from "@/src/lib/validations"
import bcrypt from "bcryptjs"

// OPTIONS /api/users/[id] - Handle CORS preflight
export async function OPTIONS() {
  return handleOptions()
}

// PATCH /api/users/[id] - Update user (requires API key or session)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication (session or API key)
    const authenticated = await isAuthenticated(request)
    if (!authenticated) {
      return corsJsonResponse({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Validate request body
    const validation = updateUserSchema.safeParse(body)
    if (!validation.success) {
      return corsJsonResponse(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return corsJsonResponse({ error: "User not found" }, { status: 404 })
    }

    // Check if username is being changed and already exists
    if (data.username && data.username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username: data.username },
      })

      if (usernameExists) {
        return corsJsonResponse({ error: "Username already exists" }, { status: 409 })
      }
    }

    // Prepare update data
    const updateData: any = {}
    if (data.username !== undefined) updateData.username = data.username
    if (data.name !== undefined) updateData.name = data.name

    // Hash password if provided
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10)
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return corsJsonResponse({ error: "No fields to update" }, { status: 400 })
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        // Exclude password
      },
    })

    return corsJsonResponse({ user: updatedUser })
  } catch (error) {
    console.error("Error updating user:", error)
    return corsJsonResponse({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/users/[id] - Alias for PATCH
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return PATCH(request, { params })
}

// DELETE /api/users/[id] - Delete user (requires API key or session)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication (session or API key)
    const authenticated = await isAuthenticated(request)
    if (!authenticated) {
      return corsJsonResponse({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return corsJsonResponse({ error: "User not found" }, { status: 404 })
    }

    // Delete the user
    await prisma.user.delete({
      where: { id },
    })

    return corsJsonResponse({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    return corsJsonResponse({ error: "Internal server error" }, { status: 500 })
  }
}
