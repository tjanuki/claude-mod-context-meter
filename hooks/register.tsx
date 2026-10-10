import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ContextMeter } from '../types'

const meter = atom({ plugin: 'context-meter', key: 'meter' } as const, {
  percent: undefined,
  measuredAt: 0,
  hasWarnToastFired: false,
  hasUrgentToastFired: false,
} satisfies ContextMeter)

const handoffLine = (percent: number): string =>
  `Context ${percent}% — write a hand-off doc and start a new session.`

export const register: Register = (on, options) => {
  // The manifest's userConfig declares each field with a default, so a load always fills them in.
  const showPercent = Number(options.showPercent)
  const warnPercent = Number(options.warnPercent)
  const urgentPercent = Number(options.urgentPercent)
  const handoffPrompt = String(options.handoffPrompt)

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'ctx', description: 'Show the context fill and the hand-off thresholds' })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const percent = e.context.percent
    if (percent === undefined) {
      return next(e)
    }

    const measuredAt = await $.clock.now()
    const previousMeter = await read($, meter)
    const isUrgent = percent >= urgentPercent
    const isWarn = percent >= warnPercent
    const shouldToastUrgent = isUrgent && !previousMeter.hasUrgentToastFired
    // Jumping straight past both thresholds raises the urgent toast alone.
    const shouldToastWarn = isWarn && !previousMeter.hasWarnToastFired && !shouldToastUrgent

    await update($, meter, currentMeter => ({
      percent,
      measuredAt,
      hasWarnToastFired: currentMeter.hasWarnToastFired || isWarn,
      hasUrgentToastFired: currentMeter.hasUrgentToastFired || isUrgent,
    }))

    $.ui.status(percent < showPercent ? undefined : isWarn ? `⚠ ctx ${percent}% · hand-off time` : `ctx ${percent}%`)
    if (shouldToastUrgent || shouldToastWarn) {
      $.ui.toast(handoffLine(percent))
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { percent } = await read($, meter)
    if (e.props.hasSurvey || percent === undefined || percent < warnPercent) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text color={percent >= urgentPercent ? 'error' : 'warning'}>{handoffLine(percent)} </Text>
        <Button key="draft-handoff" label="Draft hand-off" onPress={() => $.prompt.submit({ text: handoffPrompt })} />
      </Box>
    )
  })

  on('command.run', { command: 'ctx' }, async $ => {
    const { percent } = await read($, meter)
    const fillText = percent === undefined ? 'Context not measured yet' : `Context ${percent}%`

    return { text: `${fillText} (warn at ${warnPercent}%, urgent at ${urgentPercent}%).` }
  })
}
