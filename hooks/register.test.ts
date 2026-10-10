import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const BAND_TARGET = {
  plugin: 'context-meter',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop'] as const

const DEFAULT_HANDOFF_PROMPT =
  "Context is getting large. Write a hand-off document for this session following the project's hand-off conventions, so a new session can continue from it."

type Recorded = { statusTexts: (string | undefined)[]; toastTexts: string[]; submittedTexts: string[] }

const startSession = async ($: Engine, on: On): Promise<Recorded> => {
  const recorded: Recorded = { statusTexts: [], toastTexts: [], submittedTexts: [] }
  mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.status', ($, e) => {
    recorded.statusTexts.push(e.text)

    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    recorded.toastTexts.push(e.text)

    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    recorded.submittedTexts.push(e.text)

    return { text: e.text }
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  // Stands for the engine's own band: empty.
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box' as const }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return recorded
}

const measure = async ($: Engine, percent: number): Promise<void> => {
  await $.session.measure({
    context: { tokens: percent * 2000, window: 200_000, percent },
    rateLimits: [],
    changed: ['context'],
  })
}

test('a measure writes the percent to the status line only from the show threshold', async ($, on) => {
  const recorded = await startSession($, on)
  await measure($, 5)
  await measure($, 55)
  await measure($, 74)

  expect(recorded.statusTexts).toEqual([undefined, 'ctx 55%', '⚠ ctx 74% · hand-off time'])
})

test('the band draws nothing below the warn threshold', async ($, on) => {
  await startSession($, on)
  await measure($, 69)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ ...BAND_TARGET, surface })
    expect(await band.find({ type: 'Text', text: /Context/ })).toBeUndefined()
    expect(await band.find({ key: 'draft-handoff' })).toBeUndefined()
    await band.unmount()
  }
})

test('the band shows the hand-off line in warning colour at the warn threshold', async ($, on) => {
  await startSession($, on)
  await measure($, 70)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ ...BAND_TARGET, surface })
    const line = await band.find({ type: 'Text', text: /^Context 70%/ })
    expect(line?.text.trim()).toBe('Context 70% — write a hand-off doc and start a new session.')
    expect(line?.props).toMatchObject({ color: 'warning' })
    expect((await band.find({ key: 'draft-handoff' }))?.props).toMatchObject({ label: 'Draft hand-off' })
    await band.unmount()
  }
})

test('the band line turns error coloured at the urgent threshold', async ($, on) => {
  await startSession($, on)
  await measure($, 85)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ ...BAND_TARGET, surface })
    expect((await band.find({ type: 'Text', text: /^Context 85%/ }))?.props).toMatchObject({ color: 'error' })
    await band.unmount()
  }
})

test('a toast fires once per threshold across repeated measures', async ($, on) => {
  const recorded = await startSession($, on)
  for (const percent of [50, 71, 73, 80, 86, 90, 95]) {
    await measure($, percent)
  }

  expect(recorded.toastTexts).toEqual([
    'Context 71% — write a hand-off doc and start a new session.',
    'Context 86% — write a hand-off doc and start a new session.',
  ])
})

test('pressing Draft hand-off submits the default prompt', async ($, on) => {
  const recorded = await startSession($, on)
  await measure($, 75)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ ...BAND_TARGET, surface })
    await band.press({ key: 'draft-handoff' })
    await band.unmount()
  }

  expect(recorded.submittedTexts).toEqual([DEFAULT_HANDOFF_PROMPT, DEFAULT_HANDOFF_PROMPT])
})

test(
  'configured thresholds and prompt are used',
  { options: { warnPercent: 50, urgentPercent: 60, handoffPrompt: 'Write the hand-off now.' } },
  async ($, on) => {
    const recorded = await startSession($, on)
    await measure($, 55)

    const band = await $.ui.mount({ ...BAND_TARGET, surface: 'terminal' })
    expect((await band.find({ type: 'Text', text: /^Context 55%/ }))?.props).toMatchObject({ color: 'warning' })
    await band.press({ key: 'draft-handoff' })
    await band.unmount()

    expect(recorded.submittedTexts).toEqual(['Write the hand-off now.'])
  },
)

test('/ctx answers the percent and the thresholds', async ($, on) => {
  await startSession($, on)
  const runCtx = () =>
    $.command.run({
      command: 'ctx',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    })

  expect((await runCtx()).text).toBe('Context not measured yet (warn at 70%, urgent at 85%).')
  await measure($, 74)
  expect((await runCtx()).text).toBe('Context 74% (warn at 70%, urgent at 85%).')
})
