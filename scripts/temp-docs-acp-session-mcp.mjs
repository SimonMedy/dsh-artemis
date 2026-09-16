import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const readmePath = 'README.md'
let readme = readFileSync(readmePath, 'utf8')
const readmeMarker = 'The command prints one Cordis row to stdout and never edits profile files. Review that row, then add it to the active Harness profile using your normal Cordis/profile workflow.\n\nYou can also run the generator from a checked-out release:'
const readmeReplacement = `The command prints one Cordis row to stdout and never edits profile files. Review that row, then add it to the active Harness profile using your normal Cordis/profile workflow.\n\n### ACP / headless sessions\n\nDeepSeek Harness \`dsh-v0.1.6-alpha.1\` also accepts session-scoped MCP servers through ACP. Generate the ARTEMIS declaration as an ACP \`mcpServers\` JSON fragment:\n\n\`\`\`bash\ndsh-artemis-mcp-config \\\n  --artemis-root /absolute/path/to/artemis \\\n  --format acp-json\n\`\`\`\n\nPass the emitted \`mcpServers\` array with the ACP \`session/new\` or \`session/resume\` request. The generator only prints JSON; it never creates, resumes or modifies a Session. Harness owns the ACP Session working directory, so this format deliberately omits \`cwd\`; the generated \`PYTHONPATH\` keeps \`python -m mcp_server\` anchored to the validated ARTEMIS root. Web/Cordis profile installation remains explicit and separate.\n\nYou can also run the generator from a checked-out release:`
readme = replaceOnce(readme, readmeMarker, readmeReplacement, 'README MCP generator section')
readme = replaceOnce(
  readme,
  '- Model-owned screenshot handoff remains gated until DeepSeek Harness exposes a supported Session-owned image attachment seam.',
  '- Direct ARTEMIS screenshot handoff to the model remains gated: Harness can now persist MCP image result blocks for image-capable models, but ARTEMIS screenshot state still returns a local `file://` JPEG reference rather than MCP image content.',
  'README image limitation',
)
writeFileSync(readmePath, readme)

const docPath = 'docs/mcp-integration.md'
let doc = readFileSync(docPath, 'utf8')
const generatorMarker = 'The helper validates `pyproject.toml`, `mcp_server/__main__.py` and `mcp_server/rules.md`, resolves the interpreter under the rules above, and writes exactly one Cordis row to stdout. It does **not** scan arbitrary home directories, execute discovery shell commands, edit DeepSeek Harness profiles or modify ARTEMIS. Profile mutation will only be added after a DeepSeek Harness profile-patch workflow is proven safe and reversible.\n\n## Setup/status UX contract'
const generatorReplacement = `The helper validates \`pyproject.toml\`, \`mcp_server/__main__.py\` and \`mcp_server/rules.md\`, resolves the interpreter under the rules above, and writes configuration to stdout. The default \`cordis\` format remains exactly one Cordis row. It does **not** scan arbitrary home directories, execute discovery shell commands, edit DeepSeek Harness profiles or modify ARTEMIS. Profile mutation will only be added after a DeepSeek Harness profile-patch workflow is proven safe and reversible.\n\n### ACP session-scoped MCP format\n\nHarness \`dsh-v0.1.6-alpha.1\` accepts MCP declarations on ACP \`session/new\` and \`session/resume\`. Generate a directly usable JSON fragment with:\n\n\`\`\`bash\ndsh-artemis-mcp-config \\\n  --artemis-root /absolute/path/to/artemis \\\n  --format acp-json\n\`\`\`\n\nThe output has the form \`{ "mcpServers": [...] }\` and contains only the validated absolute Python command, \`["-m", "mcp_server"]\` arguments and the bounded ARTEMIS environment entries. It intentionally contains no \`cwd\`: ACP owns the Session workspace and applies it as the stdio MCP working directory. \`PYTHONPATH=<artemis-root>\` anchors module resolution to the validated ARTEMIS checkout so the server remains launchable from an unrelated Session workspace. The permanent ARTEMIS compatibility workflow exercises this exact foreign-cwd launch against the real pinned ARTEMIS installation.\n\nThis format is configuration generation only. It does not open an ACP connection, create/resume a Session, mutate a Web profile, or broaden browser privileges. Cordis remains the default output for the Web/profile workflow.\n\n## Setup/status UX contract`
doc = replaceOnce(doc, generatorMarker, generatorReplacement, 'MCP integration generator section')
writeFileSync(docPath, doc)
