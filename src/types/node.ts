import NostrNode    from '@/class/client.js'
import EventEmitter from '@/class/emitter.js'

import type { Json }          from './base.js'
import type { EventFilter }   from './event.js'
import type { SignedMessage } from './msg.js'

import type {
  MessageIdResponse,
  BroadcastResponse,
  PubResponse
} from './res.js'

export interface NodeConfig {
  debug        : false
  filter      ?: Partial<EventFilter>
  peers       ?: string[]
  req_timeout  : number
  since_offset : number
  start_delay  : number
}

export interface NodeMessageMap {
  event : EventEmitter<NodeMessageEventMap>,
  id    : EventEmitter<Record<string, SignedMessage>>,
  peer  : EventEmitter<Record<string, SignedMessage>>,
  tag   : EventEmitter<Record<string, SignedMessage>>
}

export interface NodeMessageEventMap {
  'broadcast' : BroadcastResponse & MessageIdResponse
  'published' : SignedMessage
  'settled'   : PubResponse & MessageIdResponse
}

export interface NodeEventMap extends Record<string, any> {
  'bounced'  : [ event_id : string, error : string ]
  'closed'   : NostrNode
  'debug'    : unknown
  'error'    : unknown
  'info'     : Json
  'message'  : SignedMessage
  'ready'    : NostrNode
}
