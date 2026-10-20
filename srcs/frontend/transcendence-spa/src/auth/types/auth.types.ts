import { type User } from './user'

interface PendingUpdate {
  login?: string
  email?: string
}

export interface OtpConfirmationResponse {
  profileUpdateConfirmationRequired: boolean
  confirmationId: string
  email: string
  attemptsRemaining: number
  codeLength: number
  expiresAt: number
  codeSent: boolean
  message: string
  pendingUpdate: PendingUpdate
  user: User
}

export interface GdprDataRequestResponse {
  requestAccepted: boolean
  reference: string
  emailSent: boolean
  message?: string
}

