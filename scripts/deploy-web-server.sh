#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/sparkflow/app}"
WEB_ROOT="${WEB_ROOT:-/var/www/sparkflow}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/fish-life.cc.cd}"
NGINX_ENABLED="${NGINX_ENABLED:-/etc/nginx/sites-enabled/fish-life.cc.cd}"
WEB_BUILD_IMAGE="${WEB_BUILD_IMAGE:-sparkflow-api:latest}"

if [[ ! -d "$APP_ROOT/.git" ]]; then
  echo "SparkFlow repository not found at $APP_ROOT" >&2
  exit 1
fi

cd "$APP_ROOT"
git fetch origin master
git checkout master
git pull --ff-only origin master

DEPLOY_SHA="$(git rev-parse HEAD)"

if command -v npm >/dev/null 2>&1; then
  cd "$APP_ROOT/web"
  npm ci
  npm run build
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "Neither npm nor docker is available to build the Web app" >&2
    exit 1
  fi

  if ! docker image inspect "$WEB_BUILD_IMAGE" >/dev/null 2>&1; then
    echo "Web build image not found: $WEB_BUILD_IMAGE" >&2
    exit 1
  fi

  docker run --rm --entrypoint sh \
    -e NODE_ENV=development \
    -e npm_config_cache=/tmp/npm-cache \
    -v "$APP_ROOT/web:/web" \
    -w /web \
    "$WEB_BUILD_IMAGE" \
    -lc 'npm ci && npm run build'
fi

install -d -o www-data -g www-data "$WEB_ROOT"
rsync -a --delete "$APP_ROOT/web/dist/" "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"

if [[ ! -e "$NGINX_SITE" ]]; then
  install -m 0644 "$APP_ROOT/deploy/nginx/fish-life.cc.cd.conf" "$NGINX_SITE"
fi
ln -sfn "$NGINX_SITE" "$NGINX_ENABLED"

nginx -t
systemctl reload nginx

test -f "$WEB_ROOT/index.html"
curl -fsS -H 'Host: fish-life.cc.cd' http://127.0.0.1/ >/dev/null

printf 'SparkFlow Web deployed from %s to %s\n' "$DEPLOY_SHA" "$WEB_ROOT"
