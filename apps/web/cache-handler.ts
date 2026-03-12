import { createClient } from 'redis'
import type { RedisClientType } from 'redis'

const CACHE_PREFIX = process.env.CACHE_PREFIX ?? 'nextjs:'
const TAGS_PREFIX = process.env.TAGS_PREFIX ?? 'nextjs:tags:'

interface CacheEntry {
	value: unknown
	lastModified: number
	tags: string[] | undefined
}

const memoryCache = new Map<string, CacheEntry>()

let redisClient: RedisClientType | null = null
let redisConnected = false

async function getRedisClient(): Promise<RedisClientType | null> {
	if (redisClient && redisConnected) return redisClient
	if (!process.env.REDIS_URL) return null
	try {
		redisClient = createClient({
			url: process.env.REDIS_URL,
			socket: {
				reconnectStrategy: (retries) => {
					if (retries > 3) {
						console.warn('[CacheHandler] Redis reconnect failed, using memory fallback')
						return false
					}
					return Math.min(retries * 100, 3000)
				}
			}
		})
		redisClient.on('error', (err) => {
			console.warn('[CacheHandler] Redis error:', err.message)
			redisConnected = false
		})
		await redisClient.connect()
		redisConnected = true
		console.log('[CacheHandler] Redis connected')
		return redisClient
	} catch (error) {
		console.warn('[CacheHandler] Redis connection failed, using memory fallback:', error)
		redisConnected = false
		return null
	}
}

export default class CacheHandler {
	private redis: RedisClientType | null = null

	constructor() {
		getRedisClient().then(client => {
			this.redis = client
		})
	}

	async get(key: string): Promise<{ value: unknown; lastModified: number } | null> {
		const fullKey = CACHE_PREFIX + key

		if (this.redis && redisConnected) {
			try {
				const data = await this.redis.get(fullKey)
				if (data) {
					const parsed = JSON.parse(data) as CacheEntry
					return {
						value: parsed.value,
						lastModified: parsed.lastModified
					}
				}
			} catch (error) {
				console.warn('[CacheHandler] Redis get failed:', error)
			}
		}

		const entry = memoryCache.get(fullKey)
		if (entry) {
			return {
				value: entry.value,
				lastModified: entry.lastModified
			}
		}
		return null
	}

	async set(
		key: string,
		data: { kind: 'FETCH' | 'PAGE'; data: unknown },
		ctx: { revalidate: number | false; tags?: string[] }
	): Promise<void> {
		const fullKey = CACHE_PREFIX + key
		const cacheData: CacheEntry = {
			value: data,
			lastModified: Date.now(),
			tags: ctx.tags
		}

		if (this.redis && redisConnected) {
			try {
				const serialized = JSON.stringify(cacheData)
				if (ctx.revalidate && typeof ctx.revalidate === 'number') {
					await this.redis.setEx(fullKey, ctx.revalidate, serialized)
				} else {
					await this.redis.set(fullKey, serialized)
				}
				if (ctx.tags && ctx.tags.length > 0) {
					for (const tag of ctx.tags) {
						await this.redis.sAdd(TAGS_PREFIX + tag, fullKey)
					}
				}
				return
			} catch (error) {
				console.warn('[CacheHandler] Redis set failed:', error)
			}
		}

		memoryCache.set(fullKey, cacheData)
		if (ctx.revalidate && typeof ctx.revalidate === 'number') {
			setTimeout(() => {
				memoryCache.delete(fullKey)
			}, ctx.revalidate * 1000)
		}
	}

	async revalidateTag(tag: string): Promise<void> {
		if (this.redis && redisConnected) {
			try {
				const keys = await this.redis.sMembers(TAGS_PREFIX + tag)
				if (keys.length > 0) {
					await this.redis.del(keys)
					await this.redis.del(TAGS_PREFIX + tag)
				}
				return
			} catch (error) {
				console.warn('[CacheHandler] Redis revalidateTag failed:', error)
			}
		}

		for (const [key, entry] of memoryCache.entries()) {
			if (entry.tags?.includes(tag)) {
				memoryCache.delete(key)
			}
		}
	}
}
