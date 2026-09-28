#!/usr/bin/env bash
#
# Pull a new upstream Mermaid Live Editor snapshot onto the vendor branch.
#
# Strategy: this repository's first commit is a byte-exact copy of the upstream
# tree. The branch `vendor/upstream` stays pinned to pristine upstream snapshots
# and never carries local changes. Because that branch shares history with the
# working branch, `git merge vendor/upstream` is an ordinary three-way merge
# rather than an unrelated-histories conflict fest.
#
# This script only refreshes the vendor branch. Merging is a human decision and
# is intentionally left to you.
set -euo pipefail

UPSTREAM_URL='https://github.com/mermaid-js/mermaid-live-editor.git'
VENDOR_BRANCH='vendor/upstream'
REF='master'
DRY_RUN=0

die()  { printf 'error: %s\n' "$*" >&2; exit 1; }
info() { printf '  %s\n' "$*"; }

usage() {
  cat <<EOF
Usage: scripts/update-upstream.sh [REF] [--dry-run]

  REF         upstream ref to import (default: master)
              Upstream publishes no git tags; 'master' is its release branch.
  --dry-run   report what would happen; touch nothing (no fetch, no remote,
              no branch change, no commit)
  -h, --help  this message

After it finishes, merge the refreshed snapshot into your working branch:

    git merge $VENDOR_BRANCH
EOF
}

args=()
for a in "$@"; do
  case "$a" in
    -h|--help) usage; exit 0 ;;
    --dry-run) DRY_RUN=1 ;;
    -*)        die "unknown option: $a" ;;
    *)         args+=("$a") ;;
  esac
done
[ ${#args[@]} -gt 0 ] && REF="${args[0]}"

cd "$(git rev-parse --show-toplevel)"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "DRY RUN - nothing will be changed."
  info "repository   : $(pwd)"
  info "upstream url : $UPSTREAM_URL"
  info "upstream ref : $REF"
  info "vendor branch: $VENDOR_BRANCH"
  info "current branch: $(git rev-parse --abbrev-ref HEAD)"
  echo
  echo "Would: add the 'upstream' remote if missing, fetch $REF, check out"
  echo "$VENDOR_BRANCH, replace its tree with upstream's, verify the resulting"
  echo "tree hash matches upstream's, commit, and return you to this branch."
  exit 0
fi

# --- preconditions --------------------------------------------------------
[ -z "$(git status --porcelain)" ] || die "working tree is dirty; commit or stash first."

start_branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$start_branch" != 'HEAD' ] || die "detached HEAD; check out a branch first."

git show-ref --verify --quiet "refs/heads/$VENDOR_BRANCH" \
  || die "branch '$VENDOR_BRANCH' not found. Create it from the remote branch, which
       holds the latest pristine snapshot:
         git fetch origin $VENDOR_BRANCH:$VENDOR_BRANCH
       Do not recreate it from the first commit: once an update has been imported,
       that commit is an older snapshot, and importing on top of it would redo
       the merges already made."

if git remote get-url upstream >/dev/null 2>&1; then
  have="$(git remote get-url upstream)"
  [ "$have" = "$UPSTREAM_URL" ] \
    || die "remote 'upstream' points at $have, expected $UPSTREAM_URL. Refusing to rewrite it."
else
  info "adding remote 'upstream' -> $UPSTREAM_URL"
  git remote add upstream "$UPSTREAM_URL"
fi

# --- fetch ----------------------------------------------------------------
info "fetching upstream $REF ..."
git fetch --quiet upstream "$REF"
up_commit="$(git rev-parse --verify FETCH_HEAD)"
up_tree="$(git rev-parse --verify "${up_commit}^{tree}")"
up_version="$(git show "${up_commit}:package.json" | sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' | head -1)"

info "upstream commit : $up_commit"
info "upstream tree   : $up_tree"
info "upstream version: ${up_version:-unknown}"

if [ "$(git rev-parse "${VENDOR_BRANCH}^{tree}")" = "$up_tree" ]; then
  echo "Vendor branch already matches upstream $REF. Nothing to do."
  exit 0
fi

# --- replace the vendor tree ---------------------------------------------
trap 'git checkout --quiet "$start_branch" 2>/dev/null || true' EXIT
git checkout --quiet "$VENDOR_BRANCH"

# Clear only git-tracked paths. Using `git rm` (rather than `rm -rf *`) means
# .git/ and anything untracked - including this script when it is run from a
# working branch that has it but the vendor branch does not - are never touched.
git rm -rq --cached . >/dev/null
git ls-files -z | xargs -0 -r rm -f
git clean -qfd -e .git

git archive --format=tar "$up_commit" | tar -x

git add -A
# Upstream tracks .npmrc even though upstream's own .gitignore lists it. A plain
# `git add -A` therefore silently drops it and the tree diverges from upstream by
# exactly one file. Force-add it when upstream actually ships it.
# Ask git for the one path rather than piping a listing into `grep -q`: grep
# exits on the first match, and under `pipefail` the writer's SIGPIPE (141)
# makes the condition false, so the force-add was silently skipped.
if [ -n "$(git ls-tree --name-only "$up_commit" -- .npmrc)" ]; then
  git add -f -- .npmrc
fi

got_tree="$(git write-tree)"
[ "$got_tree" = "$up_tree" ] \
  || die "tree mismatch after import: got $got_tree, expected $up_tree.
       The vendor snapshot would NOT be pristine. Aborting; run 'git reset --hard' on
       $VENDOR_BRANCH to discard this attempt."

git commit --quiet -m "vendor: import Mermaid Live Editor upstream snapshot

Pristine, unmodified import of the upstream project.

Upstream:  $UPSTREAM_URL
Ref:       $REF
Commit:    $up_commit
Tree:      $up_tree
Version:   ${up_version:-unknown}"

info "vendor branch updated: $(git rev-parse --short HEAD)"

git checkout --quiet "$start_branch"
trap - EXIT

cat <<EOF

Done. Next steps:

  1. git merge $VENDOR_BRANCH
  2. resolve conflicts (pnpm-lock.yaml: regenerate with 'pnpm install', never hand-merge)
  3. update .upstream-version.json: importedCommit $up_commit,
     importedTree $up_tree, upstreamVersion ${up_version:-unknown},
     importDate, and vendorBaseCommit $(git rev-parse "$VENDOR_BRANCH")
  4. re-verify:  pnpm install && pnpm build && pnpm audit --prod
                 npm pack  ->  unpack  ->  npm install && npm run build
                                        && npm audit --omit=dev
                 pnpm licenses list --prod   (refresh THIRD-PARTY-LICENSES.md)
  5. follow the full checklist in docs-dev/UPSTREAM.md
EOF
