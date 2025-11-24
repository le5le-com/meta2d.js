import { Message, MessageType, Plugin } from '../types';

export const BasePlugin: Plugin = {
  name:"BasePlugin",
  rules:[
    {
      meta:{
        docs:{
          description:"是否允许开始连接线",
          errorMessage: (context): Message=>{
            return {
              type: MessageType.error,
              content: '此图元不允许有开始连接线'
            }
          }
        }
      },
      name:"non-connect-from",
      validate:(context,pen)=>{
        return true
      }
    }
  ],
  config:{
    recommends:{
      "non-connect-from": true
    }
  }
}