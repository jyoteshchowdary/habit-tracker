'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: string
  username: string
}

interface Habit {
  id: string
  name: string
  description: string
}

interface HabitWithStreak extends Habit {
  streak: number
}

interface FriendWithHabits extends User {
  habits: HabitWithStreak[]
  isFollowing: boolean
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendWithHabits[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [userId, setUserId] = useState<string | null>(null)
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
      setUserId(data.session.user.id)
      fetchFriends(data.session.user.id)
      fetchAllUsers(data.session.user.id)
    }

    checkAuth()
  }, [router])

  const fetchFriends = async (uid: string) => {
    try {
      const { data: followingData } = await supabase
        .from('friendships')
        .select('following_id')
        .eq('follower_id', uid)

      if (!followingData) return

      const friendIds = followingData.map((f) => f.following_id)

      const { data: usersData } = await supabase
        .from('users')
        .select('id, username')
        .in('id', friendIds)

      if (!usersData) return

      // Get habits and streaks for each friend
      const friendsWithHabits = await Promise.all(
        usersData.map(async (user) => {
          const { data: habitsData } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id)

          const habitsWithStreaks = await Promise.all(
            (habitsData || []).map(async (habit) => {
              const { data: logs } = await supabase
                .from('habit_logs')
                .select('logged_date')
                .eq('habit_id', habit.id)

              return {
                ...habit,
                streak: logs?.length || 0,
              }
            })
          )

          return {
            ...user,
            habits: habitsWithStreaks,
            isFollowing: true,
          }
        })
      )

      setFriends(friendsWithHabits)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllUsers = async (uid: string) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, username')
        .neq('id', uid)

      setAllUsers(data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const toggleFollow = async (followingId: string, isFollowing: boolean) => {
    if (!userId) return

    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('friendships')
          .delete()
          .eq('follower_id', userId)
          .eq('following_id', followingId)
      } else {
        // Follow
        await supabase.from('friendships').insert([
          {
            follower_id: userId,
            following_id: followingId,
          },
        ])
      }

      // Refresh
      fetchFriends(userId)
      fetchAllUsers(userId)
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-8">
          <Link href="/dashboard" className="text-blue-500 hover:underline">
            Back to Dashboard
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Friends</h1>

        {/* Following */}
        {friends.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Following ({friends.length})</h2>
            <div className="space-y-6">
              {friends.map((friend) => (
                <div key={friend.id} className="bg-white p-6 rounded-lg shadow">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{friend.username}</h3>
                    <button
                      onClick={() => toggleFollow(friend.id, true)}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                    >
                      Unfollow
                    </button>
                  </div>

                  {friend.habits.length > 0 ? (
                    <div className="space-y-3">
                      {friend.habits.map((habit) => (
                        <div key={habit.id} className="bg-gray-50 p-4 rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-gray-900">{habit.name}</p>
                              {habit.description && (
                                <p className="text-gray-600 text-sm">{habit.description}</p>
                              )}
                            </div>
                            <p className="text-2xl font-bold text-blue-500">{habit.streak}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600">No habits yet</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discover users */}
        {allUsers.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Discover Users</h2>
            <div className="grid gap-4">
              {allUsers.map((user) => {
                const isFollowing = friends.some((f) => f.id === user.id)
                return (
                  <div key={user.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                    <p className="font-bold text-gray-900">{user.username}</p>
                    <button
                      onClick={() => toggleFollow(user.id, isFollowing)}
                      className={`px-4 py-2 rounded-lg text-white ${
                        isFollowing ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                    >
                      {isFollowing ? 'Unfollow' : 'Follow'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {allUsers.length === 0 && friends.length === 0 && (
          <p className="text-center text-gray-600">No users to follow yet</p>
        )}
      </div>
    </div>
  )
}