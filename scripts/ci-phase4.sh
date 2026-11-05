#!/usr/bin/env bash
set -euo pipefail
suite="${1:-bdd}"
case "$suite" in bdd|frontend) ;; *) echo "Expected bdd or frontend" >&2; exit 2;; esac
cleanup() {
  docker compose -f compose.phase4.yml logs --no-color > phase4-compose.log 2>&1 || true
  docker compose -f compose.phase4.yml down -v --remove-orphans || true
}
trap cleanup EXIT
docker compose -f compose.phase4.yml up --build -d
for endpoint in http://localhost:3000/api/health/ready http://localhost:3001/api/v1/billing/health http://localhost:3002/api/v1/production/health; do
  ready=false
  for attempt in $(seq 1 90); do
    if curl --fail --silent "$endpoint" > /dev/null; then ready=true; break; fi
    sleep 2
  done
  if [ "$ready" != true ]; then echo "Readiness timeout: $endpoint" >&2; exit 1; fi
done
if [ "$suite" = bdd ]; then
  npm run test:bdd
else
  node scripts/seed-local-demo.cjs
  export LOCAL_DEMO_MODE=true
  npm run test:frontend:e2e
  npm run test:frontend:manual
fi
