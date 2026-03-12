import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
import path from 'path'

config({ path: path.resolve(process.cwd(), '.env.local') })
config({ path: path.resolve(process.cwd(), '.env') })

const databaseUrl =
	process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/todo_db'



export default defineConfig({
	
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: databaseUrl
	},
	verbose: true,
	strict: true
})
