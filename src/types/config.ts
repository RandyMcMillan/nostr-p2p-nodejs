export interface EventConfig {
  created_at : number
  kind       : number
  tags       : string[][]
}

export interface NodeConfig {
  kinds       : number[]
  peer_pks    : string[]
  now_offset  : number
  req_timeout : number
  start_delay : number
}
