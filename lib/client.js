window.__ModuleLoader__.load({
	id: "dsh-artemis",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region src/client/bounded-json.mjs
		const DEFAULT_BROWSER_JSON_LIMIT_BYTES = 128 * 1024;
		function responseHeader(response, name) {
			const value = response?.headers?.get?.(name);
			return typeof value === "string" ? value.trim() : "";
		}
		function assertJsonContentType(response, label) {
			if (!responseHeader(response, "content-type").toLowerCase().startsWith("application/json")) throw new Error(`${label} returned an invalid content type`);
		}
		function assertDeclaredLength(response, maxBytes, label) {
			const raw = responseHeader(response, "content-length");
			if (!raw) return;
			if (!/^\d+$/.test(raw)) throw new Error(`${label} returned an invalid content length`);
			const length = Number(raw);
			if (!Number.isSafeInteger(length) || length > maxBytes) throw new Error(`${label} exceeded the response size limit`);
		}
		function parseJsonBytes(bytes, label) {
			let text;
			try {
				text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
			} catch {
				throw new Error(`${label} returned invalid UTF-8`);
			}
			try {
				return JSON.parse(text);
			} catch {
				throw new Error(`${label} returned invalid JSON`);
			}
		}
		async function readBoundedJsonResponse(response, { maxBytes = DEFAULT_BROWSER_JSON_LIMIT_BYTES, label = "JSON response" } = {}) {
			if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new TypeError("maxBytes must be a positive safe integer");
			assertJsonContentType(response, label);
			assertDeclaredLength(response, maxBytes, label);
			const reader = response?.body?.getReader?.();
			if (!reader) throw new Error(`${label} returned a non-streamable response body`);
			const chunks = [];
			let total = 0;
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (!(value instanceof Uint8Array)) throw new Error(`${label} returned an invalid response body`);
					total += value.byteLength;
					if (total > maxBytes) {
						await reader.cancel().catch(() => {});
						throw new Error(`${label} exceeded the response size limit`);
					}
					chunks.push(value);
				}
			} finally {
				reader.releaseLock?.();
			}
			const bytes = new Uint8Array(total);
			let offset = 0;
			for (const chunk of chunks) {
				bytes.set(chunk, offset);
				offset += chunk.byteLength;
			}
			return parseJsonBytes(bytes, label);
		}
		//#endregion
		//#region src/shared/protocol.mjs
		const OVERVIEW_ROUTE = "/dsh-artemis/v1/overview";
		const SNAPSHOT_ROUTE = "/dsh-artemis/v1/snapshot";
		const LIVE_ROUTE = "/dsh-artemis/v1/live";
		const EVIDENCE_ROUTE = "/dsh-artemis/v1/evidence";
		const TRACE_EVIDENCE_ROUTE = "/dsh-artemis/v1/evidence/latest-traces";
		//#endregion
		//#region src/client/evidence-data.mjs
		const REQUEST_TIMEOUT_MS$1 = 4e3;
		const TASK_STATES = new Set([
			"idle",
			"running",
			"paused",
			"unknown"
		]);
		const MAX_TRACE_TREE_NODES = 64;
		const MAX_TRACE_TREE_DEPTH = 6;
		const MAX_TRACE_CHILDREN = 16;
		function expectObject(value, label) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
			return value;
		}
		function nullableString$1(value, maxChars, label) {
			if (value === null) return null;
			if (typeof value !== "string") throw new Error(`${label} must be a string or null`);
			const text = value.trim();
			if (!text || text.length > maxChars) throw new Error(`${label} is invalid`);
			return text;
		}
		function count(value, label) {
			if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
			return value;
		}
		function normalizeTrace(value, index) {
			const trace = expectObject(value, `trace[${index}]`);
			return Object.freeze({
				name: nullableString$1(trace.name, 80, `trace[${index}].name`) ?? "trace",
				type: nullableString$1(trace.type, 40, `trace[${index}].type`),
				status: nullableString$1(trace.status, 40, `trace[${index}].status`)
			});
		}
		function normalizeLatestStep(value) {
			if (value === null) return null;
			const step = expectObject(value, "latestStep");
			const stepNumber = step.stepNumber === null ? null : count(step.stepNumber, "latestStep.stepNumber");
			const action = nullableString$1(step.action, 160, "latestStep.action");
			const traceCount = count(step.traceCount, "latestStep.traceCount");
			if (!Array.isArray(step.traces) || step.traces.length > 8 || step.traces.length > traceCount) throw new Error("latestStep.traces is invalid");
			return Object.freeze({
				stepNumber,
				action,
				traceCount,
				traces: Object.freeze(step.traces.map(normalizeTrace))
			});
		}
		function parseEvidence(value) {
			const input = expectObject(value, "evidence");
			if (input.version !== 1) throw new Error("Unsupported dsh-artemis evidence protocol version");
			const task = expectObject(input.task, "task");
			if (typeof task.status !== "string" || !TASK_STATES.has(task.status)) throw new Error("task.status is invalid");
			const normalizedTask = Object.freeze({
				status: task.status,
				goal: nullableString$1(task.goal, 512, "task.goal"),
				sessionId: nullableString$1(task.sessionId, 128, "task.sessionId"),
				queueCount: count(task.queueCount, "task.queueCount"),
				activeCount: count(task.activeCount, "task.activeCount"),
				backgroundCount: count(task.backgroundCount, "task.backgroundCount")
			});
			return Object.freeze({
				version: input.version,
				task: normalizedTask,
				latestStep: normalizeLatestStep(input.latestStep)
			});
		}
		function normalizeTraceTree(value) {
			if (!Array.isArray(value)) throw new Error("traceTree must be an array");
			let nodeCount = 0;
			function walk(nodes, depth) {
				if (depth > MAX_TRACE_TREE_DEPTH) throw new Error("traceTree exceeds maximum depth");
				if (nodes.length > MAX_TRACE_CHILDREN) throw new Error("traceTree has too many children");
				return Object.freeze(nodes.map((value, index) => {
					nodeCount += 1;
					if (nodeCount > MAX_TRACE_TREE_NODES) throw new Error("traceTree has too many nodes");
					const trace = expectObject(value, `traceTree[${index}]`);
					return Object.freeze({
						name: nullableString$1(trace.name, 80, `traceTree[${index}].name`) ?? "trace",
						type: nullableString$1(trace.type, 40, `traceTree[${index}].type`),
						status: nullableString$1(trace.status, 40, `traceTree[${index}].status`),
						children: walk(trace.children, depth + 1)
					});
				}));
			}
			return {
				traceTree: walk(value, 1),
				nodeCount
			};
		}
		function parseTraceEvidence(value) {
			const input = expectObject(value, "traceEvidence");
			if (input.version !== 1) throw new Error("Unsupported dsh-artemis trace evidence protocol version");
			if (typeof input.truncated !== "boolean") throw new Error("traceEvidence.truncated must be boolean");
			if (input.step === null) return Object.freeze({
				version: input.version,
				step: null,
				truncated: input.truncated
			});
			const step = expectObject(input.step, "traceEvidence.step");
			const stepNumber = step.stepNumber === null ? null : count(step.stepNumber, "traceEvidence.step.stepNumber");
			const action = nullableString$1(step.action, 160, "traceEvidence.step.action");
			const expectedNodeCount = count(step.nodeCount, "traceEvidence.step.nodeCount");
			const normalized = normalizeTraceTree(step.traceTree);
			if (normalized.nodeCount !== expectedNodeCount) throw new Error("traceEvidence.step.nodeCount does not match traceTree");
			return Object.freeze({
				version: input.version,
				step: Object.freeze({
					stepNumber,
					action,
					nodeCount: normalized.nodeCount,
					traceTree: normalized.traceTree
				}),
				truncated: input.truncated
			});
		}
		function endpointFor(route, locationLike = globalThis.location) {
			if (!locationLike || locationLike.protocol !== "http:" && locationLike.protocol !== "https:") return null;
			return new URL(route, locationLike.origin).href;
		}
		function evidenceEndpoint(locationLike = globalThis.location) {
			return endpointFor(EVIDENCE_ROUTE, locationLike);
		}
		function traceEvidenceEndpoint(locationLike = globalThis.location) {
			return endpointFor(TRACE_EVIDENCE_ROUTE, locationLike);
		}
		async function fetchJson(endpoint, errorLabel, parse, { fetchImpl = globalThis.fetch } = {}) {
			if (typeof fetchImpl !== "function") throw new Error("Browser fetch is unavailable");
			const response = await fetchImpl(endpoint, {
				method: "GET",
				credentials: "same-origin",
				cache: "no-store",
				redirect: "error",
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS$1)
			});
			if (!response.ok) throw new Error(`${errorLabel} returned HTTP ${response.status}`);
			return parse(await readBoundedJsonResponse(response, { label: errorLabel }));
		}
		async function fetchEvidence({ fetchImpl = globalThis.fetch, locationLike = globalThis.location } = {}) {
			const endpoint = evidenceEndpoint(locationLike);
			if (!endpoint) throw new Error("ARTEMIS task evidence currently requires the Harness Web profile");
			return fetchJson(endpoint, "ARTEMIS task evidence", parseEvidence, { fetchImpl });
		}
		async function fetchTraceEvidence({ fetchImpl = globalThis.fetch, locationLike = globalThis.location } = {}) {
			const endpoint = traceEvidenceEndpoint(locationLike);
			if (!endpoint) throw new Error("ARTEMIS trace evidence currently requires the Harness Web profile");
			return fetchJson(endpoint, "ARTEMIS trace evidence", parseTraceEvidence, { fetchImpl });
		}
		//#endregion
		//#region src/client/evidence.mjs
		const POLL_INTERVAL_MS$1 = 5e3;
		const styles$2 = Object.freeze({
			root: {
				display: "flex",
				flex: "0 0 auto",
				flexDirection: "column",
				gap: 8,
				maxHeight: "42%",
				padding: "12px 16px 16px",
				overflow: "auto",
				borderTop: "0.5px solid var(--dsw-alias-border-l3)",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-base)"
			},
			header: {
				display: "flex",
				gap: 8,
				alignItems: "center"
			},
			title: {
				flex: "1 1 auto",
				minWidth: 0,
				fontSize: 13
			},
			goal: {
				margin: 0,
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 12,
				lineHeight: 1.5
			},
			facts: {
				display: "grid",
				gridTemplateColumns: "minmax(0, 1fr) auto",
				gap: "4px 10px",
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 11
			},
			value: {
				minWidth: 0,
				overflow: "hidden",
				color: "var(--dsw-alias-label-secondary)",
				textAlign: "right",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis"
			},
			traces: {
				display: "flex",
				flexDirection: "column",
				gap: 4
			},
			trace: {
				display: "flex",
				gap: 8,
				alignItems: "center",
				minWidth: 0,
				fontSize: 11
			},
			traceName: {
				flex: "1 1 auto",
				minWidth: 0,
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis"
			},
			secondary: { color: "var(--dsw-alias-label-tertiary)" },
			traceActions: {
				display: "flex",
				alignItems: "center",
				gap: 8
			},
			traceTree: {
				display: "flex",
				flexDirection: "column",
				gap: 3,
				padding: "8px 0 2px"
			},
			traceTreeRow: {
				display: "flex",
				gap: 8,
				alignItems: "center",
				minWidth: 0,
				fontSize: 11
			},
			warning: {
				margin: 0,
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 11,
				lineHeight: 1.4
			}
		});
		function taskDot(status) {
			if (status === "running") return "ongoing";
			if (status === "paused") return "warning";
			return "idle";
		}
		function taskLabel(status) {
			if (status === "running") return "Running";
			if (status === "paused") return "Paused";
			if (status === "idle") return "Idle";
			return "Unknown";
		}
		function stepKey(step) {
			if (!step) return "none";
			return `${step.stepNumber ?? "recorded"}:${step.action ?? ""}:${step.traceCount}`;
		}
		function renderTraceTree(nodes, depth = 0, prefix = "trace") {
			const rendered = [];
			nodes.forEach((trace, index) => {
				const key = `${prefix}:${index}:${trace.name}`;
				rendered.push((0, react.createElement)("div", {
					key,
					style: {
						...styles$2.traceTreeRow,
						paddingLeft: depth * 12
					}
				}, (0, react.createElement)("span", { style: styles$2.traceName }, trace.name), trace.status ? (0, react.createElement)("span", { style: styles$2.secondary }, trace.status) : null));
				rendered.push(...renderTraceTree(trace.children, depth + 1, key));
			});
			return rendered;
		}
		function TaskEvidenceCard() {
			const [evidence, setEvidence] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [traceDetails, setTraceDetails] = (0, react.useState)(null);
			const [tracePending, setTracePending] = (0, react.useState)(false);
			const [traceError, setTraceError] = (0, react.useState)(null);
			const alive = (0, react.useRef)(true);
			const inFlight = (0, react.useRef)(false);
			const traceInFlight = (0, react.useRef)(false);
			const currentStepKey = (0, react.useRef)("none");
			const refresh = (0, react.useCallback)(async () => {
				if (inFlight.current) return;
				inFlight.current = true;
				try {
					const next = await fetchEvidence();
					if (!alive.current) return;
					const nextKey = stepKey(next.latestStep);
					if (nextKey !== currentStepKey.current) {
						currentStepKey.current = nextKey;
						setTraceDetails(null);
						setTraceError(null);
					}
					setEvidence(next);
					setError(null);
				} catch {
					if (alive.current) setError("Task evidence unavailable");
				} finally {
					inFlight.current = false;
				}
			}, []);
			const inspectTraces = (0, react.useCallback)(async () => {
				if (traceInFlight.current) return;
				traceInFlight.current = true;
				if (alive.current) {
					setTracePending(true);
					setTraceError(null);
				}
				try {
					const next = await fetchTraceEvidence();
					if (!alive.current) return;
					if (next.step && stepKey({
						stepNumber: next.step.stepNumber,
						action: next.step.action,
						traceCount: evidence?.latestStep?.traceCount ?? 0
					}) !== currentStepKey.current) {
						setTraceDetails(null);
						setTraceError("Latest step changed; refresh evidence before inspecting traces");
						return;
					}
					setTraceDetails(next);
				} catch {
					if (alive.current) setTraceError("Trace structure unavailable");
				} finally {
					traceInFlight.current = false;
					if (alive.current) setTracePending(false);
				}
			}, [evidence]);
			(0, react.useEffect)(() => {
				alive.current = true;
				refresh();
				const timer = globalThis.setInterval(() => {
					refresh();
				}, POLL_INTERVAL_MS$1);
				return () => {
					alive.current = false;
					globalThis.clearInterval(timer);
				};
			}, [refresh]);
			if (!evidence) return (0, react.createElement)("section", {
				style: styles$2.root,
				"aria-label": "ARTEMIS task evidence"
			}, (0, react.createElement)("div", { style: styles$2.header }, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: error ? "error" : "ongoing" }), (0, react.createElement)("span", { style: styles$2.title }, "ARTEMIS task evidence")), (0, react.createElement)("p", { style: styles$2.warning }, error ?? "Loading task evidence…"));
			const { task, latestStep } = evidence;
			return (0, react.createElement)("section", {
				style: styles$2.root,
				"aria-label": "ARTEMIS task evidence"
			}, (0, react.createElement)("div", { style: styles$2.header }, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: taskDot(task.status) }), (0, react.createElement)("span", { style: styles$2.title }, "ARTEMIS task"), (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Pill, null, taskLabel(task.status))), task.goal ? (0, react.createElement)("p", { style: styles$2.goal }, task.goal) : (0, react.createElement)("p", { style: styles$2.goal }, "No active task goal."), (0, react.createElement)("div", { style: styles$2.facts }, (0, react.createElement)("span", null, "Active"), (0, react.createElement)("span", { style: styles$2.value }, String(task.activeCount)), (0, react.createElement)("span", null, "Queued"), (0, react.createElement)("span", { style: styles$2.value }, String(task.queueCount)), (0, react.createElement)("span", null, "Background"), (0, react.createElement)("span", { style: styles$2.value }, String(task.backgroundCount)), latestStep ? (0, react.createElement)("span", null, "Latest step") : null, latestStep ? (0, react.createElement)("span", { style: styles$2.value }, latestStep.stepNumber === null ? "Recorded" : `Step ${latestStep.stepNumber}`) : null, latestStep?.action ? (0, react.createElement)("span", null, "Action") : null, latestStep?.action ? (0, react.createElement)("span", { style: styles$2.value }, latestStep.action) : null), latestStep?.traces.length ? (0, react.createElement)("div", {
				style: styles$2.traces,
				"aria-label": "Latest step traces"
			}, ...latestStep.traces.map((trace, index) => (0, react.createElement)("div", {
				key: `${trace.name}:${index}`,
				style: styles$2.trace
			}, (0, react.createElement)("span", { style: styles$2.traceName }, trace.name), trace.status ? (0, react.createElement)("span", { style: styles$2.secondary }, trace.status) : null))) : null, latestStep && latestStep.traceCount > latestStep.traces.length ? (0, react.createElement)("p", { style: styles$2.warning }, `${latestStep.traceCount - latestStep.traces.length} earlier traces omitted from this bounded view.`) : null, latestStep && latestStep.traceCount > 0 ? (0, react.createElement)("div", { style: styles$2.traceActions }, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "toolbar",
				size: "sm",
				disabled: tracePending,
				onClick: () => {
					inspectTraces();
				},
				"aria-label": "Inspect latest traces"
			}, tracePending ? "Inspecting…" : "Inspect traces"), (0, react.createElement)("span", { style: styles$2.secondary }, "Structure only")) : null, traceDetails?.step ? (0, react.createElement)("div", {
				style: styles$2.traceTree,
				role: "region",
				"aria-label": "Latest trace structure"
			}, (0, react.createElement)("span", { style: styles$2.secondary }, `${traceDetails.step.nodeCount} bounded metadata node${traceDetails.step.nodeCount === 1 ? "" : "s"}`), ...renderTraceTree(traceDetails.step.traceTree), traceDetails.truncated ? (0, react.createElement)("p", { style: styles$2.warning }, "Additional trace structure omitted by safety bounds.") : null) : null, traceDetails && !traceDetails.step ? (0, react.createElement)("p", { style: styles$2.warning }, "No latest trace structure is available.") : null, traceError ? (0, react.createElement)("p", {
				style: styles$2.warning,
				role: "alert"
			}, traceError) : null, error ? (0, react.createElement)("p", {
				style: styles$2.warning,
				role: "alert"
			}, `Last evidence refresh failed. ${error}.`) : null);
		}
		const LIVE_RETRY_BASE_MS = 750;
		const LIVE_RETRY_MAX_MS = 3e3;
		function validWebLocation$1(locationLike) {
			return locationLike && (locationLike.protocol === "http:" || locationLike.protocol === "https:");
		}
		function liveEndpoint(locationLike = globalThis.location) {
			if (!validWebLocation$1(locationLike)) return null;
			return new URL(LIVE_ROUTE, locationLike.origin).href;
		}
		function liveRetryDelay(attempt, { baseMs = LIVE_RETRY_BASE_MS, maxMs = LIVE_RETRY_MAX_MS } = {}) {
			if (!Number.isInteger(attempt) || attempt < 1) throw new TypeError("attempt must be a positive integer");
			if (!Number.isInteger(baseMs) || baseMs <= 0) throw new TypeError("baseMs must be a positive integer");
			if (!Number.isInteger(maxMs) || maxMs <= 0) throw new TypeError("maxMs must be a positive integer");
			return Math.min(maxMs, baseMs * 2 ** (attempt - 1));
		}
		Object.freeze({
			maxRetries: 4,
			retryBaseMs: LIVE_RETRY_BASE_MS,
			retryMaxMs: LIVE_RETRY_MAX_MS
		});
		//#endregion
		//#region src/shared/panel-metadata-limits.mjs
		const PANEL_METADATA_LIMITS = Object.freeze({
			maxDevices: 32,
			maxStatusChars: 64,
			maxSerialChars: 256,
			maxStateChars: 64,
			maxModelChars: 256,
			maxProductChars: 256
		});
		//#endregion
		//#region src/client/overview.mjs
		const REQUEST_TIMEOUT_MS = 4e3;
		const ROOT_STATES = new Set([
			"validated",
			"not-supplied",
			"invalid"
		]);
		const PYTHON_STATES = new Set([
			"validated-explicit",
			"profile-managed",
			"unknown",
			"invalid"
		]);
		function record(value, label) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
			return value;
		}
		function nullableString(value, label, maxChars) {
			if (value === null) return null;
			if (typeof value !== "string") throw new Error(`${label} must be a string or null`);
			const trimmed = value.trim();
			if (trimmed.length > maxChars) throw new Error(`${label} exceeds the supported length`);
			return trimmed || null;
		}
		function requiredString(value, label, maxChars) {
			if (typeof value !== "string") throw new Error(`${label} must be a string`);
			const trimmed = value.trim();
			if (!trimmed) throw new Error(`${label} must be non-empty`);
			if (trimmed.length > maxChars) throw new Error(`${label} exceeds the supported length`);
			return trimmed;
		}
		function device(value, index) {
			const input = record(value, `devices[${index}]`);
			const serial = requiredString(input.serial, `devices[${index}].serial`, PANEL_METADATA_LIMITS.maxSerialChars);
			const state = requiredString(input.state, `devices[${index}].state`, PANEL_METADATA_LIMITS.maxStateChars);
			if (typeof input.busy !== "boolean") throw new Error(`devices[${index}].busy must be boolean`);
			return Object.freeze({
				serial,
				state: state.toLowerCase(),
				model: nullableString(input.model, `devices[${index}].model`, PANEL_METADATA_LIMITS.maxModelChars),
				product: nullableString(input.product, `devices[${index}].product`, PANEL_METADATA_LIMITS.maxProductChars),
				busy: input.busy
			});
		}
		function setupStatus(value) {
			const input = record(value, "setup");
			if (!ROOT_STATES.has(input.artemisRoot)) throw new Error("setup.artemisRoot is invalid");
			if (!PYTHON_STATES.has(input.python)) throw new Error("setup.python is invalid");
			if (input.mcpRuntime !== "unobservable") throw new Error("setup.mcpRuntime must be unobservable");
			return Object.freeze({
				artemisRoot: input.artemisRoot,
				python: input.python,
				mcpRuntime: input.mcpRuntime
			});
		}
		function parseOverview(value) {
			const input = record(value, "overview");
			if (input.version !== 1) throw new Error("Unsupported dsh-artemis protocol version");
			const artemis = record(input.artemis, "artemis");
			if (artemis.state !== "ready" && artemis.state !== "offline") throw new Error("artemis.state must be ready or offline");
			const status = nullableString(artemis.status, "artemis.status", PANEL_METADATA_LIMITS.maxStatusChars);
			const setup = setupStatus(input.setup);
			if (!Array.isArray(input.devices)) throw new Error("devices must be an array");
			if (input.devices.length > PANEL_METADATA_LIMITS.maxDevices) throw new Error("devices exceeds the supported count");
			const devices = Object.freeze(input.devices.map(device));
			const activeDeviceSerial = nullableString(input.activeDeviceSerial, "activeDeviceSerial", PANEL_METADATA_LIMITS.maxSerialChars);
			const stream = record(input.stream, "stream");
			if (typeof stream.connected !== "boolean") throw new Error("stream.connected must be boolean");
			return Object.freeze({
				version: input.version,
				artemis: Object.freeze({
					state: artemis.state,
					status
				}),
				setup,
				devices,
				activeDeviceSerial,
				stream: Object.freeze({ connected: stream.connected })
			});
		}
		function selectActiveDevice(overview) {
			if (overview.activeDeviceSerial) {
				const active = overview.devices.find((entry) => entry.serial === overview.activeDeviceSerial);
				if (active) return active;
			}
			return overview.devices[0] ?? null;
		}
		function derivePanelState(overview) {
			if (overview.artemis.state === "offline") return Object.freeze({
				dot: "idle",
				artemisLabel: "ARTEMIS Offline",
				deviceLabel: "No device"
			});
			const active = selectActiveDevice(overview);
			if (!active) return Object.freeze({
				dot: "warning",
				artemisLabel: "ARTEMIS Ready",
				deviceLabel: "No Android device"
			});
			if (active.busy) return Object.freeze({
				dot: "ongoing",
				artemisLabel: "ARTEMIS Ready",
				deviceLabel: "Busy"
			});
			return Object.freeze({
				dot: "done",
				artemisLabel: "ARTEMIS Ready",
				deviceLabel: "Ready"
			});
		}
		function overviewEndpoint(locationLike = globalThis.location) {
			if (!locationLike || locationLike.protocol !== "http:" && locationLike.protocol !== "https:") return null;
			return new URL(OVERVIEW_ROUTE, locationLike.origin).href;
		}
		async function fetchOverview({ fetchImpl = globalThis.fetch, locationLike = globalThis.location } = {}) {
			if (typeof fetchImpl !== "function") throw new Error("Browser fetch is unavailable");
			const endpoint = overviewEndpoint(locationLike);
			if (!endpoint) throw new Error("The Android panel currently requires the Harness Web profile");
			const response = await fetchImpl(endpoint, {
				method: "GET",
				credentials: "same-origin",
				cache: "no-store",
				redirect: "error",
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
			if (!response.ok) throw new Error(`dsh-artemis overview returned HTTP ${response.status}`);
			return parseOverview(await readBoundedJsonResponse(response, { label: "dsh-artemis overview" }));
		}
		//#endregion
		//#region src/client/snapshot.mjs
		const SNAPSHOT_TIMEOUT_MS = 6e3;
		const MAX_SNAPSHOT_BYTES = 8388608;
		const PNG_SIGNATURE = Uint8Array.from([
			137,
			80,
			78,
			71,
			13,
			10,
			26,
			10
		]);
		function validWebLocation(locationLike) {
			return locationLike && (locationLike.protocol === "http:" || locationLike.protocol === "https:");
		}
		function snapshotEndpoint(locationLike = globalThis.location) {
			if (!validWebLocation(locationLike)) return null;
			return new URL(SNAPSHOT_ROUTE, locationLike.origin).href;
		}
		function hasPngSignature(bytes) {
			return bytes.byteLength >= PNG_SIGNATURE.byteLength && PNG_SIGNATURE.every((value, index) => bytes[index] === value);
		}
		async function readResponseBytes(response, maxBytes) {
			const declaredText = response.headers.get("content-length");
			if (declaredText !== null) {
				if (!/^\d+$/.test(declaredText)) throw new Error("Android snapshot returned an invalid Content-Length");
				const declared = Number(declaredText);
				if (!Number.isSafeInteger(declared) || declared <= 0) throw new Error("Android snapshot returned an invalid Content-Length");
				if (declared > maxBytes) throw new Error("Android snapshot exceeded the browser size limit");
			}
			if (!response.body) throw new Error("Android snapshot returned an empty body");
			const reader = response.body.getReader();
			const chunks = [];
			let size = 0;
			try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					size += value.byteLength;
					if (size > maxBytes) {
						await reader.cancel();
						throw new Error("Android snapshot exceeded the browser size limit");
					}
					chunks.push(value);
				}
			} finally {
				reader.releaseLock();
			}
			if (size === 0) throw new Error("Android snapshot returned an empty body");
			const data = new Uint8Array(size);
			let offset = 0;
			for (const chunk of chunks) {
				data.set(chunk, offset);
				offset += chunk.byteLength;
			}
			return data;
		}
		async function fetchSnapshot({ fetchImpl = globalThis.fetch, locationLike = globalThis.location, timeoutMs = SNAPSHOT_TIMEOUT_MS, maxBytes = MAX_SNAPSHOT_BYTES } = {}) {
			if (typeof fetchImpl !== "function") throw new Error("Browser fetch is unavailable");
			if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError("timeoutMs must be a positive integer");
			if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new TypeError("maxBytes must be a positive integer");
			const endpoint = snapshotEndpoint(locationLike);
			if (!endpoint) throw new Error("Android snapshot currently requires the Harness Web profile");
			const response = await fetchImpl(endpoint, {
				method: "GET",
				credentials: "same-origin",
				cache: "no-store",
				redirect: "error",
				headers: { accept: "image/png" },
				signal: AbortSignal.timeout(timeoutMs)
			});
			if (!response.ok) throw new Error(`Android snapshot returned HTTP ${response.status}`);
			if ((response.headers.get("content-type") ?? "").toLowerCase() !== "image/png") throw new Error("Android snapshot returned an unexpected content type");
			const data = await readResponseBytes(response, maxBytes);
			if (!hasPngSignature(data)) throw new Error("Android snapshot was not a valid PNG");
			return Object.freeze({
				mediaType: "image/png",
				data,
				bytes: data.byteLength
			});
		}
		function createSnapshotObjectUrl(snapshot, { BlobImpl = globalThis.Blob, URLImpl = globalThis.URL } = {}) {
			if (!snapshot || snapshot.mediaType !== "image/png" || !(snapshot.data instanceof Uint8Array)) throw new TypeError("A validated PNG snapshot is required");
			if (typeof BlobImpl !== "function" || !URLImpl || typeof URLImpl.createObjectURL !== "function" || typeof URLImpl.revokeObjectURL !== "function") throw new Error("Browser object URLs are unavailable");
			const blob = new BlobImpl([snapshot.data], { type: "image/png" });
			const url = URLImpl.createObjectURL(blob);
			let revoked = false;
			return Object.freeze({
				url,
				revoke() {
					if (revoked) return;
					revoked = true;
					URLImpl.revokeObjectURL(url);
				}
			});
		}
		Object.freeze({
			timeoutMs: SNAPSHOT_TIMEOUT_MS,
			maxBytes: MAX_SNAPSHOT_BYTES
		});
		//#endregion
		//#region src/client/panel.mjs
		const POLL_INTERVAL_MS = 5e3;
		const styles$1 = Object.freeze({
			root: {
				display: "flex",
				flex: "1 1 auto",
				flexDirection: "column",
				height: "100%",
				minHeight: 0,
				color: "var(--dsw-alias-label-primary)",
				fontSize: "var(--dsh-content-font-size-secondary, 13px)",
				lineHeight: 1.5
			},
			header: {
				display: "flex",
				flex: "0 0 auto",
				gap: 8,
				alignItems: "center",
				boxSizing: "border-box",
				height: 38,
				padding: "0 8px 0 16px",
				borderBottom: "0.5px solid var(--dsw-alias-border-l3)"
			},
			headerStatus: {
				display: "flex",
				flex: "1 1 auto",
				gap: 8,
				alignItems: "center",
				minWidth: 0
			},
			headerLabel: {
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis"
			},
			body: {
				display: "flex",
				flex: "1 1 auto",
				flexDirection: "column",
				gap: 14,
				minHeight: 0,
				padding: "14px 16px 18px",
				overflow: "auto",
				scrollbarGutter: "stable"
			},
			card: {
				display: "flex",
				flexDirection: "column",
				gap: 10,
				padding: 14,
				background: "var(--dsw-alias-bg-layer-1)",
				border: "0.5px solid var(--dsw-alias-border-l4)",
				borderRadius: 14
			},
			cardHeader: {
				display: "flex",
				gap: 10,
				alignItems: "center"
			},
			cardActions: {
				display: "flex",
				gap: 6,
				alignItems: "center"
			},
			deviceIdentity: {
				display: "flex",
				flex: "1 1 auto",
				flexDirection: "column",
				minWidth: 0
			},
			deviceName: {
				overflow: "hidden",
				fontSize: 15,
				lineHeight: 1.4,
				whiteSpace: "nowrap",
				textOverflow: "ellipsis"
			},
			secondary: {
				overflow: "hidden",
				color: "var(--dsw-alias-label-caption)",
				fontSize: 12,
				whiteSpace: "nowrap",
				textOverflow: "ellipsis"
			},
			facts: {
				display: "grid",
				gridTemplateColumns: "minmax(0, 1fr) auto",
				gap: "6px 12px",
				paddingTop: 2,
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 12
			},
			factValue: {
				minWidth: 0,
				overflow: "hidden",
				color: "var(--dsw-alias-label-primary)",
				textAlign: "right",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis"
			},
			preview: {
				display: "block",
				width: "100%",
				maxHeight: 360,
				objectFit: "contain",
				border: "0.5px solid var(--dsw-alias-border-l4)",
				borderRadius: 10,
				background: "var(--dsw-alias-bg-layer-2)"
			},
			empty: {
				margin: 0,
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 12,
				lineHeight: 1.6
			},
			note: {
				margin: 0,
				padding: "0 2px",
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 12,
				lineHeight: 1.6
			},
			warning: {
				margin: 0,
				padding: "8px 10px",
				color: "var(--dsw-alias-label-secondary)",
				background: "var(--dsw-alias-bg-layer-1)",
				border: "0.5px solid var(--dsw-alias-border-l4)",
				borderRadius: 10,
				fontSize: 12,
				lineHeight: 1.5
			}
		});
		function safeMessage(error) {
			if (error instanceof Error && error.message.includes("Web profile")) return error.message;
			return "Unable to refresh Android status";
		}
		function safeSnapshotMessage(error) {
			if (error instanceof Error && error.message.includes("Web profile")) return error.message;
			return "Unable to capture Android screen";
		}
		function setupRootLabel(setup) {
			if (setup.artemisRoot === "validated") return "Validated";
			if (setup.artemisRoot === "invalid") return "Invalid";
			return "Profile-managed";
		}
		function setupPythonLabel(setup) {
			if (setup.python === "validated-explicit") return "Explicit interpreter validated";
			if (setup.python === "invalid") return "Invalid explicit interpreter";
			if (setup.python === "unknown") return "Unknown";
			return "Resolved by MCP profile";
		}
		function SetupStatusCard({ overview }) {
			const rootState = overview.setup.artemisRoot === "invalid" || overview.setup.python === "invalid" ? "warning" : "done";
			return (0, react.createElement)("section", {
				style: styles$1.card,
				"aria-label": "ARTEMIS integration status"
			}, (0, react.createElement)("div", { style: styles$1.cardHeader }, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: rootState }), (0, react.createElement)("div", { style: styles$1.deviceIdentity }, (0, react.createElement)("span", { style: styles$1.deviceName }, "Integration status"), (0, react.createElement)("span", { style: styles$1.secondary }, "Human UI and agent MCP are independent"))), (0, react.createElement)("div", { style: styles$1.facts }, (0, react.createElement)("span", null, "Human UI daemon"), (0, react.createElement)("span", { style: styles$1.factValue }, overview.artemis.state === "ready" ? "Ready" : "Offline"), (0, react.createElement)("span", null, "ARTEMIS root"), (0, react.createElement)("span", { style: styles$1.factValue }, setupRootLabel(overview.setup)), (0, react.createElement)("span", null, "Python setup"), (0, react.createElement)("span", { style: styles$1.factValue }, setupPythonLabel(overview.setup)), (0, react.createElement)("span", null, "Agent MCP runtime"), (0, react.createElement)("span", { style: styles$1.factValue }, "Not observable")), (0, react.createElement)("p", { style: styles$1.note }, "The pinned Harness public MCP API does not expose connection state. dsh-artemis never infers MCP Connected from daemon health; configure the agent MCP in the Harness profile."));
		}
		function DeviceCard({ overview }) {
			const device = selectActiveDevice(overview);
			const state = derivePanelState(overview);
			if (!device) return (0, react.createElement)("section", {
				style: styles$1.card,
				"aria-label": "Android device"
			}, (0, react.createElement)("div", { style: styles$1.cardHeader }, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: state.dot }), (0, react.createElement)("div", { style: styles$1.deviceIdentity }, (0, react.createElement)("span", { style: styles$1.deviceName }, state.deviceLabel), (0, react.createElement)("span", { style: styles$1.secondary }, overview.artemis.state === "offline" ? "Start ARTEMIS to discover devices" : "Waiting for an ARTEMIS Android device"))));
			return (0, react.createElement)("section", {
				style: styles$1.card,
				"aria-label": "Android device"
			}, (0, react.createElement)("div", { style: styles$1.cardHeader }, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: state.dot }), (0, react.createElement)("div", { style: styles$1.deviceIdentity }, (0, react.createElement)("span", { style: styles$1.deviceName }, device.model ?? device.serial), (0, react.createElement)("span", { style: styles$1.secondary }, device.serial)), (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Pill, null, state.deviceLabel)), (0, react.createElement)("div", { style: styles$1.facts }, (0, react.createElement)("span", null, "ADB state"), (0, react.createElement)("span", { style: styles$1.factValue }, device.state), (0, react.createElement)("span", null, "Product"), (0, react.createElement)("span", { style: styles$1.factValue }, device.product ?? "—"), (0, react.createElement)("span", null, "Screen stream"), (0, react.createElement)("span", { style: styles$1.factValue }, overview.stream.connected ? "Connected" : "Idle")));
		}
		function ScreenPreview({ overview, previewUrl, snapshotPending, snapshotError, onCapture, liveActive, liveUrl, liveNonce, liveError, onStartLive, onStopLive, onLiveLoad, onLiveError }) {
			const device = selectActiveDevice(overview);
			const streamReady = Boolean(device && overview.stream.connected);
			const canCapture = streamReady && !snapshotPending && !liveActive;
			const canStartLive = streamReady && !liveActive;
			return (0, react.createElement)("section", {
				style: styles$1.card,
				"aria-label": "Android screen"
			}, (0, react.createElement)("div", { style: styles$1.cardHeader }, (0, react.createElement)("div", { style: styles$1.deviceIdentity }, (0, react.createElement)("span", { style: styles$1.deviceName }, "Screen preview"), (0, react.createElement)("span", { style: styles$1.secondary }, liveActive ? "Live human viewer" : "Manual single-frame capture")), (0, react.createElement)("div", { style: styles$1.cardActions }, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "toolbar",
				size: "sm",
				disabled: !canCapture,
				onClick: () => {
					onCapture();
				},
				"aria-label": "Capture Android screen"
			}, snapshotPending ? "Capturing…" : "Capture screen"), liveActive ? (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "toolbar",
				size: "sm",
				onClick: onStopLive,
				"aria-label": "Stop Android live screen"
			}, "Stop live") : (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "toolbar",
				size: "sm",
				disabled: !canStartLive,
				onClick: onStartLive,
				"aria-label": "Start Android live screen"
			}, "Start live"))), liveActive && liveUrl ? (0, react.createElement)("img", {
				key: liveNonce,
				src: liveUrl,
				alt: "Android live screen",
				style: styles$1.preview,
				onLoad: onLiveLoad,
				onError: onLiveError
			}) : previewUrl ? (0, react.createElement)("img", {
				src: previewUrl,
				alt: "Android screen preview",
				style: styles$1.preview
			}) : (0, react.createElement)("p", { style: styles$1.empty }, streamReady ? "No frame captured yet." : "Connect an active ARTEMIS screen stream to inspect the screen."), snapshotError ? (0, react.createElement)("p", {
				style: styles$1.warning,
				role: "alert"
			}, snapshotError) : null, liveError ? (0, react.createElement)("p", {
				style: styles$1.warning,
				role: "alert"
			}, liveError) : null, (0, react.createElement)("p", { style: styles$1.note }, liveActive ? "Live frames are human-facing and ephemeral: they are not persisted or added to model context." : "Captured frames are ephemeral: they are not persisted or added to model context."));
		}
		function AndroidPanel() {
			const [overview, setOverview] = (0, react.useState)(null);
			const [pending, setPending] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [snapshotUrl, setSnapshotUrl] = (0, react.useState)(null);
			const [snapshotSerial, setSnapshotSerial] = (0, react.useState)(null);
			const [snapshotPending, setSnapshotPending] = (0, react.useState)(false);
			const [snapshotError, setSnapshotError] = (0, react.useState)(null);
			const [liveActive, setLiveActive] = (0, react.useState)(false);
			const [liveNonce, setLiveNonce] = (0, react.useState)(0);
			const [liveError, setLiveError] = (0, react.useState)(null);
			const alive = (0, react.useRef)(true);
			const inFlight = (0, react.useRef)(false);
			const snapshotInFlight = (0, react.useRef)(false);
			const snapshotHandle = (0, react.useRef)(null);
			const liveRetryCount = (0, react.useRef)(0);
			const liveRetryTimer = (0, react.useRef)(null);
			const clearLiveRetry = (0, react.useCallback)(() => {
				if (liveRetryTimer.current !== null) {
					globalThis.clearTimeout(liveRetryTimer.current);
					liveRetryTimer.current = null;
				}
			}, []);
			const stopLive = (0, react.useCallback)(() => {
				clearLiveRetry();
				liveRetryCount.current = 0;
				setLiveActive(false);
				setLiveError(null);
			}, [clearLiveRetry]);
			const startLive = (0, react.useCallback)(() => {
				if (!overview) return;
				const device = selectActiveDevice(overview);
				const endpoint = liveEndpoint();
				if (!device || !overview.stream.connected || !endpoint) return;
				clearLiveRetry();
				liveRetryCount.current = 0;
				setLiveError(null);
				setLiveNonce((value) => value + 1);
				setLiveActive(true);
			}, [clearLiveRetry, overview]);
			const handleLiveLoad = (0, react.useCallback)(() => {
				clearLiveRetry();
				liveRetryCount.current = 0;
				setLiveError(null);
			}, [clearLiveRetry]);
			const handleLiveError = (0, react.useCallback)(() => {
				clearLiveRetry();
				const nextAttempt = liveRetryCount.current + 1;
				if (nextAttempt > 4) {
					liveRetryCount.current = 0;
					setLiveActive(false);
					setLiveError("Android live screen disconnected after bounded retries");
					return;
				}
				liveRetryCount.current = nextAttempt;
				setLiveError(`Android live screen reconnecting (${nextAttempt}/4)`);
				liveRetryTimer.current = globalThis.setTimeout(() => {
					liveRetryTimer.current = null;
					if (alive.current) setLiveNonce((value) => value + 1);
				}, liveRetryDelay(nextAttempt));
			}, [clearLiveRetry]);
			const refresh = (0, react.useCallback)(async ({ silent = false } = {}) => {
				if (inFlight.current) return;
				inFlight.current = true;
				if (!silent && alive.current) setPending(true);
				try {
					const next = await fetchOverview();
					if (!alive.current) return;
					setOverview(next);
					setError(null);
				} catch (cause) {
					if (alive.current) setError(safeMessage(cause));
				} finally {
					inFlight.current = false;
					if (alive.current) setPending(false);
				}
			}, []);
			const capture = (0, react.useCallback)(async () => {
				if (snapshotInFlight.current || !overview || liveActive) return;
				const device = selectActiveDevice(overview);
				if (!device || !overview.stream.connected) return;
				snapshotInFlight.current = true;
				if (alive.current) {
					setSnapshotPending(true);
					setSnapshotError(null);
				}
				try {
					const handle = createSnapshotObjectUrl(await fetchSnapshot());
					if (!alive.current) {
						handle.revoke();
						return;
					}
					const previous = snapshotHandle.current;
					snapshotHandle.current = handle;
					setSnapshotUrl(handle.url);
					setSnapshotSerial(device.serial);
					previous?.revoke();
				} catch (cause) {
					if (alive.current) setSnapshotError(safeSnapshotMessage(cause));
				} finally {
					snapshotInFlight.current = false;
					if (alive.current) setSnapshotPending(false);
				}
			}, [liveActive, overview]);
			(0, react.useEffect)(() => {
				alive.current = true;
				refresh();
				const timer = globalThis.setInterval(() => {
					refresh({ silent: true });
				}, POLL_INTERVAL_MS);
				return () => {
					alive.current = false;
					globalThis.clearInterval(timer);
					clearLiveRetry();
					const handle = snapshotHandle.current;
					snapshotHandle.current = null;
					handle?.revoke();
				};
			}, [clearLiveRetry, refresh]);
			const activeSerial = (overview ? selectActiveDevice(overview) : null)?.serial ?? null;
			const streamConnected = Boolean(overview?.stream.connected);
			(0, react.useEffect)(() => {
				if (!snapshotUrl || snapshotSerial === activeSerial) return;
				const handle = snapshotHandle.current;
				snapshotHandle.current = null;
				handle?.revoke();
				setSnapshotUrl(null);
				setSnapshotSerial(null);
				setSnapshotError(null);
			}, [
				activeSerial,
				snapshotSerial,
				snapshotUrl
			]);
			(0, react.useEffect)(() => {
				if (!liveActive) return;
				if (!activeSerial || !streamConnected) stopLive();
			}, [
				activeSerial,
				liveActive,
				stopLive,
				streamConnected
			]);
			const liveUrl = liveActive ? liveEndpoint() : null;
			const headerState = overview ? derivePanelState(overview) : null;
			const dot = pending && !overview ? "ongoing" : error && !overview ? "error" : headerState?.dot ?? "idle";
			const label = pending && !overview ? "ARTEMIS Connecting" : error && !overview ? "ARTEMIS Unavailable" : headerState?.artemisLabel ?? "ARTEMIS";
			return (0, react.createElement)("div", {
				style: styles$1.root,
				"data-dsh-artemis-panel": ""
			}, (0, react.createElement)("header", { style: styles$1.header }, (0, react.createElement)("div", {
				style: styles$1.headerStatus,
				role: "status",
				"aria-live": "polite"
			}, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dot }), (0, react.createElement)("span", { style: styles$1.headerLabel }, label)), (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "toolbar",
				size: "sm",
				disabled: pending,
				onClick: () => {
					refresh();
				},
				"aria-label": "Refresh Android status"
			}, pending ? "Refreshing…" : "Refresh")), (0, react.createElement)("div", { style: styles$1.body }, overview ? (0, react.createElement)(SetupStatusCard, { overview }) : null, overview ? (0, react.createElement)(DeviceCard, { overview }) : (0, react.createElement)("p", { style: styles$1.empty }, pending ? "Checking ARTEMIS and Android device state…" : "Android status is unavailable."), overview ? (0, react.createElement)(ScreenPreview, {
				overview,
				previewUrl: snapshotUrl,
				snapshotPending,
				snapshotError,
				onCapture: capture,
				liveActive,
				liveUrl,
				liveNonce,
				liveError,
				onStartLive: startLive,
				onStopLive: stopLive,
				onLiveLoad: handleLiveLoad,
				onLiveError: handleLiveError
			}) : null, error ? (0, react.createElement)("p", {
				style: styles$1.warning,
				role: "alert"
			}, overview ? `Last refresh failed. ${error}.` : `${error}.`) : null, (0, react.createElement)("p", { style: styles$1.note }, "Manual device controls are added only after their upstream contracts are validated.")));
		}
		//#endregion
		//#region src/client/definition.mjs
		const ANDROID_TAB_ID = "dsh-artemis:android";
		const ANDROID_TAB_KIND = "android";
		function androidTabDefinition() {
			return {
				id: ANDROID_TAB_ID,
				kind: ANDROID_TAB_KIND,
				priority: "extension",
				title: () => "Android",
				guide: [{
					order: 40,
					title: () => "Android",
					description: () => "Inspect ARTEMIS and the active Android device"
				}]
			};
		}
		//#endregion
		//#region src/client/register.mjs
		const inject = ["slots", "sidebarRightTabs"];
		function registerAndroidClient(ctx, AndroidPanel) {
			if (typeof AndroidPanel !== "function") throw new TypeError("AndroidPanel must be a component");
			ctx.effect(() => ctx.sidebarRightTabs.register(androidTabDefinition()), "dsh-artemis: Android tab type");
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: ANDROID_TAB_ID
			}, AndroidPanel)), "dsh-artemis: Android tab body");
		}
		//#endregion
		//#region src/client/visual-qa-data.mjs
		function finiteTimestamp(nowImpl) {
			const value = nowImpl();
			if (!Number.isFinite(value) || value < 0) throw new Error("Checkpoint clock returned an invalid timestamp");
			return new Date(value).toISOString();
		}
		function summarizeCheckpointEvidence(evidence) {
			if (!evidence || typeof evidence !== "object" || !evidence.task) throw new TypeError("Validated ARTEMIS evidence is required");
			const task = evidence.task;
			const latestStep = evidence.latestStep;
			return Object.freeze({
				task: Object.freeze({
					status: task.status,
					goal: task.goal,
					queueCount: task.queueCount,
					activeCount: task.activeCount,
					backgroundCount: task.backgroundCount
				}),
				latestStep: latestStep ? Object.freeze({
					stepNumber: latestStep.stepNumber,
					action: latestStep.action,
					traceCount: latestStep.traceCount
				}) : null
			});
		}
		async function captureVisualCheckpoint({ fetchEvidenceImpl = fetchEvidence, fetchSnapshotImpl = fetchSnapshot, createObjectUrlImpl = createSnapshotObjectUrl, nowImpl = Date.now } = {}) {
			if (typeof fetchEvidenceImpl !== "function" || typeof fetchSnapshotImpl !== "function" || typeof createObjectUrlImpl !== "function" || typeof nowImpl !== "function") throw new TypeError("Visual checkpoint dependencies must be functions");
			const [evidence, snapshot] = await Promise.all([fetchEvidenceImpl(), fetchSnapshotImpl()]);
			const summary = summarizeCheckpointEvidence(evidence);
			const image = createObjectUrlImpl(snapshot);
			try {
				const capturedAt = finiteTimestamp(nowImpl);
				return Object.freeze({
					imageUrl: image.url,
					capturedAt,
					task: summary.task,
					latestStep: summary.latestStep,
					revoke: image.revoke
				});
			} catch (error) {
				image.revoke();
				throw error;
			}
		}
		//#endregion
		//#region src/client/visual-qa.mjs
		const styles = Object.freeze({
			root: {
				display: "flex",
				flex: "0 0 auto",
				flexDirection: "column",
				gap: 8,
				padding: "12px 16px 16px",
				borderTop: "0.5px solid var(--dsw-alias-border-l3)",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-base)"
			},
			header: {
				display: "flex",
				gap: 8,
				alignItems: "center"
			},
			title: {
				flex: "1 1 auto",
				minWidth: 0,
				fontSize: 13
			},
			image: {
				display: "block",
				width: "100%",
				maxHeight: 260,
				objectFit: "contain",
				border: "0.5px solid var(--dsw-alias-border-l4)",
				borderRadius: 10,
				background: "var(--dsw-alias-bg-layer-2)"
			},
			facts: {
				display: "grid",
				gridTemplateColumns: "minmax(0, 1fr) auto",
				gap: "4px 10px",
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 11
			},
			value: {
				minWidth: 0,
				overflow: "hidden",
				color: "var(--dsw-alias-label-secondary)",
				textAlign: "right",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis"
			},
			note: {
				margin: 0,
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 11,
				lineHeight: 1.45
			},
			warning: {
				margin: 0,
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 11,
				lineHeight: 1.45
			}
		});
		function checkpointLabel(checkpoint) {
			if (!checkpoint) return "No checkpoint captured.";
			return checkpoint.latestStep?.stepNumber === null || checkpoint.latestStep?.stepNumber === void 0 ? "Recorded state" : `Step ${checkpoint.latestStep.stepNumber}`;
		}
		function VisualQACheckpointCard() {
			const [checkpoint, setCheckpoint] = (0, react.useState)(null);
			const [pending, setPending] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const alive = (0, react.useRef)(true);
			const inFlight = (0, react.useRef)(false);
			const handle = (0, react.useRef)(null);
			const capture = (0, react.useCallback)(async () => {
				if (inFlight.current) return;
				inFlight.current = true;
				if (alive.current) {
					setPending(true);
					setError(null);
				}
				try {
					const next = await captureVisualCheckpoint();
					if (!alive.current) {
						next.revoke();
						return;
					}
					const previous = handle.current;
					handle.current = next;
					setCheckpoint(next);
					previous?.revoke();
				} catch {
					if (alive.current) setError("Visual QA checkpoint unavailable");
				} finally {
					inFlight.current = false;
					if (alive.current) setPending(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				alive.current = true;
				return () => {
					alive.current = false;
					const current = handle.current;
					handle.current = null;
					current?.revoke();
				};
			}, []);
			return (0, react.createElement)("section", {
				style: styles.root,
				"aria-label": "ARTEMIS visual QA checkpoint"
			}, (0, react.createElement)("div", { style: styles.header }, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: checkpoint ? "success" : error ? "error" : "idle" }), (0, react.createElement)("span", { style: styles.title }, "Visual QA checkpoint"), checkpoint ? (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Pill, null, checkpointLabel(checkpoint)) : null, (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "toolbar",
				size: "sm",
				disabled: pending,
				onClick: () => {
					capture();
				},
				"aria-label": "Capture visual QA checkpoint"
			}, pending ? "Capturing…" : checkpoint ? "Replace checkpoint" : "Capture checkpoint")), checkpoint ? (0, react.createElement)("img", {
				src: checkpoint.imageUrl,
				alt: "Android visual QA checkpoint",
				style: styles.image
			}) : (0, react.createElement)("p", { style: styles.note }, "Capture one explicit, ephemeral screenshot together with bounded task metadata."), checkpoint ? (0, react.createElement)("div", { style: styles.facts }, (0, react.createElement)("span", null, "Task"), (0, react.createElement)("span", { style: styles.value }, checkpoint.task.status), checkpoint.task.goal ? (0, react.createElement)("span", null, "Goal") : null, checkpoint.task.goal ? (0, react.createElement)("span", { style: styles.value }, checkpoint.task.goal) : null, (0, react.createElement)("span", null, "Checkpoint"), (0, react.createElement)("span", { style: styles.value }, checkpointLabel(checkpoint)), checkpoint.latestStep?.action ? (0, react.createElement)("span", null, "Action") : null, checkpoint.latestStep?.action ? (0, react.createElement)("span", { style: styles.value }, checkpoint.latestStep.action) : null, (0, react.createElement)("span", null, "Captured"), (0, react.createElement)("time", {
				style: styles.value,
				dateTime: checkpoint.capturedAt
			}, checkpoint.capturedAt)) : null, error ? (0, react.createElement)("p", {
				style: styles.warning,
				role: "alert"
			}, error) : null, (0, react.createElement)("p", { style: styles.note }, "Ephemeral browser memory only. Not uploaded, archived, replayed, or added to model context."));
		}
		//#endregion
		//#region src/client/index.mjs
		const shellStyles = Object.freeze({
			root: {
				display: "flex",
				flexDirection: "column",
				height: "100%",
				minHeight: 0
			},
			panel: {
				flex: "1 1 auto",
				minHeight: 0
			}
		});
		function IntegratedAndroidPanel() {
			return (0, react.createElement)("div", {
				style: shellStyles.root,
				"data-dsh-artemis-integrated-panel": ""
			}, (0, react.createElement)("div", { style: shellStyles.panel }, (0, react.createElement)(AndroidPanel)), (0, react.createElement)(TaskEvidenceCard), (0, react.createElement)(VisualQACheckpointCard));
		}
		function apply(ctx) {
			registerAndroidClient(ctx, IntegratedAndroidPanel);
		}
		//#endregion
		exports.ANDROID_TAB_ID = ANDROID_TAB_ID;
		exports.ANDROID_TAB_KIND = ANDROID_TAB_KIND;
		exports.androidTabDefinition = androidTabDefinition;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
