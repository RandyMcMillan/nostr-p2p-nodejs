import { get_event_id } from './util.js'

import {
  sign_msg,
  verify_sig
} from './crypto.js'

import type {
  EventTemplate,
  SignedEvent
} from '../types/index.js'

import Schema from '../schema/index.js'

/**
 * Signs a Nostr event with the provided secret key.
 * @param seckey    Secret key in hex format
 * @param template  Event template to sign
 * @returns         Signed event with ID and signature
 */
export function sign_event (
  seckey   : string,
  template : EventTemplate
) : SignedEvent {
  const id  = get_event_id(template)
  const sig = sign_msg(seckey, id)
  return { ...template, id, sig }
}

/**
 * Verifies a signed Nostr event's integrity and signature.
 * @param event    Signed event to verify
 * @returns        Error message if validation fails, null if valid
 */
export function verify_event (
  event : SignedEvent
) : string | null {
  const { id, sig, ...template } = event
  const schema = Schema.event.signed
  const parsed = schema.safeParse(event)
  const vid    = get_event_id(template)
  if (!parsed.success) {
    return 'event failed schema validation'
  } else if (id !== vid) {
    return 'event id mismatch'
  } else if (!verify_sig(id, event.pubkey, sig)) {
    return 'invalid event signature'
  } else {
    return null
  }
}
