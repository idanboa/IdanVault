Deploy IdanVault to GitHub Pages.

Steps:
1. Run `npm run build` to verify the build passes. If it fails, stop and report the error.
2. Run `git status` to check for uncommitted changes.
3. If there are changes: stage all modified/new files with `git add -A`, then commit with a descriptive message summarizing what changed.
4. Push to `origin main` with `git push origin main`.
5. Watch the GitHub Actions deployment with `gh run watch --exit-status`. Report whether the deployment succeeded or failed.
6. If deployment succeeded, confirm the app is live at the GitHub Pages URL.
