import tape from 'tape'

import { sleep }          from '@/util/helpers.js'
import { NostrRelay }     from './src/lib/relay.js'
import { generate_nodes } from './src/lib/node.js'

import multicast_test from './src/case/multicast.test.js'
import publish_test   from './src/case/publish.test.js'

import type { TestContext } from './src/types.js'

const RELAYS  = [ 'ws://localhost:8002' ]

tape('Nostr P2P Test Suite', async t => {

  const names = [ 'alice', 'bob', 'carol' ]
  const nodes = generate_nodes(names, RELAYS)
  const relay = new NostrRelay(8002)
  
  const ctx : TestContext = { nodes, relays: RELAYS, tape: t }

  t.test('starting relay and nodes', async t => {
    await relay.start()
    await Promise.all(nodes.values().map(e => e.connect()))
    t.pass('relay and nodes started')
  })

  await sleep(1000)
  publish_test(ctx)
  await sleep(1000)
  multicast_test(ctx)

  t.test('stopping relay and nodes', async t => {
    await sleep(1000) 
    await Promise.all(nodes.values().map(node => node.close()))
    relay.close()
    t.pass('relay and nodes stopped')
  })
})
