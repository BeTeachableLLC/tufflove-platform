#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Missing compose file: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  echo "Copy .env.production.example -> .env.production and set real values." >&2
  exit 1
fi

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

usage() {
  cat <<'USAGE'
Usage: scripts/prod-stack.sh <command> [args]

Commands:
  start         Build and start the production stack in background
  stop          Stop running services without removing volumes
  restart       Recreate and restart services
  down          Stop services and remove containers/networks (volumes kept)
  status        Show container status
  logs [svc]    Follow logs (all services or specific service name)
  config        Render full compose config
  check         Run lightweight health checks
USAGE
}

check_health() {
  compose ps

  local api_code
  local worker_code
  local web_code
  local familyops_code
  local trigger_code
  local admin_token

  api_code="$(curl -sS -o /tmp/tufflove_api_health.out -w '%{http_code}' http://127.0.0.1:8080/healthz)"
  worker_code="$(curl -sS -o /tmp/tufflove_worker_health.out -w '%{http_code}' http://127.0.0.1:8081/healthz)"
  web_code="$(curl -sS -o /tmp/tufflove_web_health.out -w '%{http_code}' http://127.0.0.1:3000/sign-in)"
  familyops_code="$(curl -I -sS -o /tmp/tufflove_familyops_head.out -w '%{http_code}' http://127.0.0.1:3000/familyops/approvals)"
  admin_token="$(grep -E '^ADMIN_TOKEN=' "${ENV_FILE}" | tail -1 | cut -d'=' -f2- || true)"
  if [[ -z "${admin_token}" ]]; then
    echo "ADMIN_TOKEN is missing in ${ENV_FILE}." >&2
    exit 1
  fi
  trigger_code="$(curl -sS -o /tmp/tufflove_trigger_health.out -w '%{http_code}' \
    "http://127.0.0.1:8080/v1/triggers?tenant_id=familyops" \
    -H "x-admin-token: ${admin_token}")"

  echo "api_health=${api_code}"
  echo "worker_health=${worker_code}"
  echo "trigger_api=${trigger_code}"
  echo "web_sign_in=${web_code}"
  echo "familyops_surface=${familyops_code}"

  if [[ "${api_code}" != "200" || "${worker_code}" != "200" || "${trigger_code}" != "200" || "${web_code}" != "200" ]]; then
    echo "Health check failed." >&2
    exit 1
  fi

  if [[ "${familyops_code}" =~ ^5 ]]; then
    echo "FamilyOps surface check failed with ${familyops_code}." >&2
    exit 1
  fi
}

cmd="${1:-}"
case "${cmd}" in
  start)
    compose up -d --build
    ;;
  stop)
    compose stop
    ;;
  restart)
    compose up -d --build --force-recreate
    ;;
  down)
    compose down
    ;;
  status)
    compose ps
    ;;
  logs)
    shift || true
    if [[ "${1:-}" != "" ]]; then
      compose logs -f "$1"
    else
      compose logs -f
    fi
    ;;
  config)
    compose config
    ;;
  check)
    check_health
    ;;
  *)
    usage
    exit 1
    ;;
esac
