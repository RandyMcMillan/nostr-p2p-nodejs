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
  is_recipient,
  now,
  parse_error,
  parse_ndk_event
} from '../lib/util.js'

import type {
  EventMessage,
  NodeConfig,
  SignedEvent,
  SubResponse
} from '../types/index.js'

import CONST from '../const.js'
import NDK   from '@nostr-dev-kit/ndk'

import 'websocket-polyfill'

export default class NostrNode {
  private readonly _client   : NDK
  private readonly _config   : NodeConfig
  private readonly _evt      : EventEmitter<Record<string, any>>
  private readonly _inbox    : EventEmitter<Record<string, EventMessage>>
  private readonly _peers    : string[]
  private readonly _relays   : string[]
  private readonly _rpc      : EventEmitter<Record<string, EventMessage>>
  private readonly _seckey   : Buff
  private readonly _sub      : NDKSubscription | null

  constructor (
    kinds   : number[],
    peers   : string[],
    relays  : string[],
    seckey  : string,
    options : Partial<NodeConfig> = {}
  ) {
    const signer = new NDKPrivateKeySigner(seckey)
    this._seckey = new Buff(seckey)

    this._config = { ...CONST.NODE_CONFIG(), ...options }
    this._client = new NDK({ explicitRelayUrls : relays, signer })
    this._evt    = new EventEmitter()
    this._inbox  = new EventEmitter()
    this._peers  = peers.filter(e => e !== this.pubkey)
    this._relays = relays
    this._rpc    = new EventEmitter()

    this._sub    = this.client.subscribe({
      kinds,
      '#p'    : [ this.pubkey ],
      authors : peers,
      since   : now() - 10
    })

    this._sub.on('event', (evt) => {
      try {
        const event = parse_ndk_event(evt)
        const error = this._filter(event)
        if (error !== null) {
          this.evt.emit('filter', [ event.id, error ])
        } else {
          this._handler(event)
        }
      } catch (err) {
        console.error(err)
        this.evt.emit('error', [ evt.id, parse_error(err) ])
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
    this.rpc.emit(message.tag, message)
    this.inbox.emit(message.mid, message)
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

  get evt () {
    return this._evt
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

  connect () {
    return this.client.connect()
  }

  is_peer (pubkey : string) {
    return this._peers.includes(pubkey)
  }

  is_recip (event : SignedEvent) {
    return is_recipient(event, this.pubkey)
  }

  relay (
    subject : string,
    payload : string,
    peers   : string[],
    mid?    : string 
  ) : void {
    mid = mid ?? Buff.random(16).hex
    for (const pk of peers) {
      this.send(subject, payload, pk, mid)
    }
  }

  req (
    subject : string,
    payload : string,
    peers   : string[],
    mid     : string = Buff.random(16).hex,
    timeout : number = 5000
  ) : Promise<SubResponse> {
    const sub = this.sub(mid, peers, timeout)
    this.relay(subject, payload, peers, mid)
    return sub
  }

  send (
    subject : string,
    payload : string,
    peer_pk : string,
    msg_id  : string = Buff.random(16).hex
  ) : Promise<string[]> {
    const content = create_envelope(subject, payload, msg_id)
    const event   = create_msg_event(content, peer_pk, this._seckey.hex)
    return this._publish(event)
  }

  sub (
    mid     : string,
    peers   : string[],
    timeout : number = 5000
  ) : Promise<SubResponse> {
    return new Promise(resolve => {
      const authors : Set<string>       = new Set()
      const inbox   : Set<EventMessage> = new Set()

      const timer = setTimeout(() => {
        const blame = peers.filter(e => !authors.has(e))
        resolve({ ok : false, blame, err : 'timeout' })
      }, timeout)

      this.inbox.within(mid, (event) => {
        authors.add(event.ctx.pubkey)
        inbox.add(event)
        if (peers.every(e => authors.has(e))) {
          clearTimeout(timer)
          resolve({ ok: true, data: [ ...inbox ] })
        }
      }, timeout)
    })
  }
}
