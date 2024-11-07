import { now } from './lib/util.js'

const EVENT_CONFIG = () => {
  return {
    created_at : now(),
    kind       : 20004,
    tags       : [] as string[][]
  }
}

const NODE_CONFIG = () => {
  return {
    kinds       : [ 20004 ],
    peer_pks    : [] as string[],
    now_offset  : 5,
    req_timeout : 5000,
    start_delay : 2000
  }
}

const SUB_CONFIG = () => {
  return {
    peers   : [] as string[],
    strict  : true,
    timeout : 5000
  }
}

const REQ_TIMEOUT = 5000

export default { EVENT_CONFIG, NODE_CONFIG, SUB_CONFIG, REQ_TIMEOUT }
