# Overnight Agent Harness

## Mission
Do exactly this:
Help me make progress on the gaant-rolled app by completing feature requests and fixing bugs.

## Allowed Inputs
- May read:
  - all files and folders inside the /Users/rhoen/Documents/code/gaant-rolled directory. 
- May not read:
  - anything else

## Allowed Actions
- May create:
  - markdown reports
  - code diffs
  - tmp directories that are later deleted.
  - image files
  - icon files
  - git branches starting with feat/
  - git branches called staging
- May not:
  - send emails
  - delete/edit production data
  - purchase anything
  - message humans
  - change credentials/secrets
  - merge code to the main branch
  - access unrelated files

## Stop Conditions
Stop immediately if:
- credentials/secrets are encountered
- instructions conflict
- a task requires external authority
- confidence is below 0.75
- output would affect a real person/account/system

## Required Output
Produce:
1. git branches with committed code.
2. produce a markdown document summarizing the work that was completed, explaining any challenges that were encountered, and what was done to handle those challenges, or if a challenge could not be overcome, what was the consequence. Create a worklog.md document following the below criteria.

## Worklog Rules
For every step, log:
- timestamp
- action taken
- input/source used
- result
- confidence
- next decision

## Evidence Rules
Every claim must link to:
- source file path
- URL
- command output
- email/message ID
- exact quoted snippet when needed

No citation = mark as assumption.

## Final Report Format
- Completed
- Not completed
- Blocked
- Risks
- Recommended human review
- Exact files changed/created