export interface Root {
  loggedIn: boolean
  user?: User
}

export interface User {
  id: string
  login: string
  email: string
  role: string
}
