export type ContextMeter = {
  percent: number | undefined
  measuredAt: number
  hasWarnToastFired: boolean
  hasUrgentToastFired: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'context-meter': { meter: ContextMeter }
  }
}
