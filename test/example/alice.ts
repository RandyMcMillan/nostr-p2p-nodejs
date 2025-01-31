
import { NostrNode } from '@cmdcode/nostr-p2p'

import {
  gen_message_id,
  get_pubkey,
} from '@cmdcode/nostr-p2p/lib'

const PEERS = [
  'fb19683d99686c11243cb854968e2fb9657df3babfd65dc51acdeb95aef6743e',
  'd6fe5186bf6d3f09ac0804bd70df4d13283d2bde5498809a0fb58e12735aace1'
]

const RELAYS = [
  'wss://relay.nostrdice.com',
  'wss://relay.snort.social'
]

const alice_sk = 'fb28f2dd3e34ffeef84e533816b1f8c57b83b447f7f005101c079264b6406186'
const alice_pk = get_pubkey(alice_sk)

console.log('alice sk:', alice_sk)
console.log('alice pk:', alice_pk)

const node = new NostrNode(RELAYS, alice_sk)
const mid  = gen_message_id()

node.on('info',   (args) => console.log('info:', args))
node.on('error',  (args) => console.log('error:', args))
node.on('filter', (args) => console.log('filter:', args))

node.inbox.id.on(mid, msg => {
  console.log('alice received msg:', msg.id, msg.data)
})

node.inbox.tag.on('pong', msg => {
  console.log('alice received rpc:', msg.tag, msg.data)
})

node.on('ready', async () => {
  console.log('connected')
  console.log('sending message ...')

  const res = await node.collect({ tag: 'ping' })

  console.log('events:', res)
})

await node.connect()
