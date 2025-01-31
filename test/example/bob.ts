import { NostrNode }  from '@cmdcode/nostr-p2p'
import { get_pubkey } from '@cmdcode/nostr-p2p/lib'

const RELAYS = [
  'wss://relay.nostrdice.com',
  'wss://relay.snort.social'
]

const bob_sk = '2d91e39980bd3eaf45f59ff242b4e4fa83f78d391714c33ca11bb2e49348affc'
const bob_pk = get_pubkey(bob_sk)

console.log('bob sk:', bob_sk)
console.log('bob pk:', bob_pk)

const node = new NostrNode(RELAYS, bob_sk)

node.on('info',   (args) => console.log('info:', args))
node.on('error',  (args) => console.log('error:', args))
node.on('filter', (args) => console.log('filter:', args))

node.inbox.tag.on('pong', async msg => {
  console.log('bob received rpc:', msg.tag, msg.data)
  console.log('sending response ...')

  const relays = await node.send({ tag: 'pong', data: 'pong!' }, msg.ctx.pubkey)
  console.log('broadcast to relays:')
  console.log(relays)
})

await node.connect()
