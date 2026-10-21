export interface Root {
  loggedIn: boolean
  user?: User
}

export interface User {
  id: string
  login: string
  email: string
  role: string
  avatarUrl?: string | null
}

export interface UserDetailed {
  id: string
  login: string
  email: string
  role: string
  avatarUrl?: string | null
  createdAt: string
  updatedAt: string
}
