# BuildQuick engineering instructions

## Deliver the smallest complete change
- Read the affected user flow and trace its callers, data, tests and deployment configuration before editing.
- Reuse existing components, shared calculations and platform capabilities. Add a dependency only when it solves a concrete need the existing code cannot reasonably meet.
- Keep changes focused and readable. Complete affected callers and tests; avoid speculative abstractions and unrelated rewrites.
- Preserve existing user edits and data. Never replace a working implementation with a mock merely to make a demo or test pass.

## Product truth and integrity
- Every success message must correspond to an observable result. Never fabricate scores, registrations, generated content or completed actions.
- Label sample data, estimates and unavailable capabilities at the point of use.
- Derive related financial totals, categories and assistant answers from one shared period and calculation policy. Preserve deficits and explain assumptions.
- Generated claims must be supported by supplied evidence. Ask for missing facts rather than inventing them.
- Keep validation, error handling, accessibility, permissions and recovery intact. Never simplify by removing these protections.

## Verify the user outcome
- Add focused behavior tests for changed calculations, parsers, persistence or security boundaries; trivial copy changes do not need new tests.
- Test meaningful edge cases, including empty inputs, invalid data, date boundaries and deficits when relevant.
- Source-string assertions alone do not prove an interaction works. Verify the resulting content/state and persistence where applicable.
- Run the repository's relevant checks. Report what changed, what passed and any untested material behavior without implying production verification.
- Confirm the target source/release before deployment. Keep local validation distinct from live-site behavior.

These project-specific practices are informed by the principles in
https://github.com/DietrichGebert/ponytail/blob/main/AGENTS.md.
No Ponytail plugin or lifecycle hooks are installed by this file.
