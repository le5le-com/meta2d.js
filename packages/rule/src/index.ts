import type { Config } from './types'
import type { Pen } from '@meta2d/core'

export * from './types'
export * from './core'
export * from './plugins'
export { default as defaultConfig } from './default/config'

export function defineConfig(
  config: Config<Pen>
) {
  return config
}