import { EventMessage } from './event.js'

export type SubResponse <T = any> = OkResponse<T> | ErrorResponse

export interface SubFilter {
  id      ?: string
  peers   ?: string[]
  strict  ?: boolean
  tag     ?: string
  timeout ?: number
}

export interface OkResponse <T> {
  ok    : true
  inbox : EventMessage<T>[]
}

export interface ErrorResponse {
  ok    : false
  blame : string[]
  err   : string
}
