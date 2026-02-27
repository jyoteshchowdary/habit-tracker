'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserStreak {
  username: string
  maxStreak: number
  totalLogs: number
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<UserStreak[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push('/auth')
        return
      }
      fetchLeaderboard()
    }

    checkAuth()
  }, [router])

  const fetchLeaderboard = async () => {
    try {
      const { data: users } = await supabase.from('users').select('id, username')

      if (!users) return

      const userStats = await Promise.all(
        users.map(async (user) => {
          const { data: habits } = await supabase
            .from('habits')
            .select('id')
            .eq('user_id', user.id)

          let maxStreak = 0
          let totalLogs = 0

          if (habits) {
            for (const habit of habits) {
              const { data: logs } = await supabase
                .from('habit_logs')
                .select('logged_date')
                .eq('habit_id', habit.id)
                .order('logged_date', { ascending: false })

              if (logs) {
                totalLogs += logs.length

                // Calculate streak for this habit
                let streak = 0
                const today = new Date()
                let currentDate = new Date(today)
                currentDate.setHours(0, 0, 0, 0)

                for (const log of logs) {
                  const logDate = new Date(log.logged_date)
                  logDate.setHours(0, 0, 0, 0)

                  if (logDate.getTime() === currentDate.getTime()) {
                    streak++
                    currentDate.setDate(currentDate.getDate() - 1)
                  } else {
                    break
                  }
                }

                maxStreak = Math.max(maxStreak, streak)
              }
            }
          }

          return {
            username: user.username,
            maxStreak,
            totalLogs,
          }
        })
      )

      const sorted = userStats
        .filter((u) => u.maxStreak > 0 || u.totalLogs > 0)
        .sort((a, b) => b.maxStreak - a.maxStreak || b.totalLogs - a.totalLogs)

      setLeaderboard(sorted)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-4 text-gray-900">Loading...</div>
  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-8">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 font-semibold">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 text-center">🏆 Leaderboard</h1>
          <p className="text-gray-600 text-center mb-8">Top habit trackers by streak</p>

          {leaderboard.length > 0 ? (
            <div className="space-y-4">
              {leaderboard.map((user, idx) => (
                <div
                  key={user.username}
                  className={`p-6 rounded-lg border-2 transition-all hover:shadow-md ${
                    idx === 0
                      ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-400'
                      : idx === 1
                        ? 'bg-gradient-to-r from-gray-100 to-gray-200 border-gray-400'
                        : idx === 2
                          ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-400'
                          : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-bold text-gray-900 w-12 text-center">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </div>
                      <div>
                        <p className="text-xl font-bold text-gray-900">{user.username}</p>
                        <p className="text-sm text-gray-600">{user.totalLogs} total logs</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-bold text-blue-600">{user.maxStreak}</p>
                      <p className="text-sm text-gray-600">day streak</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600">No habits logged yet. Start tracking!</p>
          )}
        </div>
      </div>
    </div>
  )
}