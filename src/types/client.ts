import NostrNode from '@/class/client.js'

import type { EventMessage } from './event.js'

export interface NodeEventMap {
  'init'    : NostrNode
  'info'    : string[]
  'error'   : string[]
  'filter'  : string[]
  'message' : EventMessage
}
