#!/usr/bin/env bash
set -euo pipefail
suite="${1:-bdd}"
case "$suite" in bdd|frontend|resilience) ;; *) echo "Expected bdd, frontend or resilience" >&2; exit 2;; esac
export COMPOSE_PROJECT_NAME="oficina-phase4-ci-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-${suite}"
export PHASE4_COMPOSE_PROJECT="$COMPOSE_PROJECT_NAME"
node scripts/local-phase4.cjs ci "$suite"
