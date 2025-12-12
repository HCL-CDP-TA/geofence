// NextAuth.js v5 configuration

import NextAuth, { User } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcrypt"
import { prisma } from "./prisma"
import { loginSchema } from "./validations"

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://")

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true, // Trust proxy headers
  cookies: {
    sessionToken: {
      name: `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: `${useSecureCookies ? "__Host-" : ""}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        // Validate input
        const result = loginSchema.safeParse(credentials)
        if (!result.success) {
          return null
        }

        const { username, password } = result.data

        // Find user
        const user = await prisma.user.findUnique({
          where: { username },
        })

        if (!user) {
          return null
        }

        // Verify password
        const isValid = await compare(password, user.password)
        if (!isValid) {
          return null
        }

        // Return user object
        return {
          id: user.id,
          email: user.username,
          name: user.name,
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
