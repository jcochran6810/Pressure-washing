# CLAUDE.md

Project-specific instructions for Claude Code when working on this repository.

## End-session protocol

When the user types **"end session"** (or a clear equivalent), do the following in order:

1. **Update the `## Session log` section of this file** with a dated entry summarizing every change made during the session. Use the structure:
   ```
   ### YYYY-MM-DD — <branch name>
   - bullet for each meaningful change
   - group by feature / fix / docs where it helps
   - reference key files added/modified when useful
   ```
   Append the new entry at the top of the Session log (newest first).

2. **Commit the CLAUDE.md update** to the current working branch with a message like `Update CLAUDE.md with session log`.

3. **Merge the working branch into `main`**:
   - `git checkout main`
   - `git pull origin main`
   - `git merge --no-ff <working-branch>` (preserve history with a merge commit)
   - Resolve any conflicts; if conflicts can't be auto-resolved, stop and surface them to the user before going further.
   - `git push origin main`

4. **Confirm to the user** with the merged commit hash and a one-sentence summary.

Do **not** delete the working branch after merge — keep it for reference.

If the user has uncommitted changes when "end session" is invoked, commit those first with a descriptive message before merging.

## Session log

<!-- newest first; append a new dated entry on every "end session" -->
