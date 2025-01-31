import tape from 'tape'

import { NostrNode }  from '@cmdcode/nostr-p2p'
import { get_pubkey } from '@/lib/crypto.js'
import { sleep }      from '@/util/helpers.js'
import { NostrRelay } from './src/relay.js'

import multicast_test from './src/case/multicast.test.js'
import publish_test   from './src/case/publish.test.js'

import type { TestContext } from './src/types.js'

const RELAYS  = [ 'ws://localhost:8002' ]

const PEER_KEYS = [
  '9d74fe1385cb75cf77fe76526907d822587e9f5a1d254b4264d1a2dc0dca6653',
  'c9796d23277171c16d2ce54f5fc847fce3f611533e0cdbeb015152171cb9333d',
  '6cd4d79981a3fcef990ac873d059d7d03899b53fe041db24fe53e87739322455'
]

tape('Nostr P2P Test Suite', async t => {

  const peers = PEER_KEYS.map(e => get_pubkey(e))
  const relay = new NostrRelay(8002)

  const nodes = [
    new NostrNode(RELAYS, PEER_KEYS[0]),
    new NostrNode(RELAYS, PEER_KEYS[1]),
    new NostrNode(RELAYS, PEER_KEYS[2])
  ]
  
  const ctx : TestContext = { nodes, peers, relays: RELAYS, tape: t }

  t.test('starting relay and nodes', async t => {
    await relay.start()
    await Promise.all(nodes.map(e => e.connect()))
    t.pass('relay and nodes started')
  })

  await sleep(1000)
  publish_test(ctx)
  await sleep(1000)
  multicast_test(ctx)

  t.test('stopping relay and nodes', async t => {
    await sleep(1000) 
    await Promise.all(nodes.map(node => node.close()))
    relay.close()
    t.pass('relay and nodes stopped')
  })
})
