# Engineering guidelines

Follow these when writing or reviewing code. Kept here so [AGENTS.md](../AGENTS.md) stays focused on product and architecture.

## General

- **Simplicity first**: Prefer small, focused modules and clear data flow. Avoid unnecessary abstractions until they’re needed.
- **Explicit over implicit**: Name things clearly; avoid “magic” or hidden behavior. Document non-obvious decisions in code or in AGENTS.md.
- **Incremental delivery**: Ship working slices (e.g., “place one item on a canvas”) before adding complexity (e.g., full connection graphs).

## Code quality

- **Readability**: Code should be easy to read and change. Prefer descriptive names and short functions.
- **Single responsibility**: Each file/component/function should have one clear job.
- **Minimal dependencies**: Add libraries only when they clearly solve a problem; prefer standard libraries and small, well-maintained packages.
- **No dead code**: Remove unused code, commented-out blocks, and obsolete options; keep history in version control.

## Data and state

- **Single source of truth**: Keep layout state (positions, connections, gear list) in one place; derive UI from that state.
- **Serializable state**: Design state so it can be saved/loaded (e.g., JSON) for persistence and sharing.
- **Validation at boundaries**: Validate and normalize data when it enters the app (e.g., file load, paste, API).

## UI and UX

- **Cable drag-and-drop**: The main interaction is dragging a cable from one device (or its output port) and dropping on another (or its input port). Visual feedback during drag (e.g. rubber-band line) and clear drop targets are required.
- **Minimal frontend deps**: Prefer vanilla JS; add a library only when it clearly simplifies drag-and-drop or rendering (e.g. a small SVG/Canvas helper). No large frameworks unless justified.
- **Responsive**: Layout and controls should work on different screen sizes; prioritize desktop for detailed editing.
- **Accessible**: Use semantic HTML, keyboard navigation where relevant, and sufficient contrast; avoid relying only on color.
- **Performance**: Keep the main thread responsive; avoid blocking on large layout recalculations or heavy I/O.

## Testing and reliability

- **Critical paths**: Add tests for core logic (e.g., layout math, connection rules, import/export).
- **Reproducibility**: Prefer deterministic behavior and stable IDs so layouts are reproducible across sessions.
- **Error handling**: Handle invalid input and failures gracefully; surface clear messages and recovery options.

## Version control and collaboration

- **Clear commits**: Use descriptive commit messages that explain *why* when it’s not obvious from the diff.
- **Branch strategy**: Use short-lived branches for features/fixes; keep `main` (or primary branch) in a deployable state.
- **Documentation**: Keep README, AGENTS.md, and this file up to date when behavior or architecture changes.
