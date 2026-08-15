import type { AuthOptions } from "next-auth"
import { getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                const adminPassword = process.env.ADMIN_PASSWORD

                // If no password set in env, fail safe
                if (!adminPassword) {
                    console.error("ADMIN_PASSWORD not set in environment variables")
                    return null
                }

                if (credentials?.password === adminPassword) {
                    return { id: "1", name: "Admin", email: "admin@example.com" }
                }
                return null
            }
        })
    ],
    pages: {
        signIn: '/admin',
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
}

// Server-side admin gate for mutation/sensitive endpoints. Returns the session
// or null; callers reject with 401 when null.
export async function requireAdmin() {
    return getServerSession(authOptions)
}
