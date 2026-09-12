window.__ModuleLoader__.load({ id: 'dsh-artemis', factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
const React = require('react');
const { Button, Pill, StateDot } = require('@deepseek-ai/dsh-client-ui-primitives');
const { createElement: h, useCallback, useEffect, useRef, useState } = React;
const ANDROID_TAB_ID = 'dsh-artemis:android';
const ANDROID_TAB_KIND = 'android';
const OVERVIEW_ROUTE = '/dsh-artemis/v1/overview';
const SNAPSHOT_ROUTE = '/dsh-artemis/v1/snapshot';
const PROTOCOL_VERSION = 1;
const POLL_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 4000;
const SNAPSHOT_TIMEOUT_MS = 6000;
const MAX_SNAPSHOT_BYTES = 8388608;
const PNG_SIGNATURE = Uint8Array.from([137,80,78,71,13,10,26,10]);
function androidTabDefinition() {
  return { id: ANDROID_TAB_ID, kind: ANDROID_TAB_KIND, priority: 'extension', title: () => 'Android', guide: [{ order: 40, title: () => 'Android', description: () => 'Inspect ARTEMIS and the active Android device' }] };
}
function record(value, label) { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object'); return value; }
function nullableString(value, label) { if (value === null) return null; if (typeof value !== 'string') throw new Error(label + ' must be a string or null'); const trimmed = value.trim(); return trimmed || null; }
function normalizeDevice(value, index) {
  const input = record(value, 'devices[' + index + ']');
  const serial = nullableString(input.serial, 'devices[' + index + '].serial');
  if (!serial) throw new Error('device serial must be non-empty');
  if (typeof input.state !== 'string' || !input.state.trim()) throw new Error('device state must be non-empty');
  if (typeof input.busy !== 'boolean') throw new Error('device busy must be boolean');
  return Object.freeze({ serial, state: input.state.trim().toLowerCase(), model: nullableString(input.model, 'device.model'), product: nullableString(input.product, 'device.product'), busy: input.busy });
}
function parseOverview(value) {
  const input = record(value, 'overview');
  if (input.version !== PROTOCOL_VERSION) throw new Error('Unsupported dsh-artemis protocol version');
  const artemis = record(input.artemis, 'artemis');
  if (artemis.state !== 'ready' && artemis.state !== 'offline') throw new Error('invalid ARTEMIS state');
  const status = nullableString(artemis.status, 'artemis.status');
  if (!Array.isArray(input.devices)) throw new Error('devices must be an array');
  const devices = Object.freeze(input.devices.map(normalizeDevice));
  const activeDeviceSerial = nullableString(input.activeDeviceSerial, 'activeDeviceSerial');
  const stream = record(input.stream, 'stream');
  if (typeof stream.connected !== 'boolean') throw new Error('stream.connected must be boolean');
  return Object.freeze({ version: input.version, artemis: Object.freeze({ state: artemis.state, status }), devices, activeDeviceSerial, stream: Object.freeze({ connected: stream.connected }) });
}
function selectActiveDevice(overview) { if (overview.activeDeviceSerial) { const active = overview.devices.find((entry) => entry.serial === overview.activeDeviceSerial); if (active) return active; } return overview.devices[0] || null; }
function derivePanelState(overview) { if (overview.artemis.state === 'offline') return { dot: 'idle', artemisLabel: 'ARTEMIS Offline', deviceLabel: 'No device' }; const active = selectActiveDevice(overview); if (!active) return { dot: 'warning', artemisLabel: 'ARTEMIS Ready', deviceLabel: 'No Android device' }; if (active.busy) return { dot: 'ongoing', artemisLabel: 'ARTEMIS Ready', deviceLabel: 'Busy' }; return { dot: 'done', artemisLabel: 'ARTEMIS Ready', deviceLabel: 'Ready' }; }
function overviewEndpoint() { if (!globalThis.location || (globalThis.location.protocol !== 'http:' && globalThis.location.protocol !== 'https:')) return null; return new URL(OVERVIEW_ROUTE, globalThis.location.origin).href; }
async function fetchOverview() { const endpoint = overviewEndpoint(); if (!endpoint) throw new Error('The Android panel currently requires the Harness Web profile'); const response = await globalThis.fetch(endpoint, { method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }); if (!response.ok) throw new Error('dsh-artemis overview returned HTTP ' + response.status); return parseOverview(await response.json()); }
function snapshotEndpoint() { if (!globalThis.location || (globalThis.location.protocol !== 'http:' && globalThis.location.protocol !== 'https:')) return null; return new URL(SNAPSHOT_ROUTE, globalThis.location.origin).href; }
function hasPngSignature(bytes) { return bytes.byteLength >= PNG_SIGNATURE.byteLength && PNG_SIGNATURE.every((value, index) => bytes[index] === value); }
async function readSnapshotBytes(response) {
  const declaredText = response.headers.get('content-length');
  if (declaredText !== null) { if (!/^\d+$/.test(declaredText)) throw new Error('Android snapshot returned an invalid Content-Length'); const declared = Number(declaredText); if (!Number.isSafeInteger(declared) || declared <= 0) throw new Error('Android snapshot returned an invalid Content-Length'); if (declared > MAX_SNAPSHOT_BYTES) throw new Error('Android snapshot exceeded the browser size limit'); }
  if (!response.body) throw new Error('Android snapshot returned an empty body');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_SNAPSHOT_BYTES) { await reader.cancel(); throw new Error('Android snapshot exceeded the browser size limit'); } chunks.push(value); } } finally { reader.releaseLock(); }
  if (size === 0) throw new Error('Android snapshot returned an empty body');
  const data = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; } return data;
}
async function fetchSnapshot() { const endpoint = snapshotEndpoint(); if (!endpoint) throw new Error('Android snapshot currently requires the Harness Web profile'); const response = await globalThis.fetch(endpoint, { method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { accept: 'image/png' }, signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS) }); if (!response.ok) throw new Error('Android snapshot returned HTTP ' + response.status); if ((response.headers.get('content-type') || '').toLowerCase() !== 'image/png') throw new Error('Android snapshot returned an unexpected content type'); const data = await readSnapshotBytes(response); if (!hasPngSignature(data)) throw new Error('Android snapshot was not a valid PNG'); return Object.freeze({ mediaType: 'image/png', data, bytes: data.byteLength }); }
function createSnapshotObjectUrl(snapshot) { if (!snapshot || snapshot.mediaType !== 'image/png' || !(snapshot.data instanceof Uint8Array)) throw new TypeError('A validated PNG snapshot is required'); const blob = new Blob([snapshot.data], { type: 'image/png' }); const url = URL.createObjectURL(blob); let revoked = false; return Object.freeze({ url, revoke() { if (revoked) return; revoked = true; URL.revokeObjectURL(url); } }); }
const styles = Object.freeze({
  root: { display: 'flex', flex: '1 1 auto', flexDirection: 'column', height: '100%', minHeight: 0, color: 'var(--dsw-alias-label-primary)', fontSize: 'var(--dsh-content-font-size-secondary, 13px)', lineHeight: 1.5 },
  header: { display: 'flex', flex: '0 0 auto', gap: 8, alignItems: 'center', boxSizing: 'border-box', height: 38, padding: '0 8px 0 16px', borderBottom: '0.5px solid var(--dsw-alias-border-l3)' },
  headerStatus: { display: 'flex', flex: '1 1 auto', gap: 8, alignItems: 'center', minWidth: 0 }, headerLabel: { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  body: { display: 'flex', flex: '1 1 auto', flexDirection: 'column', gap: 14, minHeight: 0, padding: '14px 16px 18px', overflow: 'auto', scrollbarGutter: 'stable' },
  card: { display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'var(--dsw-alias-bg-layer-1)', border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 14 }, cardHeader: { display: 'flex', gap: 10, alignItems: 'center' },
  deviceIdentity: { display: 'flex', flex: '1 1 auto', flexDirection: 'column', minWidth: 0 }, deviceName: { overflow: 'hidden', fontSize: 15, lineHeight: 1.4, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, secondary: { overflow: 'hidden', color: 'var(--dsw-alias-label-caption)', fontSize: 12, whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  facts: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px 12px', paddingTop: 2, color: 'var(--dsw-alias-label-secondary)', fontSize: 12 }, factValue: { minWidth: 0, overflow: 'hidden', color: 'var(--dsw-alias-label-primary)', textAlign: 'right', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  preview: { display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain', border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 10, background: 'var(--dsw-alias-bg-layer-2)' },
  empty: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: 1.6 }, note: { margin: 0, padding: '0 2px', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: 1.6 }, warning: { margin: 0, padding: '8px 10px', color: 'var(--dsw-alias-label-secondary)', background: 'var(--dsw-alias-bg-layer-1)', border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 10, fontSize: 12, lineHeight: 1.5 },
});
function safeMessage(error) { if (error instanceof Error && error.message.includes('Web profile')) return error.message; return 'Unable to refresh Android status'; }
function safeSnapshotMessage(error) { if (error instanceof Error && error.message.includes('Web profile')) return error.message; return 'Unable to capture Android screen'; }
function DeviceCard({ overview }) { const device = selectActiveDevice(overview); const state = derivePanelState(overview); if (!device) return h('section', { style: styles.card, 'aria-label': 'Android device' }, h('div', { style: styles.cardHeader }, h(StateDot, { state: state.dot }), h('div', { style: styles.deviceIdentity }, h('span', { style: styles.deviceName }, state.deviceLabel), h('span', { style: styles.secondary }, overview.artemis.state === 'offline' ? 'Start ARTEMIS to discover devices' : 'Waiting for an ARTEMIS Android device')))); return h('section', { style: styles.card, 'aria-label': 'Android device' }, h('div', { style: styles.cardHeader }, h(StateDot, { state: state.dot }), h('div', { style: styles.deviceIdentity }, h('span', { style: styles.deviceName }, device.model || device.serial), h('span', { style: styles.secondary }, device.serial)), h(Pill, null, state.deviceLabel)), h('div', { style: styles.facts }, h('span', null, 'ADB state'), h('span', { style: styles.factValue }, device.state), h('span', null, 'Product'), h('span', { style: styles.factValue }, device.product || '—'), h('span', null, 'Screen stream'), h('span', { style: styles.factValue }, overview.stream.connected ? 'Connected' : 'Idle'))); }
function ScreenPreview({ overview, previewUrl, pending, error, onCapture }) { const device = selectActiveDevice(overview); const canCapture = Boolean(device && overview.stream.connected) && !pending; return h('section', { style: styles.card, 'aria-label': 'Android screen' }, h('div', { style: styles.cardHeader }, h('div', { style: styles.deviceIdentity }, h('span', { style: styles.deviceName }, 'Screen preview'), h('span', { style: styles.secondary }, 'Manual single-frame capture')), h(Button, { variant: 'toolbar', size: 'sm', disabled: !canCapture, onClick: () => { void onCapture(); }, 'aria-label': 'Capture Android screen' }, pending ? 'Capturing…' : 'Capture screen')), previewUrl ? h('img', { src: previewUrl, alt: 'Android screen preview', style: styles.preview }) : h('p', { style: styles.empty }, device && overview.stream.connected ? 'No frame captured yet.' : 'Connect an active ARTEMIS screen stream to capture one frame.'), error ? h('p', { style: styles.warning, role: 'alert' }, error) : null, h('p', { style: styles.note }, 'Captured frames are ephemeral: they are not persisted or added to model context.')); }
function AndroidPanel() {
  const [overview, setOverview] = useState(null); const [pending, setPending] = useState(true); const [error, setError] = useState(null); const [snapshotUrl, setSnapshotUrl] = useState(null); const [snapshotSerial, setSnapshotSerial] = useState(null); const [snapshotPending, setSnapshotPending] = useState(false); const [snapshotError, setSnapshotError] = useState(null); const alive = useRef(true); const inFlight = useRef(false); const snapshotInFlight = useRef(false); const snapshotHandle = useRef(null);
  const refresh = useCallback(async ({ silent = false } = {}) => { if (inFlight.current) return; inFlight.current = true; if (!silent && alive.current) setPending(true); try { const next = await fetchOverview(); if (!alive.current) return; setOverview(next); setError(null); } catch (cause) { if (alive.current) setError(safeMessage(cause)); } finally { inFlight.current = false; if (alive.current) setPending(false); } }, []);
  const capture = useCallback(async () => { if (snapshotInFlight.current || !overview) return; const device = selectActiveDevice(overview); if (!device || !overview.stream.connected) return; snapshotInFlight.current = true; if (alive.current) { setSnapshotPending(true); setSnapshotError(null); } try { const snapshot = await fetchSnapshot(); const handle = createSnapshotObjectUrl(snapshot); if (!alive.current) { handle.revoke(); return; } const previous = snapshotHandle.current; snapshotHandle.current = handle; setSnapshotUrl(handle.url); setSnapshotSerial(device.serial); if (previous) previous.revoke(); } catch (cause) { if (alive.current) setSnapshotError(safeSnapshotMessage(cause)); } finally { snapshotInFlight.current = false; if (alive.current) setSnapshotPending(false); } }, [overview]);
  useEffect(() => { alive.current = true; void refresh(); const timer = globalThis.setInterval(() => { void refresh({ silent: true }); }, POLL_INTERVAL_MS); return () => { alive.current = false; globalThis.clearInterval(timer); const handle = snapshotHandle.current; snapshotHandle.current = null; if (handle) handle.revoke(); }; }, [refresh]);
  const activeDevice = overview ? selectActiveDevice(overview) : null; const activeSerial = activeDevice ? activeDevice.serial : null;
  useEffect(() => { if (!snapshotUrl || snapshotSerial === activeSerial) return; const handle = snapshotHandle.current; snapshotHandle.current = null; if (handle) handle.revoke(); setSnapshotUrl(null); setSnapshotSerial(null); setSnapshotError(null); }, [activeSerial, snapshotSerial, snapshotUrl]);
  const headerState = overview ? derivePanelState(overview) : null; const dot = pending && !overview ? 'ongoing' : error && !overview ? 'error' : (headerState ? headerState.dot : 'idle'); const label = pending && !overview ? 'ARTEMIS Connecting' : error && !overview ? 'ARTEMIS Unavailable' : (headerState ? headerState.artemisLabel : 'ARTEMIS');
  return h('div', { style: styles.root, 'data-dsh-artemis-panel': '' }, h('header', { style: styles.header }, h('div', { style: styles.headerStatus, role: 'status', 'aria-live': 'polite' }, h(StateDot, { state: dot }), h('span', { style: styles.headerLabel }, label)), h(Button, { variant: 'toolbar', size: 'sm', disabled: pending, onClick: () => { void refresh(); }, 'aria-label': 'Refresh Android status' }, pending ? 'Refreshing…' : 'Refresh')), h('div', { style: styles.body }, overview ? h(DeviceCard, { overview }) : h('p', { style: styles.empty }, pending ? 'Checking ARTEMIS and Android device state…' : 'Android status is unavailable.'), overview ? h(ScreenPreview, { overview, previewUrl: snapshotUrl, pending: snapshotPending, error: snapshotError, onCapture: capture }) : null, error ? h('p', { style: styles.warning, role: 'alert' }, overview ? 'Last refresh failed. ' + error + '.' : error + '.') : null, h('p', { style: styles.note }, 'Manual device controls are added only after their upstream contracts are validated.')));
}
const inject = ['slots', 'sidebarRightTabs'];
function apply(ctx) { ctx.effect(() => ctx.sidebarRightTabs.register(androidTabDefinition()), 'dsh-artemis: Android tab type'); ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: ANDROID_TAB_ID }, AndroidPanel)), 'dsh-artemis: Android tab body'); }
module.exports = { ANDROID_TAB_ID, ANDROID_TAB_KIND, androidTabDefinition, inject, apply };
return module.exports; } });
