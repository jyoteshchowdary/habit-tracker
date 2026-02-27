'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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

            // Count consecutive days
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
      if (userId) fetchHabits(userId)
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Habits</h1>
          <button
            onClick={logout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            Logout
          </button>
        </div>

        {/* Create habit form */}
        <form onSubmit={createHabit} className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-bold mb-4">Create New Habit</h2>
          <input
            type="text"
            placeholder="Habit name (e.g., Morning Run)"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newHabitDesc}
            onChange={(e) => setNewHabitDesc(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
          >
            Create Habit
          </button>
        </form>

        {/* Habits list */}
        <div className="space-y-4">
          {habits.map((habit) => (
            <div key={habit.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{habit.name}</h3>
                  {habit.description && <p className="text-gray-600">{habit.description}</p>}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-blue-500">{habit.streak}</p>
                  <p className="text-gray-600 text-sm">day streak</p>
                </div>
              </div>

              <button
                onClick={() => logHabit(habit.id)}
                className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
              >
                Log Today
              </button>
            </div>
          ))}
        </div>

        {habits.length === 0 && (
          <p className="text-center text-gray-500 mt-8">No habits yet. Create one above!</p>
        )}
      </div>
    </div>
  )
}