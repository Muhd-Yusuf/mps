import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
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
})

export { handler as GET, handler as POST }
