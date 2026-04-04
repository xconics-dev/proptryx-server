#!/usr/bin/env bash
set -euo pipefail

SERVICES=(gateway auth kernel company)
BUILD_FIRST=false
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker/docker-compose.yml"
ENV_FILE="${REPO_ROOT}/env/.env"
PROJECT_NAME="proptryx"

print_usage() {
  cat <<'USAGE'
Usage:
  scripts/docker-image-size.sh [--build] [all|gateway|auth|kernel|company ...]

Examples:
  pnpm docker:size
  pnpm docker:size -- all
  pnpm docker:size -- gateway auth
  pnpm docker:size:build -- kernel
  pnpm docker:size -- company
USAGE
}

contains_service() {
  local needle="$1"
  for svc in "${SERVICES[@]}"; do
    if [[ "$svc" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

create_sanitized_docker_config_file() {
  local temp_file
  local source_config

  temp_file="$(mktemp)"
  source_config="${HOME}/.docker/config.json"

  if [[ -f "$source_config" ]]; then
    if command -v jq >/dev/null 2>&1; then
      if jq 'del(.credsStore, .credStore, .credHelpers)' "$source_config" >"$temp_file"; then
        echo "$temp_file"
        return 0
      fi
    fi

    if command -v node >/dev/null 2>&1; then
      node -e '
const fs = require("fs");
const sourcePath = process.argv[1];
const targetPath = process.argv[2];
let config = { auths: {} };

if (fs.existsSync(sourcePath)) {
  try {
    const raw = fs.readFileSync(sourcePath, "utf8");
    config = JSON.parse(raw);
  } catch {
    config = { auths: {} };
  }
}

delete config.credsStore;
delete config.credStore;
delete config.credHelpers;

if (!config.auths || typeof config.auths !== "object") {
  config.auths = {};
}

fs.writeFileSync(targetPath, JSON.stringify(config, null, 2));
' "$source_config" "$temp_file" >/dev/null 2>&1 || true

      if [[ -s "$temp_file" ]]; then
        echo "$temp_file"
        return 0
      fi
    fi
  fi

  printf '{"auths":{}}\n' >"$temp_file"
  echo "$temp_file"
}

restore_docker_config() {
  local had_original_config="$1"
  local docker_config_path="$2"
  local original_backup_path="$3"

  if [[ "$had_original_config" == "true" ]]; then
    if [[ -n "$original_backup_path" && -f "$original_backup_path" ]]; then
      cp "$original_backup_path" "$docker_config_path"
    fi
  else
    rm -f "$docker_config_path"
  fi

  if [[ -n "$original_backup_path" ]]; then
    rm -f "$original_backup_path"
  fi
}

build_selected_services() {
  local output

  if output="$(compose build "$@" 2>&1)"; then
    printf "%s\n" "$output"
    return 0
  fi

  local status=$?
  printf "%s\n" "$output" >&2

  if [[ "$output" != *"docker-credential-desktop"* ]]; then
    return "$status"
  fi

  echo "Detected missing docker-credential-desktop. Retrying build by temporarily disabling Docker credential helpers." >&2

  local docker_config_dir
  local docker_config_path
  local original_backup_path=""
  local had_original_config="false"
  local sanitized_config_file

  docker_config_dir="${HOME}/.docker"
  docker_config_path="${docker_config_dir}/config.json"
  mkdir -p "$docker_config_dir"

  if [[ -f "$docker_config_path" ]]; then
    had_original_config="true"
    original_backup_path="$(mktemp)"
    cp "$docker_config_path" "$original_backup_path"
  fi

  sanitized_config_file="$(create_sanitized_docker_config_file)"
  cp "$sanitized_config_file" "$docker_config_path"
  rm -f "$sanitized_config_file"

  if output="$(compose build "$@" 2>&1)"; then
    printf "%s\n" "$output"
    restore_docker_config "$had_original_config" "$docker_config_path" "$original_backup_path"
    return 0
  fi

  local fallback_status=$?
  printf "%s\n" "$output" >&2
  restore_docker_config "$had_original_config" "$docker_config_path" "$original_backup_path"

  echo "Retry failed. Fix Docker credential helper config in ~/.docker/config.json or reinstall docker-credential-desktop." >&2
  return "$fallback_status"
}

compose_image_ref_for_service() {
  local svc="$1"
  local image_ref=""
  image_ref="$(compose config --images 2>/dev/null | awk -v service="$svc" 'NR == 1 { next } { print }' | grep -E "(^|/)${PROJECT_NAME}-${svc}(:|$)" | head -n 1 || true)"
  if [[ -z "$image_ref" ]]; then
    image_ref="${PROJECT_NAME}-${svc}"
  fi
  echo "$image_ref"
}

find_image_ref_for_service() {
  local svc="$1"
  local expected_repo="$(compose_image_ref_for_service "$svc")"
  expected_repo="${expected_repo%:latest}"
  local ref=""

  if docker image inspect "${expected_repo}:latest" >/dev/null 2>&1; then
    echo "${expected_repo}:latest"
    return 0
  fi

  ref="$({
    docker image ls --format '{{.Repository}}:{{.Tag}}' \
      | awk -v repo="${expected_repo}" -F: '$1 == repo && $2 != "<none>" { print $0; exit }'
  } || true)"
  if [[ -n "$ref" ]]; then
    echo "$ref"
    return 0
  fi

  ref="$({
    docker image ls --format '{{.Repository}}:{{.Tag}}' \
      | awk -v suffix="-${svc}" -F: 'index($1, suffix) > 0 && $2 != "<none>" { print $0; exit }'
  } || true)"
  if [[ -n "$ref" ]]; then
    echo "$ref"
    return 0
  fi

  return 1
}

to_human() {
  local bytes="$1"
  awk -v b="$bytes" 'BEGIN {
    split("B KB MB GB TB", u, " ");
    i=1;
    while (b>=1024 && i<5) { b/=1024; i++ }
    printf("%.2f %s", b, u[i]);
  }'
}

args=()
for arg in "$@"; do
  if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
    print_usage
    exit 0
  elif [[ "$arg" == "--build" ]]; then
    BUILD_FIRST=true
  else
    args+=("$arg")
  fi
done

selected=()
if [[ ${#args[@]} -eq 0 ]] || [[ " ${args[*]} " == *" all "* ]]; then
  selected=("${SERVICES[@]}")
else
  for arg in "${args[@]}"; do
    if ! contains_service "$arg"; then
      echo "Invalid service selector: '$arg'" >&2
      print_usage >&2
      exit 1
    fi
    selected+=("$arg")
  done
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed or not in PATH" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not running or not reachable" >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "env file not found: ${ENV_FILE}" >&2
  exit 1
fi

if $BUILD_FIRST; then
  echo "Building selected services: ${selected[*]}"
  build_selected_services "${selected[@]}"
fi

printf "\n%-10s %-40s %12s\n" "SERVICE" "IMAGE" "SIZE"
printf "%-10s %-40s %12s\n" "----------" "----------------------------------------" "------------"

total_bytes=0
found_count=0
for svc in "${selected[@]}"; do
  if ! image_ref="$(find_image_ref_for_service "$svc")"; then
    printf "%-10s %-40s %12s\n" "$svc" "${PROJECT_NAME}-${svc}:latest" "NOT FOUND"
    continue
  fi

  size_bytes="$(docker image inspect "$image_ref" --format '{{.Size}}')"
  size_human="$(to_human "$size_bytes")"
  total_bytes=$((total_bytes + size_bytes))
  found_count=$((found_count + 1))

  printf "%-10s %-40s %12s\n" "$svc" "$image_ref" "$size_human"
done

printf "%-10s %-40s %12s\n" "----------" "----------------------------------------" "------------"
printf "%-10s %-40s %12s\n\n" "TOTAL" "selected-images" "$(to_human "$total_bytes")"

if [[ "$found_count" -eq 0 ]]; then
  echo "No matching local images found. Build first with:"
  echo "  pnpm docker:build"
  echo "or:"
  echo "  pnpm docker:size:build"
fi
