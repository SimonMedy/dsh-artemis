import { createElement as h, useCallback, useEffect, useRef, useState } from 'react'
import { Button, Pill, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { derivePanelState, fetchOverview, selectActiveDevice } from './overview.mjs'
import { createSnapshotObjectUrl, fetchSnapshot } from './snapshot.mjs'

const POLL_INTERVAL_MS = 5_000

const styles = Object.freeze({
  root: { display: 'flex', flex: '1 1 auto', flexDirection: 'column', height: '100%', minHeight: 0, color: 'var(--dsw-alias-label-primary)', fontSize: 'var(--dsh-content-font-size-secondary, 13px)', lineHeight: 1.5 },
  header: { display: 'flex', flex: '0 0 auto', gap: 8, alignItems: 'center', boxSizing: 'border-box', height: 38, padding: '0 8px 0 16px', borderBottom: '0.5px solid var(--dsw-alias-border-l3)' },
  headerStatus: { display: 'flex', flex: '1 1 auto', gap: 8, alignItems: 'center', minWidth: 0 },
  headerLabel: { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  body: { display: 'flex', flex: '1 1 auto', flexDirection: 'column', gap: 14, minHeight: 0, padding: '14px 16px 18px', overflow: 'auto', scrollbarGutter: 'stable' },
  card: { display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'var(--dsw-alias-bg-layer-1)', border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 14 },
  cardHeader: { display: 'flex', gap: 10, alignItems: 'center' },
  deviceIdentity: { display: 'flex', flex: '1 1 auto', flexDirection: 'column', minWidth: 0 },
  deviceName: { overflow: 'hidden', fontSize: 15, lineHeight: 1.4, whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  secondary: { overflow: 'hidden', color: 'var(--dsw-alias-label-caption)', fontSize: 12, whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  facts: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px 12px', paddingTop: 2, color: 'var(--dsw-alias-label-secondary)', fontSize: 12 },
  factValue: { minWidth: 0, overflow: 'hidden', color: 'var(--dsw-alias-label-primary)', textAlign: 'right', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  preview: { display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain', border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 10, background: 'var(--dsw-alias-bg-layer-2)' },
  empty: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: 1.6 },
  note: { margin: 0, padding: '0 2px', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: 1.6 },
  warning: { margin: 0, padding: '8px 10px', color: 'var(--dsw-alias-label-secondary)', background: 'var(--dsw-alias-bg-layer-1)', border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 10, fontSize: 12, lineHeight: 1.5 },
})

function safeMessage(error) {
  if (error instanceof Error && error.message.includes('Web profile')) return error.message
  return 'Unable to refresh Android status'
}

function safeSnapshotMessage(error) {
  if (error instanceof Error && error.message.includes('Web profile')) return error.message
  return 'Unable to capture Android screen'
}

function DeviceCard({ overview }) {
  const device = selectActiveDevice(overview)
  const state = derivePanelState(overview)
  if (!device) {
    return h('section', { style: styles.card, 'aria-label': 'Android device' },
      h('div', { style: styles.cardHeader },
        h(StateDot, { state: state.dot }),
        h('div', { style: styles.deviceIdentity },
          h('span', { style: styles.deviceName }, state.deviceLabel),
          h('span', { style: styles.secondary }, overview.artemis.state === 'offline' ? 'Start ARTEMIS to discover devices' : 'Waiting for an ARTEMIS Android device'),
        ),
      ),
    )
  }
  return h('section', { style: styles.card, 'aria-label': 'Android device' },
    h('div', { style: styles.cardHeader },
      h(StateDot, { state: state.dot }),
      h('div', { style: styles.deviceIdentity },
        h('span', { style: styles.deviceName }, device.model ?? device.serial),
        h('span', { style: styles.secondary }, device.serial),
      ),
      h(Pill, null, state.deviceLabel),
    ),
    h('div', { style: styles.facts },
      h('span', null, 'ADB state'), h('span', { style: styles.factValue }, device.state),
      h('span', null, 'Product'), h('span', { style: styles.factValue }, device.product ?? '—'),
      h('span', null, 'Screen stream'), h('span', { style: styles.factValue }, overview.stream.connected ? 'Connected' : 'Idle'),
    ),
  )
}

function ScreenPreview({ overview, previewUrl, pending, error, onCapture }) {
  const device = selectActiveDevice(overview)
  const canCapture = Boolean(device && overview.stream.connected) && !pending
  return h('section', { style: styles.card, 'aria-label': 'Android screen' },
    h('div', { style: styles.cardHeader },
      h('div', { style: styles.deviceIdentity },
        h('span', { style: styles.deviceName }, 'Screen preview'),
        h('span', { style: styles.secondary }, 'Manual single-frame capture'),
      ),
      h(Button, {
        variant: 'toolbar',
        size: 'sm',
        disabled: !canCapture,
        onClick: () => { void onCapture() },
        'aria-label': 'Capture Android screen',
      }, pending ? 'Capturing…' : 'Capture screen'),
    ),
    previewUrl
      ? h('img', { src: previewUrl, alt: 'Android screen preview', style: styles.preview })
      : h('p', { style: styles.empty }, device && overview.stream.connected ? 'No frame captured yet.' : 'Connect an active ARTEMIS screen stream to capture one frame.'),
    error ? h('p', { style: styles.warning, role: 'alert' }, error) : null,
    h('p', { style: styles.note }, 'Captured frames are ephemeral: they are not persisted or added to model context.'),
  )
}

export function AndroidPanel() {
  const [overview, setOverview] = useState(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState(null)
  const [snapshotUrl, setSnapshotUrl] = useState(null)
  const [snapshotSerial, setSnapshotSerial] = useState(null)
  const [snapshotPending, setSnapshotPending] = useState(false)
  const [snapshotError, setSnapshotError] = useState(null)
  const alive = useRef(true)
  const inFlight = useRef(false)
  const snapshotInFlight = useRef(false)
  const snapshotHandle = useRef(null)

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (inFlight.current) return
    inFlight.current = true
    if (!silent && alive.current) setPending(true)
    try {
      const next = await fetchOverview()
      if (!alive.current) return
      setOverview(next)
      setError(null)
    } catch (cause) {
      if (alive.current) setError(safeMessage(cause))
    } finally {
      inFlight.current = false
      if (alive.current) setPending(false)
    }
  }, [])

  const capture = useCallback(async () => {
    if (snapshotInFlight.current || !overview) return
    const device = selectActiveDevice(overview)
    if (!device || !overview.stream.connected) return
    snapshotInFlight.current = true
    if (alive.current) {
      setSnapshotPending(true)
      setSnapshotError(null)
    }
    try {
      const snapshot = await fetchSnapshot()
      const handle = createSnapshotObjectUrl(snapshot)
      if (!alive.current) {
        handle.revoke()
        return
      }
      const previous = snapshotHandle.current
      snapshotHandle.current = handle
      setSnapshotUrl(handle.url)
      setSnapshotSerial(device.serial)
      previous?.revoke()
    } catch (cause) {
      if (alive.current) setSnapshotError(safeSnapshotMessage(cause))
    } finally {
      snapshotInFlight.current = false
      if (alive.current) setSnapshotPending(false)
    }
  }, [overview])

  useEffect(() => {
    alive.current = true
    void refresh()
    const timer = globalThis.setInterval(() => { void refresh({ silent: true }) }, POLL_INTERVAL_MS)
    return () => {
      alive.current = false
      globalThis.clearInterval(timer)
      const handle = snapshotHandle.current
      snapshotHandle.current = null
      handle?.revoke()
    }
  }, [refresh])

  const activeDevice = overview ? selectActiveDevice(overview) : null
  const activeSerial = activeDevice?.serial ?? null
  useEffect(() => {
    if (!snapshotUrl || snapshotSerial === activeSerial) return
    const handle = snapshotHandle.current
    snapshotHandle.current = null
    handle?.revoke()
    setSnapshotUrl(null)
    setSnapshotSerial(null)
    setSnapshotError(null)
  }, [activeSerial, snapshotSerial, snapshotUrl])

  const headerState = overview ? derivePanelState(overview) : null
  const dot = pending && !overview ? 'ongoing' : error && !overview ? 'error' : headerState?.dot ?? 'idle'
  const label = pending && !overview ? 'ARTEMIS Connecting' : error && !overview ? 'ARTEMIS Unavailable' : headerState?.artemisLabel ?? 'ARTEMIS'

  return h('div', { style: styles.root, 'data-dsh-artemis-panel': '' },
    h('header', { style: styles.header },
      h('div', { style: styles.headerStatus, role: 'status', 'aria-live': 'polite' },
        h(StateDot, { state: dot }),
        h('span', { style: styles.headerLabel }, label),
      ),
      h(Button, {
        variant: 'toolbar',
        size: 'sm',
        disabled: pending,
        onClick: () => { void refresh() },
        'aria-label': 'Refresh Android status',
      }, pending ? 'Refreshing…' : 'Refresh'),
    ),
    h('div', { style: styles.body },
      overview ? h(DeviceCard, { overview }) : h('p', { style: styles.empty }, pending ? 'Checking ARTEMIS and Android device state…' : 'Android status is unavailable.'),
      overview ? h(ScreenPreview, { overview, previewUrl: snapshotUrl, pending: snapshotPending, error: snapshotError, onCapture: capture }) : null,
      error ? h('p', { style: styles.warning, role: 'alert' }, overview ? `Last refresh failed. ${error}.` : `${error}.`) : null,
      h('p', { style: styles.note }, 'Manual device controls are added only after their upstream contracts are validated.'),
    ),
  )
}
