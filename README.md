# nostr p2p

A basic peer-to-peer messaging protocol, transmitted by relays.

## Features

* Simple peer-to-peer messaging between client nodes.
* Messages are end-to-end encrypted using modern AES-256-GCM.
* Send request to multiple peers, with timeout and error handling.
* Fully typed and protected by run-time checking (with zod).

## How to Use

Here is a basic example of how to start a node:

```ts
import { NostrNode } from '@cmdcode/nostr-p2p'

// A list of event kinds to subscribe.
const KINDS = [ 20004 ]

// A list of peers to listen for.
const PEERS = [
  'fb19683d99686c11243cb854968e2fb9657df3babfd65dc51acdeb95aef6743e',
  'd6fe5186bf6d3f09ac0804bd70df4d13283d2bde5498809a0fb58e12735aace1'
]

// A list of relays to use.
const RELAYS = [
  'wss://relay.nostrdice.com',
  'wss://relay.snort.social'
]

// Create a new node.
const node = new NostrNode(KINDS, PEERS, RELAYS, alice_sk)

// Connect your node to the relays.
await node.connect()
```

There are three event emitter interfaces that you can hook into:

`evt   :` Internal events emitted by the node.  
`inbox :` Subscribe to messages via their message id.  
`rpc   :` Subscribe to messages via their subject tag.  

Here is an example of how to use these interfaces:

```ts
// Internal events are emitted and received on the event interface.
node.evt.on('filter', err => console.log('filter', err))

// Messages are received on the `rpc` interface via their subject tag.
node.rpc.on('pong', msg => {
  console.log('received rpc:', msg.tag, msg.dat)
})

// Messages are also recieved on the `inbox` interface via their message id.
node.inbox.on(mid, msg => {
  console.log('received msg:', msg.mid, msg.dat)
})
```

There are several ways that you can send messages, and subscribe to responses:

```ts
import { gen_msg_id } from '@cmdcode/nostr-p2p/lib'

// Generate a message id for identifying responses.
const mid = gen_msg_id()

// Send a message to a single peer.
await node.send('ping', 'ping!', PEERS[0], mid)

// Relay a message to multiple peers.
await node.relay('ping', 'ping!', PEERS, mid)

// Listen for expected responses from peers (with a timeout).
const sub = await node.sub(mid, PEERS)

// Send a message to multiple peers, and listen for responses (with a timeout).
const res = await node.req('ping', 'ping!', PEERS)
```

Requests to multiple peers are collected and returned in a simple interface:

```ts
res: {
  ok: true,
  data: [
    {
      ctx: [Object], // Nostr signed note object.
      dat: 'pong!',
      mid: '8001fef9b31b36f0507422c87dfe6a30',
      tag: 'pong'
    },
    {
      ctx: [Object], // Nostr signed note object.
      dat: 'pong!',
      mid: '8001fef9b31b36f0507422c87dfe6a30',
      tag: 'pong'
    }
  ]
}
```

If you fail to collect responses from all peers before the timeout, you get an error response (with blame):

```ts
res: {
  ok: false,
  blame: [
    'fb19683d99686c11243cb854968e2fb9657df3babfd65dc51acdeb95aef6743e'
  ],
  err: 'timeout'
}
```

## Development / Testing

There is an example demo located in the `test/example` folder.

You can run the demo by starting three terminals, then in each terminal:

`yarn load test/example/{alice|bob|carol}.ts`

Run a different user in each terminal, and make sure to run `alice` last, since she will initiate the request.

## Resources

**Noble Curves**  
Audited & minimal JS implementation of elliptic curve cryptography.  
https://github.com/paulmillr/noble-curves

**Noble Ciphers**  
Audited & minimal JS implementation of AES.  
https://github.com/paulmillr/noble-ciphers

**Nostr Development Kit**  
Build Nostr-related applications.  
https://github.com/nostr-dev-kit/ndk

**Zod**  
TypeScript-first schema validation.  
https://github.com/colinhacks/zod
