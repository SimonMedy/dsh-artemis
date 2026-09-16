import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const roadmapPath = 'docs/roadmap.md'
let roadmap = readFileSync(roadmapPath, 'utf8')
roadmap = replaceOnce(
  roadmap,
  '| 5 — installation & agent experience | **PARTIAL** | MCP config/rules/setup UX and reversible plugin lifecycle are merged; Harness ACP now accepts session-scoped `mcpServers`, while automatic Web/Cordis profile mutation and direct ARTEMIS vision handoff remain gated |',
  '| 5 — installation & agent experience | **PARTIAL** | MCP config/rules/setup UX and reversible plugin lifecycle are merged; ACP/headless session-scoped ARTEMIS MCP config generation is delivered through PR #121 with real foreign-cwd launch evidence, while automatic Web/Cordis profile mutation and direct ARTEMIS vision handoff remain gated |',
  'phase 5 status row',
)
const deliveredMarker = '- [x] PR #48: root identity markers must also be non-symlink files, preventing `rules.md`/`__main__.py`/`pyproject.toml` redirection outside the configured checkout; Python symlinks remain supported intentionally.'
const deliveredAddition = deliveredMarker + '\n- [x] PR #121: `dsh-artemis-mcp-config --format acp-json` emits a validated session-scoped `{ "mcpServers": [...] }` fragment for Harness ACP/headless clients while keeping Cordis as the default; the real pinned ARTEMIS runtime launches successfully from a foreign Session cwd using the generated absolute Python command and bounded `PYTHONPATH` contract.'
roadmap = replaceOnce(roadmap, deliveredMarker, deliveredAddition, 'phase 5 delivered marker')
roadmap = replaceOnce(
  roadmap,
  '- [ ] Harness ACP `session/new` / `session/resume` now accept session-scoped `mcpServers`, but the Web/Cordis plugin still lacks a proven public reversible seam for patching the active profile with a sibling MCP row. Keep Web profile installation explicit/non-destructive.',
  '- [ ] ACP/headless session-scoped ARTEMIS MCP configuration is now delivered through PR #121. The Web/Cordis plugin still lacks a proven public reversible seam for patching the active profile with a sibling MCP row, so Web profile installation stays explicit/non-destructive.',
  'phase 5 remaining profile gate',
)
roadmap = replaceOnce(
  roadmap,
  'Phase 5 truthful bounded setup/status + reversible plugin lifecycle proven; profile mutation and model image handoff remain upstream-gated',
  'Phase 5 truthful bounded setup/status + reversible plugin lifecycle + ACP session-scoped MCP config proven; Web profile mutation and model image handoff remain upstream-gated',
  'critical path phase 5 line',
)
writeFileSync(roadmapPath, roadmap)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
const proofMarker = '- DeepSeek Harness support was refreshed on 2026-09-16 to official tag `dsh-v0.1.6-alpha.1` only after exact-SHA CI, real ARTEMIS daemon, byte-for-byte bundle, package/Cordis lifecycle and Chromium Android-panel E2E all passed; this remains daemon/browser compatibility evidence, not real Android device E2E.'
const proofAddition = proofMarker + '\n- ACP/headless session-scoped ARTEMIS MCP configuration is proven on `main` through PR #121: the CLI emits the Harness `mcpServers` schema without mutating a Session/profile, Cordis remains the default format, and the permanent ARTEMIS workflow launches the real pinned `python -m mcp_server` successfully from a foreign Session cwd using the generated absolute Python/PYTHONPATH contract.'
release = replaceOnce(release, proofMarker, proofAddition, 'release ACP proof marker')
release = replaceOnce(
  release,
  'v1.0.1 keeps the v1.0.0 runtime contract unchanged while moving the reviewed Harness compatibility pin to official tag `dsh-v0.1.6-alpha.1`. ACP session-scoped `mcpServers` are now available upstream for ACP/headless clients, but dsh-artemis Web installation continues to require explicit Cordis/profile configuration because no public reversible Web-profile mutation seam is available.',
  'v1.0.1 keeps the v1.0.0 runtime contract unchanged while moving the reviewed Harness compatibility pin to official tag `dsh-v0.1.6-alpha.1`. After v1.0.1, PR #121 adds dsh-artemis generation of validated ACP/headless session-scoped `mcpServers`; Web installation still requires explicit Cordis/profile configuration because no public reversible Web-profile mutation seam is available.',
  'v1.0.1 decision ACP note',
)
writeFileSync(releasePath, release)
