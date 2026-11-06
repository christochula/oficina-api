#!/usr/bin/env bash
set -euo pipefail
test "${NAMESPACE:?}" = oficina-fase4
aws eks update-kubeconfig --name "${CLUSTER_NAME:?}" --region "${AWS_REGION:?}"
secret_dir="${RUNNER_TEMP:?}/os-phase4-secrets"
mkdir -p "$secret_dir"
cleanup() { rm -rf "$secret_dir"; }
trap cleanup EXIT
database="$(aws secretsmanager get-secret-value --secret-id "${DATABASE_SECRET_ID:?}" --query SecretString --output text)"
jwt="$(aws secretsmanager get-secret-value --secret-id "${JWT_SECRET_ID:?}" --query SecretString --output text)"
runtime="$(aws secretsmanager get-secret-value --secret-id "${RUNTIME_SECRET_ID:?}" --query SecretString --output text)"
save() { local key="$1" value="$2"; test -n "$value" && test "$value" != null; printf '::add-mask::%s\n' "$value"; printf '%s' "$value" > "$secret_dir/$key"; }
save DATABASE_URL "$(jq -er '.url' <<< "$database")"
save JWT_SECRET "$(jq -er '.secret' <<< "$jwt")"
save JWT_REFRESH_SECRET "$(jq -er '.refreshSecret' <<< "$jwt")"
save AUTH_CLIENT_LOOKUP_TOKEN "$(jq -er '.AUTH_CLIENT_LOOKUP_TOKEN' <<< "$runtime")"
save JWT_EXPIRATION 15m
save JWT_REFRESH_EXPIRATION 7d
save AWS_ACCESS_KEY_ID "${AWS_ACCESS_KEY_ID:?}"
save AWS_SECRET_ACCESS_KEY "${AWS_SECRET_ACCESS_KEY:?}"
save AWS_SESSION_TOKEN "${AWS_SESSION_TOKEN:?}"
if jq -e '.ADMIN_SEED_PASSWORD' <<< "$runtime" > /dev/null; then save ADMIN_SEED_PASSWORD "$(jq -r '.ADMIN_SEED_PASSWORD' <<< "$runtime")"; fi
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic oficina-api -n "$NAMESPACE" --from-file="$secret_dir" --dry-run=client -o yaml | kubectl apply -f -
