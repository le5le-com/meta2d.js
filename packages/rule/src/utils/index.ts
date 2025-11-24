import {Plugin} from "../types"

export const SEPARATOR = '/'
export function validatePlugin(plugin:Plugin){
  return plugin.name && plugin.rules
}