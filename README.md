# nostr-p2p

Build your own peer-to-peer messaging protocol, transmitted by relays.

## Overview

Nostr-P2P is a light-weight SDK for building your own end-to-end encrypted, peer-to-peer messaging protocol. It handles encryption, message routing, and relay management while providing a simple API for developers.

### Core Features

* **End-to-End Encryption**: All messages are encrypted using AES-256-GCM with unique shared secrets per peer
* **Type-Safe Event System**: Built with TypeScript for compile-time safety and better developer experience
* **Flexible Message Routing**: Support for direct messages, broadcasts, and multi-peer requests
* **Runtime Validation**: Message schemas enforced using Zod for reliable data handling
* **Configurable Timeouts**: Customizable timeouts for requests and subscriptions
* **Event Emitter System**: Rich event system for handling messages and node states

### Roadmap

* Peer discovery: Currently, each node must be manually configured with a list of peers. It would be nice to have a message channel for peer discovery, with joins and leaves.
* Public profiles: Nodes should be able to take advantage of public profiles to advertise their presence and metadata.
* Private stores: Each node should be able to maintain a private store of data for configuration and state.
* Shared stores: Nodes should be able to share data repositories with each other via shared stores.

## Installation

```bash
npm install @cmdcode/nostr-p2p
```

## Basic Usage

### Creating a Node

```typescript
import { NostrNode } from '@cmdcode/nostr-p2p'
import { now } from '@cmdcode/nostr-p2p/utils'

// Configure event filtering
const filter = {
  kinds: [20004],  // Custom event kind for p2p messages
  since: now()     // Only get events from now onwards
}

// List of relays to connect to
const relays = [
  'wss://relay.nostrdice.com',
  'wss://relay.snort.social'
]

// Initialize and connect the node
const node = new NostrNode(relays, seckey, { filter })
await node.connect()
```

### Message Structure

Messages in nostr-p2p follow this format:

```typescript
interface MessageData {
  id: string      // 16-byte unique identifier (hex)
  tag: string     // Topic/label for message routing
  data: any       // The actual message payload
}

interface SignedMessage {
  data: any           // Decrypted message payload
  env: SignedEvent    // Original Nostr event
  id: string          // Message identifier
  tag: string         // Message topic
}
```

### Messaging API

The SDK provides several methods for different messaging patterns, each serving a specific purpose:

#### Direct Messages (publish)
```typescript
// Send to a single peer
await node.publish({
  tag: 'greeting',      // A label used to categorize and filter messages
  data: 'Hello!',       // Your message payload - can be any serializable data
  id: 'optional-msg-id' // Custom identifier for tracking specific messages
}, peerPubkey)         // The recipient's public key
```
The `publish` method encrypts and sends a message to a single peer. The message is end-to-end encrypted using a shared secret derived from your private key and the recipient's public key. Only the intended recipient can decrypt the message.

#### Broadcasts (broadcast)
```typescript
// Broadcast to multiple peers
await node.broadcast({
  tag: 'announcement',        // Topic or category for the message
  data: 'Hello everyone!'     // Message content sent to all recipients
}, peerPubkeys)              // Array of recipient public keys
```
`broadcast` sends the same message to multiple peers. Each recipient receives their own encrypted copy of the message, ensuring privacy even in group communications.

#### Request-Response Pattern (request)
```typescript
// Request-response pattern
const response = await node.request({
  tag: 'query',              // Identifies this as a query message
  data: { type: 'status' }   // The query parameters
}, peerPubkey, 5000)         // Recipient pubkey and 5s timeout
```
The `request` method is used when you expect a response from the peer. It automatically handles message correlation and will reject the promise if no response is received within the timeout period.

#### Multi-Peer Requests (multicast)
```typescript
// Multi-peer request
const responses = await node.multicast({
  tag: 'query',
  data: { type: 'status' }
}, peerPubkeys, 5000)        // Array of peers and timeout
```
`multicast` combines broadcasting with the request-response pattern. It sends a request to multiple peers and collects their responses, returning an array of all received responses within the timeout period.

### Event Handling

The SDK provides a flexible event system for handling incoming messages. You can subscribe to messages using various filters:

```typescript
// Listen for specific message IDs
node.inbox.id.on('deadbeef', (msg: SignedMessage) => {
  console.log('Got message:', msg.data)
})
```
This is useful when you need to track specific messages, such as responses to requests. The handler will only be called for messages matching this exact ID.

```typescript
// Listen for messages from specific peers
node.inbox.peer.on('pubkey123', (msg: SignedMessage) => {
  console.log('From peer:', msg.data)
})
```
Use this when you want to process all messages from a particular peer, regardless of their tags or content.

```typescript
// Listen for specific message topics
node.inbox.tag.on('status', (msg: SignedMessage) => {
  console.log('Status update:', msg.data)
})
```
Tag-based filtering allows you to handle different types of messages with dedicated handlers. This is particularly useful for implementing different features or protocols.

```typescript
// Node status events
node.on('ready', (node) => console.log('Connected!'))
node.on('close', (node) => console.log('Disconnected'))
node.on('error', (error) => console.error('Error:', error))
node.on('message', (msg) => console.log('Raw message:', msg))
```
The node itself emits events for connection state changes and errors, allowing you to monitor and respond to the node's status.

### Advanced Features

#### Subscription Options
```typescript
// Time-limited subscriptions
node.inbox.tag.within('status', (msg) => {
  console.log('Status within 5s:', msg)
}, 5000)
```
The `within` method creates a temporary subscription that automatically unsubscribes after the specified timeout. This is useful for gathering time-sensitive responses.

```typescript
// One-time handlers
node.inbox.id.once('deadbeef', (msg) => {
  console.log('First response:', msg)
})
```
Use `once` when you only need to handle the first occurrence of a message. The handler automatically unsubscribes after being triggered once.

#### Request Configuration
```typescript
const response = await node.multicast(message, peers, {
  timeout: 5000,    // Maximum time to wait for responses
  threshold: 3      // Resolve after receiving 3 responses
})
```
The multicast configuration allows you to fine-tune how responses are collected. The promise resolves either when the threshold is met or when the timeout is reached, whichever comes first.

## Security

- Messages are encrypted using AES-256-GCM with unique shared secrets per peer
- Shared secrets are derived using ECDH with secp256k1
- All messages are signed using Schnorr signatures
- Runtime validation ensures message integrity

## Dependencies

- `@noble/curves --` : Cryptographic primitives
- `@noble/ciphers -` : AES encryption
- `nostr-tools ----` : Nostr protocol utilities
- `zod ------------` : Schema validation

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build package
npm run build
```

## Resources

- [Noble Curves](https://github.com/paulmillr/noble-curves)
- [Noble Ciphers](https://github.com/paulmillr/noble-ciphers)
- [Nostr Tools](https://github.com/nostr-tools)
- [Zod](https://github.com/colinhacks/zod)

## License

MIT
