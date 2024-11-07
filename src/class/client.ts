import { Buff }         from '@cmdcode/buff'
import { EventEmitter } from './emitter.js'
import { get_pubkey }   from '../lib/crypto.js'

import {
  NDKEvent,
  NDKPrivateKeySigner,
  NDKSubscription,
} from '@nostr-dev-kit/ndk'

import {
  create_envelope,
  create_msg_event,
  parse_envelope,
  parse_msg_event,
  verify_event,
} from '../lib/event.js'

import {
  gen_message_id,
  get_unique_items,
  is_recipient,
  now,
  parse_error,
  parse_ndk_event,
  sleep
} from '../lib/util.js'

import type {
  EventFilter,
  EventMessage,
  NodeConfig,
  NodeEventMap,
  SignedEvent,
  SubFilter,
  SubResponse
} from '../types/index.js'

import CONST from '../const.js'
import NDK   from '@nostr-dev-kit/ndk'

import 'websocket-polyfill'

const { NODE_CONFIG, SUB_CONFIG } = CONST

export default class NostrNode {
  private readonly _client   : NDK
  private readonly _config   : NodeConfig
  private readonly _event    : EventEmitter<NodeEventMap>
  private readonly _inbox    : EventEmitter<Record<string, EventMessage>>
  private readonly _peers    : string[]
  private readonly _relays   : string[]
  private readonly _rpc      : EventEmitter<Record<string, EventMessage>>
  private readonly _seckey   : Buff
  private readonly _sub      : NDKSubscription

  constructor (
    relays  : string[],
    seckey  : string,
    options : Partial<NodeConfig> = {}
  ) {
    const signer = new NDKPrivateKeySigner(seckey)
    this._seckey = new Buff(seckey)

    this._config = { ...NODE_CONFIG(), ...options }
    this._client = new NDK({ explicitRelayUrls : relays, signer })
    this._event  = new EventEmitter()
    this._inbox  = new EventEmitter()
    this._peers  = this.config.peer_pks.filter(e => e !== this.pubkey)
    this._relays = relays
    this._rpc    = new EventEmitter()

    const filter : EventFilter = {
      kinds   : this.config.kinds,
      '#p'    : [ this.pubkey ],
      since   : now() - this.config.now_offset
    }

    if (this.peers.length !== 0) {
      filter.authors = this.peers
    }

    this.event.emit('info', [ 'filter:', JSON.stringify(filter, null, 2) ])

    this._sub = this.client.subscribe(filter)

    this._sub.on('event', (evt) => {
      try {
        const event = parse_ndk_event(evt)
        const error = this._filter(event)
        if (error !== null) {
          this.event.emit('filter', [ event.id, error ])
        } else {
          this._handler(event)
        }
      } catch (err) {
        console.error(err)
        this.event.emit('error', [ evt.id, parse_error(err) ])
      }
    })
  }

  _filter = (event : SignedEvent) => {
    const err = verify_event(event)
    if (err !== null) {
      return err
    } else if (!this.is_peer(event.pubkey)) {
      return 'author not in peer list'
    } else if (!this.is_recip(event)) {
      return 'pubkey not in recipient list'
    } else {
      return err
    }
  }

  _handler = (event : SignedEvent) => {
    const content = parse_msg_event(event, this._seckey.hex)
    const message = parse_envelope(content, event)
    this.event.emit('message', message)
    this.inbox.emit(message.id, message)
    this.rpc.emit(message.tag, message)
  }

  _publish = async (event : SignedEvent) => {
    const evt = new NDKEvent(this.client, event)
    return evt.publish().then(set => [ ...set ].map(e => e.url))
  }

  get client () {
    return this._client
  }

  get config () {
    return this._config
  }

  get event () {
    return this._event
  }

  get inbox () {
    return this._inbox
  }

  get peers () {
    return this._peers
  }

  get pubkey () {
    return get_pubkey(this._seckey.hex)
  }

  get relays () {
    return this._relays
  }

  get rpc () {
    return this._rpc
  }

  async connect (timeout ?: number) {
    await this.client.connect(timeout)
    await this._sub.start()
    await sleep(this.config.start_delay)
    this.event.emit('init', this)
    return this
  }

  is_peer (pubkey : string) {
    return (this.peers.length === 0 || this.peers.includes(pubkey))
  }

  is_recip (event : SignedEvent) {
    return is_recipient(event, this.pubkey)
  }

  async relay (
    subject : string,
    payload : string,
    peers   : string[],
    id?     : string
  ) : Promise<string[]> {
    id = id ?? gen_message_id()
    const outbox = []
    for (const pk of peers) {
      outbox.push(this.send(subject, payload, pk, id))
    }
    return Promise.all(outbox).then(e => get_unique_items(e))
  }

  async req (
    subject : string,
    payload : string,
    peers   : string[],
    filter  : SubFilter = {}
  ) : Promise<SubResponse> {
    const { id = gen_message_id() } = filter
    const sub = this.sub({ ...filter, id, peers })
    this.relay(subject, payload, peers, id)
    return sub
  }

  async send (
    subject : string,
    payload : string,
    peer_pk : string,
    msg_id  : string = Buff.random(16).hex
  ) : Promise<string[]> {
    const content = create_envelope(subject, payload, msg_id)
    const event   = create_msg_event(content, peer_pk, this._seckey.hex)
    return this._publish(event)
  }

  async sub (config : SubFilter) : Promise<SubResponse> {
    const conf      = { ...SUB_CONFIG(), ...config }
    const has_peers = conf.peers.length > 0
    return new Promise(resolve => {
      const { id, peers, tag, strict, timeout } = conf

      const authors : Set<string>       = new Set()
      const inbox   : Set<EventMessage> = new Set()

      const resolver = () => {
        if (has_peers && strict) {
          const blame = peers.filter(e => !authors.has(e))
          resolve({ ok : false, blame, err : 'timeout' })
        } else {
          resolve({ ok : true, data: [ ...inbox ] })
        }
      }

      const timer = setTimeout(resolver, timeout)

      const handler = (event : EventMessage) => {
        authors.add(event.ctx.pubkey)
        inbox.add(event)
        if (has_peers && peers.every(e => authors.has(e))) {
          clearTimeout(timer)
          resolve({ ok: true, data: [ ...inbox ] })
        }
      }

      if (typeof id === 'string') {
        this.inbox.within(id, (event) => handler(event), timeout)
      }

      if (typeof tag === 'string') {
        this.rpc.within(tag, (event) => handler(event), timeout)
      }
    })
  }
}
