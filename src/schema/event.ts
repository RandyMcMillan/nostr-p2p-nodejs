import { z } from 'zod'
import base  from './base.js'

const mid     = base.hex16
const payload = base.str
const subject = base.str.min(3).max(256)
const tags    = base.str.array()

const envelope = z.tuple([ subject, mid, payload ])

const template = z.object({
  content    : base.str,
  created_at : base.stamp,
  kind       : base.num,
  pubkey     : base.hex32,
  tags       : tags.array()
})

const unsigned = template.extend({
  id : base.hex32
})

const signed = unsigned.extend({
  sig : base.hex64,
})

const message  = z.object({
  ctx : signed,
  dat : z.any(),
  id  : mid,
  tag : subject,
})

export default { envelope, message, signed, tags, template, unsigned }
