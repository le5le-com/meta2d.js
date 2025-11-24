import { Pen, Meta2d } from '@meta2d/core';


export enum MessageType {
  pass, // 通过
  warn, // 警告
  error, // 错误
}

enum RuleState {
  OPEN,
  CLOSE
}

export type Config<Node> = {
  rules: RuleConfig<Node>[] // 规则列表
  plugins: Plugin[], // 规则插件
  traverser: Traverser<any, any>, // 遍历节点数的方法
  stopByError: boolean
}

export type RuleConfig<Node> = {
  target: (node:Node) => boolean
  rules: Record<string, RuleState>
}

export type Rule<Node = Pen> = {
  name: string,
  meta?: {
    type?: string,
    docs?: {
      description: string,
      errorMessage: string | ((context: unknown) => Message)
    },
  }
  validate: (context: Context<Pen>,node:Node) => boolean
}

export type PluginConfig<TRuleNames extends string = string> = {
  recommends: {
    [K in TRuleNames]?: boolean;
  }
}

export type Plugin<TRules extends Rule[] = Rule[]> = {
  name: string
  rules: TRules
  config: PluginConfig<TRules[number]['name']>
}

export type Message = {
  type: MessageType,
  content: string
}

export type Context<Node> = {
  meta2d: Meta2d,
  point: Node,
  nodes: Node[],
  index: number,
  ruleMaps: Map<string, Rule>,
  config:Config<Node>
}

export type Traverser<Context, Node> = (context:Context) => ({
  point: Node
  next: (context?: Context) => Node | undefined
  done: boolean
})

export type RuleEngine = {
  start: any,
  traverser: any,
  context: Context<Pen>,
}