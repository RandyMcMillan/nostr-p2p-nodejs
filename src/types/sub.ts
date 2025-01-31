export interface SubFilter {
  id    ?: string
  peers ?: string[]
  tag   ?: string
}

export interface SubConfig {
  threshold ?: number
  timeout   ?: number
}

