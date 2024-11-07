import { EventMessage } from './event.js'

export type SubResponse <T = any> = OkResponse<T> | ErrorResponse

export interface OkResponse <T> {
  ok   : true
  data : EventMessage<T>[]
}

export interface ErrorResponse {
  ok    : false
  blame : string[]
  err   : string
}
