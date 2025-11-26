import { BasePlugin, defineConfig } from '../';
import {RuleState} from '../'
import { Pen } from '@meta2d/core';
export default defineConfig({
  rules:[
    {
      target:(node:Pen)=> node.name === 'square',
      rules:{
        "BasePlugin/non-connect-from": RuleState.OPEN
      }
    }
  ],
  plugins:[
    BasePlugin
  ]
})