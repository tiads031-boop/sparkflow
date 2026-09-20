#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

REPO_DIR="${SPARKFLOW_REPO_DIR:-/opt/sparkflow/app}"
WEB_ROOT="${SPARKFLOW_WEB_ROOT:-/var/www/sparkflow}"
SITE_URL="${SPARKFLOW_SITE_URL:-https://fish-life.cc.cd}"
API_BASE_URL="${SPARKFLOW_API_BASE_URL:-https://api.fish-life.cc.cd/api}"
BUILD_IMAGE="${SPARKFLOW_WEB_BUILD_IMAGE:-node:22-alpine}"
NODE_MODULES_DIR="${SPARKFLOW_WEB_NODE_MODULES:-}"
DEPLOY_REF="${1:-origin/master}"
LOCK_FILE="${SPARKFLOW_WEB_DEPLOY_LOCK:-/var/lock/sparkflow-web-deploy.lock}"

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Another SparkFlow Web deployment is running." >&2
  exit 1
fi

for command in git docker curl rsync nginx; do
  command -v "${command}" >/dev/null 2>&1 || {
    echo "Missing required command: ${command}" >&2
    exit 1
  }
done

[[ -d "${REPO_DIR}/.git" ]] || {
  echo "Git repository not found: ${REPO_DIR}" >&2
  exit 1
}
[[ -f "${REPO_DIR}/web/.env.production" ]] || {
  echo "Production Web environment file not found: ${REPO_DIR}/web/.env.production" >&2
  exit 1
}

if ! grep -Fxq "VITE_API_BASE_URL=${API_BASE_URL}" "${REPO_DIR}/web/.env.production"; then
  echo "Refusing deployment: VITE_API_BASE_URL does not match ${API_BASE_URL}" >&2
  exit 1
fi

git -C "${REPO_DIR}" fetch --prune origin master
TARGET_SHA="$(git -C "${REPO_DIR}" rev-parse "${DEPLOY_REF}^{commit}")"
SHORT_SHA="${TARGET_SHA:0:12}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d /tmp/sparkflow-web-deploy.XXXXXX)"
WORKTREE="${WORK_DIR}/source"
STAGED_ROOT="${WEB_ROOT}.new-${SHORT_SHA}-${STAMP}"
BACKUP_ROOT="${WEB_ROOT}.backup-${SHORT_SHA}-${STAMP}"
SWITCHED=0

cleanup() {
  local status=$?
  if [[ "${SWITCHED}" -eq 1 && "${status}" -ne 0 && -d "${BACKUP_ROOT}" ]]; then
    echo "Deployment failed; restoring previous Web release." >&2
    rm -rf -- "${WEB_ROOT}"
    mv -- "${BACKUP_ROOT}" "${WEB_ROOT}"
  fi
  rm -rf -- "${STAGED_ROOT}"
  git -C "${REPO_DIR}" worktree remove --force "${WORKTREE}" >/dev/null 2>&1 || true
  rm -rf -- "${WORK_DIR}"
  exit "${status}"
}
trap cleanup EXIT

git -C "${REPO_DIR}" worktree add --detach "${WORKTREE}" "${TARGET_SHA}"
cp -- "${REPO_DIR}/web/.env.production" "${WORKTREE}/web/.env.production"

docker_args=(
  run --rm
  --entrypoint sh
  -v "${WORKTREE}/web:/app"
  -w /app
)
build_command="npm ci --no-audit --no-fund && npm run build"

if [[ -n "${NODE_MODULES_DIR}" ]]; then
  [[ -d "${NODE_MODULES_DIR}" ]] || {
    echo "Configured node_modules directory not found: ${NODE_MODULES_DIR}" >&2
    exit 1
  }
  docker_args+=(-v "${NODE_MODULES_DIR}:/app/node_modules")
  build_command="npm run build"
fi

echo "Building SparkFlow Web at ${TARGET_SHA}..."
docker "${docker_args[@]}" "${BUILD_IMAGE}" -lc "${build_command}"

[[ -f "${WORKTREE}/web/dist/index.html" ]] || {
  echo "Build did not produce dist/index.html" >&2
  exit 1
}
if ! grep -RqsF "${API_BASE_URL}" "${WORKTREE}/web/dist"; then
  echo "Built assets do not contain the expected API base URL." >&2
  exit 1
fi

mkdir -p "${STAGED_ROOT}"
rsync -a --delete "${WORKTREE}/web/dist/" "${STAGED_ROOT}/"
printf '%s\n' "${TARGET_SHA}" > "${STAGED_ROOT}/.build-sha"
chown -R www-data:www-data "${STAGED_ROOT}"
nginx -t

if [[ -e "${WEB_ROOT}" ]]; then
  mv -- "${WEB_ROOT}" "${BACKUP_ROOT}"
fi
mv -- "${STAGED_ROOT}" "${WEB_ROOT}"
SWITCHED=1

curl --fail --silent --show-error --location --max-time 20 "${SITE_URL}/" >/dev/null
curl --fail --silent --show-error --max-time 20 "${API_BASE_URL}/health" >/dev/null

SWITCHED=0
echo "Web deployment complete."
echo "Commit: ${TARGET_SHA}"
echo "Backup: ${BACKUP_ROOT}"
