# nostr-p2p

Build your own peer-to-peer messaging protocol, transmitted by relays.

## Overview

This project provides a light-weight client for building your own peer-to-peer messaging protocol on-top of the Nostr relay network. The client handles peering, encryption, message routing, and relay management while providing a simple API for developers.

### Features

* **Simplified Messaging**  
  Provides a `SignedMessage` object for passing structured messages between peers, with support for direct messages, broadcasts, multicasts, and request-response.

* **Event-Driven Routing**  
  Includes an event-based inbox for handling incoming messages, with emitters for event type, message ID, peer pubkey, and topic tag.

* **Encryption and Validation**  
  Messages are end-to-end encrypted (AES-256-GCM) between peers, with strict runtime validation (using Zod).

* **Message Receipts**  
  Detailed promise-based receipts for asynchronous message delivery and response collection.

* **Reference Node**  
  Implements a generic `NostrNode` class with manageable relay connections, event filters, and timeouts.

## Installation

The `nostr-p2p` package can be installed in both node and browser environments. It's available through the npm registry for node projects, and via the unpkg CDN for browser applications.

### Node Environment

For node environments, simply install the package using your preferred package manager:

```bash
npm install @cmdcode/nostr-p2p
```

Then, import the package in your project:

```ts
import { NostrNode } from '@cmdcode/nostr-p2p'
```

### Browser Environment

You can include the package directly in your HTML file:

```html
<script src="https://unpkg.com/@cmdcode/nostr-p2p/dist/script.js"></script>
<script>
  const { NostrNode } = window.nostr_p2p
</script>
```

You can also import it as a module in modern browsers:

```html
<script type="module">
  import { NostrNode } from 'https://unpkg.com/@cmdcode/nostr-p2p/dist/module.js'
</script>
```

## Basic Usage

The core component of this library is the `NostrNode` client, which handles all the complexities of peer-to-peer messaging.

Each node can:
- Connect to multiple relays for redundancy.
- Send encrypted messages to specific peers.
- Broadcast messages to multiple peers.
- Handle request-response patterns.
- Subscribe to specific message types or peers.
- Manage message delivery receipts.

### Creating a Node

Create a basic Nostr node and connect it to a relay:

```typescript
import { NostrNode } from '@cmdcode/nostr-p2p'
import { now }       from '@cmdcode/nostr-p2p/utils'

const options = {
  filter : {
    kinds: [ 20004 ],  // Default event kind for p2p messages.
    since: now()       // Only get events from now onwards.
  }
}

// List of relays to connect to.
const relays = [
  'wss://relay.nostrdice.com',
  'wss://relay.snort.social'
]

// Create a new Nostr node.
const node = new NostrNode(relays, seckey, options)
// Connect to the relays.
await node.connect()
```

### Message Structure

Messages are structured in a basic format, with a message `id`, a topic `tag`, and a `data` payload.

```ts
interface MessageTemplate {
  data : Json    // The message payload, serialized as JSON.
  id?  : string  // Identifier for tracking specific messages.
  tag  : string  // A label to categorize and filter messages.
}
```

Delivered messages also include the original nostr event, stored as `env` (short for envelope).

```ts
interface SignedMessage {
  data : Json         // The message payload as JSON.
  env  : SignedEvent  // Original signed nostr event.
  id   : string       // The message identifier.
  tag  : string       // The message topic.
}
```

### Messaging API

The `NostrNode` client provides several methods for sending and receiving messages.

#### Direct Messages

The `publish` method encrypts and sends a message to a single peer:

```ts
const res : Promise<PubResponse> = node.publish(
  message : MessageTemplate,
  peer_pk : string
)
```

The message is end-to-end encrypted using the recipient's public key, so only the intended recipient can decrypt the message.

#### Broadcasts

The `broadcast` method sends a message to multiple peers:

```ts
const res : Promise<BroadcastResponse> = node.broadcast(
  message : MessageTemplate,
  peers   : string[]
)
```

All messages share the same message `id` and `tag`, but each recipient receives their own encrypted copy.

#### Request and Response

The `request` method is useful when you expect a response from the peer:

```ts
const res : Promise<SubResponse> = node.request(
  message : MessageTemplate,
  peer_pk : string,
  timeout : number
)
```

It automatically handles message correlation and will reject the promise if no response is received within the timeout period.

#### Multi-Peer Requests

The `multicast` method is useful when you expect a response from multiple peers:

```ts
const res : Promise<MulticastResponse> = node.multicast(
  message : MessageTemplate,
  peers   : string[],
  timeout : number
)
```

It sends a request to multiple peers and collects their responses, returning an array of all received responses within the timeout period.

#### Custom Subscriptions

The `subscribe` method allows you to implement a custom message listener with a timeout:

```ts
// Custom subscription
const sub : Promise<SubResponse> = node.subscribe (
  filter  : EventFilter,
  options : Partial<SubConfig>
)
```
This method is useful when you need to implement a custom message listener that is not covered by the other methods.

### Event Handling

The SDK provides an event inbox system for handling incoming messages. You can listen for messages using various filters:

#### On Message ID

For tracking messages with a specific ID, such as responses to requests:

```ts
node.inbox.id.on('deadbeef', (msg : SignedMessage) => {
  console.log('Got message:', msg.data)
})
```

#### On Message Peer

For tracking messages from a specific peer, based on their public key:

```ts
node.inbox.peer.on('pubkey123', (msg : SignedMessage) => {
  console.log('From peer:', msg.data)
})
```

#### On Message Topic

Listens for messages with a specific topic, allowing you to handle different types of messages with dedicated handlers.

```ts
node.inbox.tag.on('status', (msg : SignedMessage) => {
  console.log('Status update:', msg.data)
})
```

#### Inbox Events

The inbox emits several events that you can subscribe to for monitoring message handling:

```ts
// Listen for successfully published messages
node.inbox.event.on('published', (msg: SignedMessage) => {
  console.log('Message published:', msg)
})

// Listen for broadcast results
node.inbox.event.on('broadcast', (res: BroadcastResponse & MessageIdResponse) => {
  console.log('Broadcast complete:', response)
})

// Listen for settled messages (completed deliveries)
node.inbox.event.on('settled', (res: PubResponse & MessageIdResponse) => {
  console.log('Message settled:', response)
})
```

These events provide real-time feedback on message delivery status:
- `published ` : Emitted when a message is successfully published to the network
- `broadcast ` : Emitted when a broadcast operation completes, including delivery status
- `settled   ` : Emitted when a message delivery is fully settled (confirmed by relays)

#### Node Events

The node itself emits several events that provide comprehensive monitoring of its operation:

```ts
node.on('bounced',    (event_id: string, error: string) => console.log('Message bounced:', event_id, error))
node.on('closed',     (node: NostrNode)    => console.log('Node closed:', node))
node.on('debug',      (info: unknown)      => console.log('Debug:', info))
node.on('error',      (error: unknown)     => console.error('Node error:', error))
node.on('info',       (info: Json)         => console.log('Info:', info))
node.on('message',    (msg: SignedMessage) => console.log('Received message:', msg))
node.on('ready',      (node: NostrNode)    => console.log('Node is ready:', node))
node.on('subscribed', (sub_id: string, filter: EventFilter) => console.log('New subscription:', sub_id, filter))
```

### Advanced Features

#### Subscription Options
```ts
// Time-limited subscriptions
node.inbox.tag.within('status', (msg) => {
  console.log('Status within 5s:', msg)
}, 5000)
```
The `within` method creates a temporary subscription that automatically unsubscribes after the specified timeout. This is useful for gathering time-sensitive responses.

```ts
// One-time handlers
node.inbox.id.once('deadbeef', (msg) => {
  console.log('First response:', msg)
})
```
Use `once` when you only need to handle the first occurrence of a message. The handler automatically unsubscribes after being triggered once.

#### Request Configuration
```ts
const response = await node.multicast(message, peers, {
  timeout: 5000,    // Maximum time to wait for responses
  threshold: 3      // Resolve after receiving 3 responses
})
```
The multicast configuration allows you to fine-tune how responses are collected. The promise resolves either when the threshold is met or when the timeout is reached, whichever comes first.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build package
npm run build
```

## Roadmap

Here is a list of features that are planned for future releases:

* **Peer Discovery**  
  Currently, each node must be manually configured with a list of peers. We plan to implement 
  a message channel for automatic peer discovery, including join/leave notifications.

* **Public Profiles**  
  Enable nodes to leverage public profiles for advertising their presence and sharing metadata 
  with the network.

* **Private Stores**  
  Implement a secure, local storage system for each node to maintain configuration and state 
  data persistently.

* **Shared Stores**  
  Develop a distributed data sharing mechanism allowing nodes to maintain and synchronize 
  shared data repositories.

## Resources

- [Noble Curves](https://github.com/paulmillr/noble-curves)
- [Noble Ciphers](https://github.com/paulmillr/noble-ciphers)
- [Nostr Tools](https://github.com/nostr-tools)
- [Zod](https://github.com/colinhacks/zod)

## License

MIT
