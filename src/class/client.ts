import EventEmitter from './emitter.js'

import { Buff }           from '@cmdcode/buff'
import { get_pubkey }     from '../lib/crypto.js'
import { gen_message_id } from '../lib/util.js'
import { SimplePool }     from 'nostr-tools'
import { SubCloser }      from 'nostr-tools/abstract-pool'

import {
  create_payload,
  create_envelope,
  parse_envelope,
  parse_payload
} from '../lib/message.js'

import {
  verify_relays,
  verify_seckey
} from '../lib/validate.js'

import type {
  EventFilter,
  MessageData,
  NodeConfig,
  NodeEventMap,
  SignedEvent,
  SubConfig,
  SubResponse,
  NodeMessageMap,
  MessageTemplate,
  SubFilter,
  ResolveReason,
  PubResponse,
  SignedMessage,
  BroadcastResponse,
  MessageIdResponse,
  MulticastResponse
} from '../types/index.js'

import * as CONFIG from '../config.js'
import * as Util   from '../util/index.js'

import 'websocket-polyfill'

/**
 * Default filter configuration for Nostr events.
 * Sets up basic event filtering for kind 20004 events.
 */
const FILTER_CONFIG = () => {
  return {
    kinds : [ 20004 ],    // Filter for specific Nostr event type
    since : Util.now()    // Only get events from current time onwards
  }
}

/**
 * Default configuration settings for a Nostr node.
 */
const NODE_CONFIG = () => {
  return {
    req_timeout  : 5000,
    since_offset : 5,
    start_delay  : 2000
  }
}

/**
 * NostrNode provides a complete implementation of a Nostr client node.
 * Handles message routing, relay connections, and event processing.
 */
export default class NostrNode extends EventEmitter <NodeEventMap> {
  // Core node components
  private readonly _conf     : NodeConfig
  private readonly _pool     : SimplePool    // Manages relay connections
  private readonly _pubkey   : string
  private readonly _relays   : string[]
  private readonly _seckey   : Buff          // Private key for signing messages

  // Message routing system
  private readonly _inbox : NodeMessageMap = {
    event : new EventEmitter(),  // General event handling
    id    : new EventEmitter(),  // Route by message ID
    peer  : new EventEmitter(),  // Route by peer pubkey
    tag   : new EventEmitter()   // Route by message tag
  }
  
  private _filter : EventFilter
  private _sub    : SubCloser | null = null  // Active relay subscription

  /**
   * Creates a new NostrNode instance.
   * @param relays   Array of relay URLs to connect to.
   * @param seckey   Secret key in hex format
   * @param options  Optional configuration parameters
   * @throws {Error} If relays array is invalid or secret key is malformed
   */
  constructor (
    relays  : string[],
    seckey  : string,
    options : Partial<NodeConfig> = {}
  ) {
    super()
    
    // Validate inputs before initialization
    verify_relays(relays)
    verify_seckey(seckey)

    this._seckey = new Buff(seckey)
    this._pubkey = get_pubkey(this._seckey.hex)
  
    this._conf   = get_node_config(options)
    this._filter = get_filter_config(options.filter)
    this._pool   = new SimplePool()
    this._relays = relays

    this.emit('info', [ 'filter:', JSON.stringify(this.filter, null, 2) ])
  }

  /**
   * Processes incoming Nostr events.
   * @param event    Signed Nostr event to process
   * @emits message  When event is successfully processed
   * @emits bounced  When event processing fails
   */
  private _handler = (event : SignedEvent) => {
    try {
      // Decrypt and parse the incoming message
      const payload = parse_envelope(event, this._seckey.hex)
      const msg     = parse_payload(payload, event)

      // Route message to all relevant subscribers
      this.emit('message', msg)
      this.inbox.id.emit(msg.id, msg)
      this.inbox.peer.emit(msg.env.pubkey, msg)
      this.inbox.tag.emit(msg.tag, msg)
    } catch (err) {
      this.emit('bounced', [ event.id, Util.parse_error(err) ])
    }
  }

  /**
   * Internal method to publish messages to the Nostr network.
   * @param message  Message data to publish
   * @param peer_pk  Target peer's public key
   * @param cache    Optional cache for tracking message status
   * @returns        Publication status and message ID
   */
  private _publish = async (
    message : MessageData,
    peer_pk : string,
    cache?  : Map<string, PubResponse>
  ) : Promise<PubResponse & MessageIdResponse> => {  
    // Create and sign the message envelope
    const payload  = create_payload(message.tag, message.data, message.id)
    const event    = create_envelope(payload, peer_pk, this._seckey.hex)
    const signed   = { ...message, env : event }

    // Publish to all connected relays
    const receipts = this._pool.publish(this.relays, event)
    this._inbox.event.emit('published', signed)

    return Promise.all(receipts).then(acks => {
      // Track successful and failed relay deliveries
      const fails  = this.relays.filter(r => !acks.includes(r))
      const msg_id = message.id
      const ok     = acks.length > 0
      const res    = { acks, fails, ok, peer_pk }

      if (cache !== undefined) cache.set(peer_pk, res)
      this._inbox.event.emit('settled', { ...res, msg_id })
      return { ...res, ok, msg_id }
    })
  }

  /**
   * Subscribes to the filter.
   * @param filter  The filter to subscribe to.
   * @param timeout The timeout for the subscription.
   * @returns       Returns the reason for failure, or null if successful.
   */
  private _subscribe (
    filter  : EventFilter,
    timeout : number = this.config.req_timeout,
    sub_id  : string = gen_message_id()
  ) : Promise<string | null> {
    this._filter = get_filter_config(filter)
    // Add our pubkey to the filter to receive direct messages
    this.filter['#p'] = [ ...this.filter['#p'] ?? [], this.pubkey ]
    // Subscribe to the filter.
    this._sub = this._pool.subscribeMany(this.relays, [ this._filter ], {
      id      : sub_id,
      oneose  : () => this.emit('subscribed', [ sub_id, this.filter ]),
      onevent : this._handler
    })
    return new Promise(resolve => {
      const timer    = setTimeout(()  => resolve('timeout'), timeout)
      const resolver = (reason : string | null) => { clearTimeout(timer); resolve(reason) }
      this.within('subscribed', ([ id ]) => {
        if (id === sub_id) resolver(null)
      }, timeout)
    })
  }

  get config() : NodeConfig {
    return this._conf
  }

  get filter() : EventFilter {
    return this._filter
  }

  get inbox() : NodeMessageMap {
    return this._inbox
  }

  get pubkey() : string {
    return this._pubkey
  }

  get relays() : string[] {
    return this._relays
  }

  /**
   * Broadcasts a message to multiple peers simultaneously.
   * @param message  Message template to broadcast
   * @param peers    Array of peer pubkeys to send to
   * @returns        Broadcast status including acks and failures
   */
  async broadcast (
    message : MessageTemplate,
    peers   : string[],
  ) : Promise<BroadcastResponse> {
    const cache  = new Map<string, PubResponse>()
    const msg    = finalize_message(message)
    // Send to all peers in parallel
    const outbox = peers.map(pk => this.publish(msg, pk))

    return Promise.all(outbox).then(settled => {
      // Collect success/failure stats
      const ok  = settled.every(r => r.ok)
      const res = { ok, cache, msg_id : msg.id, peers }

      settled.forEach(r => cache.set(r.peer_pk, r))
      this.emit('broadcast', res)
      return { ...res }
    })
  }

  /**
   * Establishes connections to configured relays.
   * @returns      This node instance
   * @emits ready  When connections are established
   */
  async connect (
    timeout : number = this.config.req_timeout
  ) : Promise<this> {
    // Start listening for events on all relays.
    const res = await this._subscribe(this._filter, timeout)
    if (res !== null) throw new Error(res)
    this.emit('ready', this)
    return this
  }

  /**
   * Gracefully closes all relay connections.
   * @emits close  When all connections are terminated
   */
  async close () : Promise<void> {
    if (this._sub !== null) {
      this._sub.close()
    }
    if (this._pool.close !== undefined) {
      this._pool.close(this.relays)
    }
    this.emit('close', this)
  }

  /**
   * Sends a request to a single peer and awaits response.
   * @param message  Message template to send
   * @param peer_pk  Target peer's public key
   * @param timeout  Maximum wait time in ms
   * @returns        Subscription response
   */
  async request (
    message : MessageTemplate,
    peer_pk : string,
    timeout : number = this.config.req_timeout
  ) : Promise<SubResponse> {
    const msg = finalize_message(message)
    // Set up listener before sending message
    const receipt = this.subscribe({ id : msg.id, peers : [ peer_pk ] }, { timeout })
    this.publish(msg, peer_pk)
    return receipt
  }

  /**
   * Sends a message and collects responses from multiple peers.
   * @param message  Message template to send
   * @param peers    Array of peer pubkeys to request from
   * @param timeout  Maximum wait time in ms
   * @returns        Combined broadcast and subscription status
   */
  async multicast (
    message : MessageTemplate,
    peers   : string[],
    timeout : number = this.config.req_timeout
  ) : Promise<MulticastResponse> {
    const msg = finalize_message(message)
    const sub = this.subscribe({ id : msg.id, peers }, { timeout })
    const pub = this.broadcast(msg, peers)
    return Promise.all([ sub, pub ]).then(([ sub, pub ]) => {
      return { sub, pub }
    })
  }

  /**
   * Publishes a single message to a specific peer.
   * @param message  Message template to send
   * @param pubkey   Recipient's public key
   * @returns        Publication status
   */
  async publish (
    message : MessageTemplate,
    pubkey  : string,
  ) : Promise<PubResponse> {
    const msg = finalize_message(message)
    return this._publish(msg, pubkey)
  }

  /**
   * Creates a subscription for incoming messages.
   * @param filter   Criteria for filtering messages
   * @param options  Subscription configuration
   * @returns        Collected messages and status
   */
  async subscribe (
    filter  : SubFilter,
    options : Partial<SubConfig> = {}
  ) : Promise<SubResponse> {
    const config = get_sub_config(options)
    return new Promise(resolve => {
      const { timeout, threshold }  = config
      const { id, peers = [], tag } = filter

      const authors : Set<string>        = new Set()
      const inbox   : Set<SignedMessage> = new Set()
      const timer   = setTimeout(() => resolver(false, 'timeout'), timeout)

      const resolver = (ok : boolean, reason : ResolveReason) => {
        clearTimeout(timer)
        const res = {
          ok,
          authors : Array.from(authors),
          inbox   : Array.from(inbox),
          peers,
          reason 
        }
        this.emit('resolved', res)
        resolve({ ...res })
      }

      const is_bounce = (msg : SignedMessage) => (
        (typeof id  === 'string' && id  !== msg.id)  ||
        (typeof tag === 'string' && tag !== msg.tag) ||
        (peers.length > 0 && !peers.includes(msg.env.pubkey))
      )

      this.within('message', (msg) => {
        if (!is_bounce(msg)) {
          authors.add(msg.env.pubkey)
          inbox.add(msg)
        }
        if (typeof threshold === 'number' && authors.size >= threshold) {
          resolver(true, 'threshold')
        }
        if (peers.length > 0 && peers.every(e => authors.has(e))) {
          resolver(true, 'complete')
        }
      }, timeout)
    })
  }

  /**
   * Updates the filter and subscribes to the new filter.
   * @param filter The new filter to subscribe to.
   */
  async update (filter : EventFilter) {
    if (this._sub !== null) this._sub.close()
    return this._subscribe(filter)
  }
}

/**
 * Ensures a message template has a valid ID.
 * @param template  Message template to finalize
 * @returns         Completed message data
 */
function finalize_message (template : MessageTemplate) : MessageData {
  const id = template.id ?? gen_message_id()
  return { ...template, id }
}

/**
 * Merges provided options with default node configuration.
 * @param opt      Custom configuration options
 * @returns        Complete node configuration
 */
function get_node_config (opt ?: Partial<NodeConfig>) {
  return { ...NODE_CONFIG(), ...opt }
}

/**
 * Combines custom filter settings with defaults.
 * @param filter   Custom filter settings
 * @returns        Complete filter configuration
 */
function get_filter_config (filter ?: Partial<EventFilter>) {
  return { ...FILTER_CONFIG(), ...filter }
}

/**
 * Merges subscription options with defaults.
 * @param config   Custom subscription options
 * @returns        Complete subscription configuration
 */
function get_sub_config (config : Partial<SubConfig>) {
  return { ...CONFIG.DEFAULT_SUB_CONFIG(), ...config }
}
