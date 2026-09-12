# Client adapter

Harness client integration and native right-sidebar UI live here.

## Boundaries

- `definition.mjs`: static Harness tab type and guide entry.
- `register.mjs`: Cordis/sidebar registration only.
- `overview.mjs`: project-owned protocol parsing and same-origin overview fetch.
- `panel.mjs`: React rendering and interaction only.

The first panel uses Harness' own `Button`, `Pill` and `StateDot` primitives and only `--dsw-*` theme tokens for colour/surface styling. It never fetches ARTEMIS directly; browser reads go through the secured same-origin dsh-artemis Host route.

Do not use DOM injection, private CSS selectors, arbitrary local URLs, or a parallel design system. See `docs/ui-native-conventions.md`.
