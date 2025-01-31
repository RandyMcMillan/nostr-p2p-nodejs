import type { NostrNode } from '@cmdcode/nostr-p2p'
import type { Test }      from 'tape'

export interface TestContext {
  nodes  : NostrNode[]
  peers  : string[]
  relays : string[]
  tape   : Test
}
