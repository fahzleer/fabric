import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
import path from 'path'

config({ path: path.resolve(process.cwd(), '.env.local') })
config({ path: path.resolve(process.cwd(), '.env') })

const databaseUrl =
	process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/todo_db'



export default defineConfig({
	schema: './src/lib/auth-schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: databaseUrl
	},
	tablesFilter: ['user', 'session', 'account', 'verification'],
	verbose: true,
	strict: true
})
