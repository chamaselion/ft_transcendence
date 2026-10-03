import { httpClient } from '@/auth/auth.api'
import type { Block } from '@/app/editor/types'

export interface DocumentData {
  id: string
  title: string
  content: string
  permission: 'owner' | 'editor' | 'viewer'
  createdAt: string
  updatedAt: string
}

export interface DocumentResponse {
  document: DocumentData
}

export interface ShareData {
  userId: string
  login: string
  email: string
  permission: 'viewer' | 'editor'
  createdAt: string
}

export interface SharesListResponse {
  shares: ShareData[]
}

export interface ShareResponse {
  share: ShareData
}

export async function createDocument(
  title = 'Untitled Document',
  blocks: Block[] = [],
): Promise<DocumentData> {
  const res = await httpClient.post<DocumentResponse>('/api/documents', {
    title,
    content: JSON.stringify(blocks),
  })
  return res.document
}

export async function getDocument(id: string): Promise<DocumentData> {
  const res = await httpClient.get<DocumentResponse>(`/api/documents/${id}`)
  return res.document
}

export async function updateDocumentTitle(documentId: string, title: string): Promise<DocumentData> {
  const res = await httpClient.patch<DocumentResponse>(`/api/documents/${documentId}`, {
    title,
  })
  return res.document
}

export async function listShares(documentId: string): Promise<ShareData[]> {
  const res = await httpClient.get<SharesListResponse>(`/api/documents/${documentId}/shares`)
  return res.shares || []
}

export async function createShare(
  documentId: string,
  email: string,
  permission: 'viewer' | 'editor' = 'viewer',
): Promise<ShareData> {
  const res = await httpClient.post<ShareResponse>(`/api/documents/${documentId}/shares`, {
    email,
    permission,
  })
  return res.share
}

export async function updateShare(
  documentId: string,
  userId: string,
  permission: 'viewer' | 'editor',
): Promise<ShareData> {
  const res = await httpClient.patch<ShareResponse>(
    `/api/documents/${documentId}/shares/${userId}`,
    { permission },
  )
  return res.share
}

export async function deleteShare(documentId: string, userId: string): Promise<void> {
  await httpClient.delete(`/api/documents/${documentId}/shares/${userId}`)
}
