import { is_recipient } from './util.js'

import {
  decrypt_content,
  encrypt_content,
  get_pubkey,
  get_shared_secret
} from './crypto.js'

import {
  sign_event,
  verify_event
} from './event.js'

import type {
  EventConfig,
  SignedEvent,
  SignedMessage
} from '../types/index.js'

import * as CONST  from '../const.js'
import * as Util   from '@/util/index.js'
import Schema      from '../schema/index.js'

/**
 * Creates a signed event envelope containing encrypted message content.
 * @param config   Event configuration
 * @param content  String content to encrypt and send
 * @param peer_pk  Recipient's public key
 * @param seckey   Sender's secret key in hex format
 * @returns        Signed Nostr event containing the encrypted message
 */
export function create_envelope (
  config  : EventConfig,
  payload : string,
  peer_pk : string,
  seckey  : string,
) : SignedEvent {
  // get created_at
  const created_at = config.created_at ?? Util.now()
  // get pubkey
  const pubkey  = get_pubkey(seckey)
  // get shared secret
  const secret  = get_shared_secret(seckey, peer_pk)
  // encrypt payload
  const content = encrypt_content(secret, payload)
  // Create an event template.
  const event   = { ...config, pubkey, content, created_at }
  // Add a tag for the peer's public key.
  event.tags.push([ 'p', peer_pk ])
  // Return the signed event.
  return sign_event(seckey, event)
}

/**
 * Decrypts and validates an incoming message envelope.
 * @param event    Signed Nostr event to decrypt
 * @param seckey   Recipient's secret key in hex format
 * @returns        Decrypted message content as string
 * @throws {Error} If event validation fails or recipient is not in peers list
 */
export function parse_envelope (
  event  : SignedEvent,
  seckey : string
) : string {
  // Verify the event.
  const error = verify_event(event)
  // If there is an error with the event, throw the error.
  if (error !== null) {
    throw new Error(error)
  }
  // get pubkey
  const pubkey = get_pubkey(seckey)
  // Assert that pubkey is in peers list.
  if (!is_recipient(event, pubkey)) {
    throw new Error('pubkey not in peers list')
  }
  const secret  = get_shared_secret(seckey, event.pubkey)
  const content = decrypt_content(secret, event.content)
  const payload = JSON.parse(content)
  return payload
}

/**
 * Creates a JSON string payload containing message metadata.
 * @param tag   Message type identifier
 * @param data  Message content
 * @param id    Unique message identifier
 * @returns     JSON stringified array of [tag, id, data]
 */
export function create_payload (
  tag  : string,
  data : string,
  id   : string
) : string {
  return JSON.stringify([ tag, id, data ])
}

/**
 * Validates and parses a message payload according to schema.
 * @param payload  JSON string to parse and validate
 * @param event    Original signed event containing the payload
 * @returns        Parsed and validated message object
 * @throws {Error} If payload fails schema validation
 */
export function parse_payload (
  payload : string,
  event   : SignedEvent
) : SignedMessage {
  const schema = Schema.event.envelope
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    if (CONST.DEBUG) console.log(parsed.error)
    throw new Error('payload failed schema validation')
  }
  const [ tag, id, data ] = parsed.data
  return { env: event, data, id, tag }
}
