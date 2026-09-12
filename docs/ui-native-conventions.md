# Native Harness UI conventions

Verified against DeepSeek Harness `c291e7961a515f6d7af9304e7fd1d257929aef26`.

The goal is not to imitate Harness visually. `dsh-artemis` should participate in the same extension surfaces and consume the same primitives/tokens so it naturally follows Harness as the product evolves.

## Sidebar integration

- Android is a page type (`kind: android`), not a DOM overlay or viewer hack.
- Register the type through `ctx.sidebarRightTabs.register(...)`.
- Register its body in the keyed `sidebar.right.pane.tab` seat using the definition `id`.
- Contribute a `guide` entry so users discover/open Android through the shipped right-sidebar guide; do not force-open the panel at boot.
- Let Harness own panes, tabs, docking, resize, persistence and tab-chip chrome.

The pinned `SidebarRightTabDefinition` explicitly defines external registrations as the `extension` priority band and guide entries as the native page-discovery mechanism.

## Visual system

Use exported primitives from `@deepseek-ai/dsh-client-ui-primitives` before creating a local control:

- `Button` for actions;
- `StateDot` for Ready/Busy/Error/Idle semantics;
- `Pill`/`Tag` for compact status labels where appropriate;
- official Harness icons when a semantic match exists.

If no suitable official mobile/device glyph exists, prefer the Harness guide's own fallback glyph over inventing a competing icon style.

Colours/surfaces use `--dsw-*` tokens only. Examples verified in shipped sidebar code include:

- `--dsw-alias-label-primary`;
- `--dsw-alias-label-secondary`;
- `--dsw-alias-label-tertiary`;
- `--dsw-alias-label-caption`;
- `--dsw-alias-bg-layer-1`;
- `--dsw-alias-border-l3` / `l4`;
- `--dsw-alias-interactive-bg-hover`.

Do not hardcode light/dark colours. Spacing and geometry may be local when they describe Android-specific layout, but should follow nearby shipped sidebar conventions: compact 38px utility headers, 12–16px content insets, restrained radii, and 12–15px text hierarchy.

## React/runtime discipline

React and Harness client UI modules are shared platform modules. Do not bundle a second React runtime or clone primitives locally. `dsh.client.inject` declares the Harness client modules this plugin consumes.

Keep transport/parsing outside React components. Components receive project-owned normalized state and focus on rendering/interactions.

## Network/security UX

- The Client never calls ARTEMIS `localhost:8000` directly.
- Web-profile reads go through the same-origin dsh-artemis Host route.
- The Host route applies Harness `connection.requestRejection(...)` before touching ARTEMIS.
- Client errors show bounded product messages, not raw stack/network/upstream details.
- Refresh failures may retain the last valid state but must visibly report that the refresh failed.

## Data honesty

Render only metadata supported by verified upstream contracts. Do not manufacture Android version/API level, AVD name, task progress, or stream status from guesses. A missing field stays absent until the adapter has a verified source.

## Accessibility

- Pair `StateDot` with text; the primitive is intentionally aria-hidden.
- Status transitions use a polite live region.
- Actions remain native buttons with useful accessible labels.
- Do not communicate Ready/Busy/Error using colour alone.

## Screen viewer rule

The future Android screen is a content surface inside the pane, not a replacement for pane chrome. It must preserve aspect ratio, respond to sidebar width, avoid persisting frames by default, and use the verified ARTEMIS transport/proxy contract rather than a browser-direct workaround.
