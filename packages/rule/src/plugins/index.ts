import { Message, MessageType, Plugin } from '../types';

export const BasePlugin: Plugin = {
  name:"BasePlugin",
  rules:[
    {
      name:"non-connect-from",
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
      validate:(context,node)=>{
        return node.type === 1
      },
      fail:(context,node)=>{
        console.log('fail', node.id);
      }
    }
  ],
  config:{
    recommends:{
      "non-connect-from": true
    }
  }
}