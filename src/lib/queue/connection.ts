import IORedis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

connection.on('error', (err) => {
  console.error('Redis connection error:', err)
})

connection.on('connect', () => {
  console.log('Redis connected successfully')
})

export const getRedisConnection = () => connection
