# Worker Studio Acceptance Matrix

This matrix is the release contract for specification version 2.1. `Automated` means an executable unit, API, or browser test covers the behavior. `Implemented` means the behavior exists and requires the production evidence run. `N/A` means the product decision explicitly excludes the conditional or optional branch.

## Product decisions

- D01: At least one approved specialist is required.
- D02: Initial manual additions are disabled; new capabilities use the expansion flow.
- D03: Audience, problem, and desired value must be present or clarified.
- D04: Ambiguous edits are clarified and destructive edits require confirmation.
- D05: Historical restore UI is excluded; latest state and audit history are retained.
- D06: Signed guest-session persistence in SQL Server is supported; account sign-in recovery is excluded.
- D07: Text AI operations time out after 45 seconds with retained state and retry. Image generation uses a 120-second bounded operation.
- D08: Controlled interactive solution pages are supported; public publishing is excluded.
- D09: Voice structuring, support, content, images, and project-data analysis are live. Campaign and customer-success outputs are draft-only. No external action is executed.
- D10: Only current-project context is sent to OpenAI. Secrets, credentials, and unrelated projects are excluded and the boundary is disclosed in the UI.

## WS-V2-001 Problem understanding

| Criterion | Status | Evidence |
|---|---|---|
| AC01 Custom problem | Automated | Critical browser journey and `analyzeProject` tests |
| AC02 Empty or insufficient input | Automated | Focus-preservation browser test and clarification unit test |
| AC03 Audience problem and value | Automated | Climate and cross-domain tests |
| AC04 Requirements versus assumptions | Implemented | Structured interpretation schema and interpretation card |
| AC05 Exclusions and constraints | Automated | Climate exclusion test |
| AC06 Focused clarification | Automated | Clarification unit test |
| AC07 Correct before approval | Automated | Correction unit and browser tests |
| AC08 Conversation continuity | Automated | Clarification and refresh journeys |
| AC09 Understanding progress | Implemented | Busy state and live region |
| AC10 Editable samples | Automated | Browser examples insert without submission |
| AC11 Input-dependent understanding | Automated | Cross-domain unit and browser journeys |
| AC12 Prompt event | Automated | Required-event unit test and production verifier |

## WS-V2-002 Worker approval

| Criterion | Status | Evidence |
|---|---|---|
| AC01 Smallest useful existing team | Automated | Structured worker allow-list and cross-domain tests |
| AC02 Explain recommendations | Automated | Browser worker-card assertions |
| AC03 Builder remains distinct | Automated | Home and Worker Lab browser assertions |
| AC04 Adjust before approval | Automated | Worker gating and browser tests |
| AC05 Correct without build | Automated | Correction flow tests |
| AC06 Zero-worker rule | Automated | Approval guard; D01 requires one |
| AC07 Prevent approval bypass | Automated | Build invariant and API guard |
| AC08 Record accepted context | Automated | Approved-plan schema and production verifier |
| AC09 Hand off accepted plan | Automated | Reduced-team gating test |
| AC10 Omission explanation | N/A | Optional branch not selected |
| AC11 Contract inspection | N/A | Optional branch not selected |
| AC12 Manual proposal | N/A | D02 selects expansion-only additions |
| AC13 Reduced-team approval | Automated | Worker gating unit test |
| AC14 Recommendation selection approval events | Automated | Required-event test and production verifier |

## WS-V2-003 Solution generation

| Criterion | Status | Evidence |
|---|---|---|
| AC01 Accepted plan generation | Automated | Build authorization and worker sanitation |
| AC02 Identify Landing Page Manager | Automated | Studio and Worker Lab copy assertions |
| AC03 Meaningful progress | Implemented | Four-stage accessible progress view |
| AC04 Actual-solution page | Automated | Multidomain generation tests |
| AC05 Deselected capabilities | Automated | Reduced-team unit test |
| AC06 Desktop and mobile preview | Automated | Desktop and mobile Playwright projects |
| AC07 Return to conversation | Automated | Same project route and refresh journey |
| AC08 Supported interactions | Automated | Live feature runner and support classifier |
| AC09 Simulation versus execution | Automated | Worker modes and false external-action schemas |
| AC10 Failed-build recovery | Implemented | Persisted `FAILED` state and retry control |
| AC11 Retry retained build | Implemented | Retry dispatch uses the retained approved plan |
| AC12 Timeout policy | Implemented | Bounded SDK clients and retry state |
| AC13 Contrasting accepted plans | Automated | Multidomain unit test and browser examples |
| AC14 Build events | Automated | Event unit test, failure events, production verifier |

## WS-V2-004 Conversational refinement

| Criterion | Status | Evidence |
|---|---|---|
| AC01 Real same-project request | Automated | Revision browser journey |
| AC02 Exact wording | Automated | Unit and browser headline tests |
| AC03 Hierarchy order prominence | Implemented | Full validated page-spec revision |
| AC04 Existing approved capability | Implemented | Approved-worker sanitation |
| AC05 Ambiguous target | Automated | Ambiguous-removal tests |
| AC06 Destructive confirmation | Automated | Confirmation UI and engine guard |
| AC07 Separate additions | Automated | Semantic revision plan and copy-only unit test |
| AC08 Landing Page Manager application | Automated | Revision API and schema validation |
| AC09 Truthful success | Automated | Applied diff summary and atomic persistence |
| AC10 Cumulative revisions | Automated | Cumulative revision unit test |
| AC11 Navigation context | Automated | Refresh browser journey |
| AC12 Unsuccessful revision recovery | Implemented | Persisted failure request and retry |
| AC13 Historical restore | N/A | D05 excludes restore UI |
| AC14 Revision events | Automated | Required-event and failure-path handling |

## WS-V2-005 Capability expansion

| Criterion | Status | Evidence |
|---|---|---|
| AC01 Genuine new-capability detection | Automated | Semantic plan and copy-only regression test |
| AC02 Existing specialist proposal | Automated | Worker allow-list and expansion test |
| AC03 Separate approval | Automated | Expansion browser journey |
| AC04 Decline unchanged | Automated | Unit and browser tests |
| AC05 Updated accepted plan | Automated | Expansion approval unit test |
| AC06 Same-solution integration | Automated | Rebuild and project invariant |
| AC07 Actual expansion outcome | Automated | Applied event after completed rebuild |
| AC08 Approval versus execution | Automated | No-send restriction and false external-action schemas |
| AC09 Service data boundaries | Implemented | Minimal server payloads and visible disclosure |
| AC10 Simulation versus live action | Automated | Draft/live worker modes |
| AC11 Restricted campaign | Automated | Decline browser test and approval unit test |
| AC12 Expansion events | Automated | Selection, approval, build, and revision-applied unit assertions |

## WS-V2-006 Persistence and projects

| Criterion | Status | Evidence |
|---|---|---|
| AC01 Retain project context | Automated | SQL repository and refresh journey |
| AC02 Independent second project | Automated | Production verifier and repository isolation |
| AC03 Reopen intended project | Automated | Project list and owned-project routes |
| AC04 Saved-project list | Automated | Dashboard and list API |
| AC05 Complete saved state | Automated | Repository hydration schemas |
| AC06 Real refresh | Automated | Browser reload journey |
| AC07 Sign-in return | N/A | D06 excludes accounts; signed guest return is supported |
| AC08 Truthful unfinished state | Implemented | Persisted `FAILED` project state |
| AC09 Continue latest revision | Automated | Cumulative and refresh tests |
| AC10 Stable project reference | Automated | Authorized project and preview routes |
| AC11 Persistence boundary | Automated | Signed guest ownership and production verifier |
| AC12 Persistence versus versions | Automated | Latest state retained; D05 explicitly excludes restore UI |

## Shared completion evidence

- Desktop and mobile browser projects run the primary journeys.
- Keyboard focus, invalid-input recovery, worker tabs, approval, dialogs, and revision controls are operable without pointer-only behavior.
- Busy, failed, clarification, pending approval, applied, live, and draft states use text and semantics rather than color alone.
- The eight required event names and minimum properties are tested on real actions.
- Production acceptance requires running `npm run acceptance` and the SQL/OpenAI production verifier against the deployed environment.
