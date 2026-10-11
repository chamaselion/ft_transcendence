export interface Root {
  loggedIn: boolean
  user?: User
}

export interface User {
  id: string
  login: string
  email: string
  role: string
  avatarUrl?: string // NOTE: Temporary ICON/Avatar URL for Profile Icon
}

export interface UserDetailed {
  id: string
  login: string
  email: string
  role: string
  avatarUrl?: string // NOTE: Temporary ICON/Avatar URL for Profile Icon
  createdAt: string
  updatedAt: string
}
