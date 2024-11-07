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

// A list of relays to use.
const relays = [
  'wss://relay.nostrdice.com',
  'wss://relay.snort.social'
]

// Create a new node.
const node = new NostrNode(relays, seckey)

// Connect your node to the relays.
await node.connect()
```

There are three event emitter interfaces that you can hook into:

`event :` Internal events emitted by the node.  
`inbox :` Subscribe to messages via their message id.  
`rpc   :` Subscribe to messages via their message tag.  

Here is an example of how to use these interfaces:

```ts
// Internal events are emitted and received on the event interface.
node.event.on('init' => ()     => console.log('node connected!'))
node.event.on('info',   (args) => console.log('info:', args))
node.event.on('error',  (args) => console.log('error:', args))
node.event.on('filter', (args) => console.log('filter:', args))
node.event.on('message', (msg) => console.log('message:', msg))

// Subscribe to messages via their message id.
node.inbox.on(message_id, (msg) => {
  console.log('received msg:', msg.id, msg.dat)
})

// Subscribe to messages via their message tag.
node.rpc.on('pong', (msg) => {
  console.log('received msg:', msg.tag, msg.dat)
})
```

There are several ways that you can send messages, and subscribe to responses:

```ts
import { gen_message_id } from '@cmdcode/nostr-p2p/lib'

// An example list of peer pubkeys:
const peers = [
  'fb19683d99686c11243cb854968e2fb9657df3babfd65dc51acdeb95aef6743e',
  'd6fe5186bf6d3f09ac0804bd70df4d13283d2bde5498809a0fb58e12735aace1'
]

// Generate a message id for identifying responses.
const message_id = gen_message_id()

// Send a message to a single peer.
await node.send('ping', 'ping!', peers[0], message_id)

// Relay a message to multiple peers.
await node.relay('ping', 'ping!', peers, message_id)

// Listen for expected responses from peers (with a timeout).
const res = await node.sub({ id : message_id, timeout: 5000 })

// Send a message to multiple peers, and listen for responses.
const res = await node.req('ping', 'ping!', peers, { strict: true, timeout: 5000 })
```

Requests and Subscriptions are collected and returned in a simple interface:

```ts
res: {
  ok: true,
  inbox: [
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

If you specify a list of peers, and collect responses from all peers before the timeout, then the subscription will return early. Otherwise, it will fail (unless 'strict' is set to false).


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
