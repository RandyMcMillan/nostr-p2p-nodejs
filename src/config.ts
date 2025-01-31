import { now } from './util/index.js'

export const DEFAULT_EVENT_CONFIG = () => {
  return {
    created_at : now(),
    kind       : 20004,
    tags       : [] as string[][]
  }
}

export const DEFAULT_FILTER_CONFIG = () => {
  return {
    kinds : [ 20004 ],
    since : now()
  }
}

export const DEFAULT_NODE_CONFIG = () => {
  return {
    debug        : false as const,
    req_timeout  : 5000,
    since_offset : 5,
    start_delay  : 2000
  }
}

export const DEFAULT_SUB_CONFIG = () => {
  return {
    peers   : [] as string[],
    strict  : true,
    timeout : 5000
  }
}
