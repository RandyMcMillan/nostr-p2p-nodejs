import { NostrNode }  from '@cmdcode/nostr-p2p'
import { get_pubkey } from '@cmdcode/nostr-p2p/lib'

const RELAYS = [
  'wss://relay.nostrdice.com',
  'wss://relay.snort.social'
]

const carol_sk = 'df3566790211b7af4557b533ccf5144e6a0283d6c3b7e079d8662fa2358481b4'
const carol_pk = get_pubkey(carol_sk)

console.log('carol sk:', carol_sk)
console.log('carol pk:', carol_pk)

const node = new NostrNode(RELAYS, carol_sk)

node.event.on('info',   (args) => console.log('info:', args))
node.event.on('error',  (args) => console.log('error:', args))
node.event.on('filter', (args) => console.log('filter:', args))

node.rpc.on('ping', async msg => {
  console.log('carol received rpc:', msg.tag, msg.dat)
  console.log('sending response ...')

  const relays = await node.send('pong', 'pong!', msg.ctx.pubkey, msg.id)
  console.log('broadcast to relays:')
  console.log(relays)
})

await node.connect()
