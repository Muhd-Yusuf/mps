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
                // Password is verified against the DB hash (source of truth once
                // an admin has set it), falling back to ADMIN_PASSWORD for the
                // very first login. See lib/admin-password.ts.
                const { verifyAdminPassword } = await import("./admin-password")
                if (credentials?.password && (await verifyAdminPassword(credentials.password))) {
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
