# Workstream / Deliverable Template

Use this structure inside each workstream so another engineer can execute it without guessing.

```markdown
### <N>. <Workstream title>
**Purpose:** one sentence on why this slice exists.

**Files and systems:**
- real existing file paths
- explicitly named new files, if any

**Deliverables:**
- observable change
- proof target
- docs or generated artifact updates, if relevant

**Exit criteria:**
- what must be true before the next slice starts
```

## Tips

- Prefer vertical slices over layer-by-layer sequencing.
- Keep workstreams dependency ordered.
- If a workstream changes behavior, name the validation command or test layer that proves it.
- If a workstream introduces a new file, declare that path explicitly rather than hiding it behind "or equivalent".
