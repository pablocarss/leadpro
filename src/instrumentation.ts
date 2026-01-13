export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWorkers } = await import('@/lib/queue')

    // Start queue workers
    try {
      startWorkers()
      console.log('Queue workers initialized successfully')
    } catch (error) {
      console.error('Failed to start queue workers:', error)
    }
  }
}
