#!/usr/bin/env bash
set -euo pipefail

SERVICES=(gateway auth property)
BUILD_FIRST=false

print_usage() {
  cat <<'USAGE'
Usage:
  scripts/docker-image-size.sh [--build] [all|gateway|auth|property ...]

Examples:
  pnpm docker:size
  pnpm docker:size -- all
  pnpm docker:size -- gateway auth
  pnpm docker:size:build -- property
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

find_image_ref_for_service() {
  local svc="$1"
  local expected_repo="${project_name}-${svc}"
  local ref=""

  # 1) Preferred exact default compose tag
  if docker image inspect "${expected_repo}:latest" >/dev/null 2>&1; then
    echo "${expected_repo}:latest"
    return 0
  fi

  # 2) Any tag for expected compose repo
  ref="$(
    docker image ls --format '{{.Repository}}:{{.Tag}}' \
      | awk -v repo="${expected_repo}" -F: '$1 == repo && $2 != "<none>" { print $0; exit }'
  )"
  if [[ -n "$ref" ]]; then
    echo "$ref"
    return 0
  fi

  # 3) Fallback: any repo that ends with "-<service>" (helps with custom project names)
  ref="$(
    docker image ls --format '{{.Repository}}:{{.Tag}}' \
      | awk -v suffix="-${svc}" -F: 'index($1, suffix) > 0 && $2 != "<none>" { print $0; exit }'
  )"
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

if $BUILD_FIRST; then
  echo "Building selected services: ${selected[*]}"
  docker compose build "${selected[@]}"
fi

project_name="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')"

printf "\n%-10s %-40s %12s\n" "SERVICE" "IMAGE" "SIZE"
printf "%-10s %-40s %12s\n" "----------" "----------------------------------------" "------------"

total_bytes=0
found_count=0
for svc in "${selected[@]}"; do
  if ! image_ref="$(find_image_ref_for_service "$svc")"; then
    printf "%-10s %-40s %12s\n" "$svc" "${project_name}-${svc}:latest" "NOT FOUND"
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
