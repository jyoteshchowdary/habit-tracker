'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Habit {
  id: string
  name: string
  description: string
  created_at: string
}

interface HabitWithStreak extends Habit {
  streak: number
  lastLogged: string | null
}

export default function Dashboard() {
  const [habits, setHabits] = useState<HabitWithStreak[]>([])
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitDesc, setNewHabitDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push('/auth')
        return
      }
      setUserId(data.session.user.id)
      fetchHabits(data.session.user.id)
    }

    checkAuth()
  }, [router])

  const fetchHabits = async (uid: string) => {
    setLoading(true)
    try {
      const { data: habitsData, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', uid)

      if (error) throw error

      // Calculate streaks for each habit
      const habitsWithStreaks = await Promise.all(
        habitsData.map(async (habit) => {
          const { data: logs } = await supabase
            .from('habit_logs')
            .select('logged_date')
            .eq('habit_id', habit.id)
            .order('logged_date', { ascending: false })

          let streak = 0
          let lastLogged = null

          if (logs && logs.length > 0) {
            lastLogged = logs[0].logged_date
            streak = logs.length // Simple: count total logs as streak
          }

          return { ...habit, streak, lastLogged }
        })
      )

      setHabits(habitsWithStreaks)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const createHabit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !newHabitName) return

    try {
      const { error } = await supabase.from('habits').insert([
        {
          user_id: userId,
          name: newHabitName,
          description: newHabitDesc,
        },
      ])

      if (error) throw error

      setNewHabitName('')
      setNewHabitDesc('')
      fetchHabits(userId)
    } catch (err) {
      console.error(err)
    }
  }

  const logHabit = async (habitId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { error } = await supabase.from('habit_logs').insert([
        {
          habit_id: habitId,
          logged_date: today,
        },
      ])

      if (error) throw error
      
      // Refresh habits immediately
      setTimeout(() => {
        if (userId) fetchHabits(userId)
      }, 500)
    } catch (err) {
      console.error(err)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Habits</h1>
          <div className="space-x-4">
            <Link
              href="/leaderboard"
              className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 inline-block transition-colors"
            >
              🏆 Leaderboard
            </Link>
            <Link
              href="/friends"
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 inline-block transition-colors"
            >
              Friends
            </Link>
            <button
              onClick={logout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Create habit form */}
        <form onSubmit={createHabit} className="bg-white p-6 rounded-lg shadow-lg mb-6 border-2 border-blue-200">
          <h2 className="text-xl font-bold mb-4 text-gray-900">✨ Create New Habit</h2>
          <input
            type="text"
            placeholder="Habit name (e.g., Morning Run)"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newHabitDesc}
            onChange={(e) => setNewHabitDesc(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
          />
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-semibold"
          >
            Create Habit
          </button>
        </form>

        {/* Habits list */}
        <div className="space-y-4">
          {habits.map((habit) => (
            <div key={habit.id} className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{habit.name}</h3>
                  {habit.description && <p className="text-gray-600">{habit.description}</p>}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-blue-500">{habit.streak}</p>
                  <p className="text-gray-600 text-sm">day streak</p>
                </div>
              </div>

              <button
                onClick={() => logHabit(habit.id)}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-semibold text-lg"
              >
                ✓ Log Today
              </button>
            </div>
          ))}
        </div>

        {habits.length === 0 && (
          <p className="text-center text-gray-600 mt-8">No habits yet. Create one above!</p>
        )}
      </div>
    </div>
  )
}