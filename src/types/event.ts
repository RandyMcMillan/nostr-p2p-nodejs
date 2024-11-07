export interface EventFilter {
  ids     ?: string[]
  authors ?: string[]
  kinds   ?: number[]
  since   ?: number
  until   ?: number
  limit   ?: number
  [ key : string ] : any | undefined
}

export interface EventTemplate {
  content    : string
  created_at : number
  kind       : number
  pubkey     : string
  tags       : string[][]
}

export interface SignedEvent extends EventTemplate {
  id  : string
  sig : string
}

export type MessageEnvelope = [
  event_tag  : string,
  message_id : string,
  payload    : string 
]

export interface EventMessage <T = string> {
  ctx : SignedEvent
  dat : T
  id  : string
  tag : string
}
