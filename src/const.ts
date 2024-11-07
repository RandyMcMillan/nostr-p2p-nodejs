import { now } from './lib/util.js'

import type { EventConfig, NodeConfig } from './types/index.js'

const EVENT_CONFIG = () : EventConfig => {
    return {
    created_at : now(),
    kind       : 20004,
    tags       : []
  }
}

const NODE_CONFIG = () : NodeConfig => {
  return {
    timeout : 5000
  }
}

export default { EVENT_CONFIG, NODE_CONFIG }
