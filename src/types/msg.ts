import { Json }        from './base.js'
import { SignedEvent } from './event.js'

export interface MessageTemplate {
  data : string,
  id?  : string,
  tag  : string
}

export interface MessageData extends MessageTemplate {
  id : string
}

export type MessagePayload = [
  tag  : string,
  id   : string,
  data : string
]

export interface SignedMessage {
  data : Json
  env  : SignedEvent
  id   : string
  tag  : string
}
