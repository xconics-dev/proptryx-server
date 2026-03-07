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

if $BUILD_FIRST; then
  echo "Building selected services: ${selected[*]}"
  docker compose build "${selected[@]}"
fi

project_name="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')"

printf "\n%-10s %-40s %12s\n" "SERVICE" "IMAGE" "SIZE"
printf "%-10s %-40s %12s\n" "----------" "----------------------------------------" "------------"

total_bytes=0
for svc in "${selected[@]}"; do
  image_ref="${project_name}-${svc}:latest"

  if ! docker image inspect "$image_ref" >/dev/null 2>&1; then
    printf "%-10s %-40s %12s\n" "$svc" "$image_ref" "NOT FOUND"
    continue
  fi

  size_bytes="$(docker image inspect "$image_ref" --format '{{.Size}}')"
  size_human="$(to_human "$size_bytes")"
  total_bytes=$((total_bytes + size_bytes))

  printf "%-10s %-40s %12s\n" "$svc" "$image_ref" "$size_human"
done

printf "%-10s %-40s %12s\n" "----------" "----------------------------------------" "------------"
printf "%-10s %-40s %12s\n\n" "TOTAL" "selected-images" "$(to_human "$total_bytes")"
