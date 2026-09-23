#!/usr/bin/env bash
# ==============================================================================
# Script: hitung-cepat.sh
# Purpose: Build, Push, Run locally, and Deploy to Kubernetes via Helm
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# ------------------------------------------------------------------------------
# Environment Variables & Default Configurations
# ------------------------------------------------------------------------------
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker-hub.solusi-k8s.com}"
DOCKER_USER="${DOCKER_USER:-myindo}"
DOCKER_IMAGE="${DOCKER_IMAGE:-hitung-cepat-web}"
JAR_VERSION="${JAR_VERSION:-v1.0.1}"

# Resolve DOCKER_VERSION dynamically if not provided
if [ -z "${DOCKER_VERSION}" ]; then
  if command -v git-buildnumber >/dev/null 2>&1; then
    DOCKER_VERSION="v$(git-buildnumber)"
  elif [ -x "/home/cachak/bin/git-buildnumber" ]; then
    DOCKER_VERSION="v$(/home/cachak/bin/git-buildnumber)"
  else
    DOCKER_VERSION="v1.0.1"
  fi
fi

APPLICATION_NAME="${APPLICATION_NAME:-hitung-cepat-web}"
HELM_NAME="${HELM_NAME:-hitung-cepat-web}"
HELM_NS="${HELM_NS:-hitung-cepat}"
HELM_ENV="${HELM_ENV:-production}"
HELM_VALUES="${HELM_VALUES:-values-hitung-cepat-web.yaml}"
K8S_CLUSTER="${K8S_CLUSTER:-htz-k8s}"
HELM_REPO="${HELM_REPO:-oci://registry-1.docker.io/solusik8s}"
HELM_CHART="${HELM_CHART:-myindo}"
HELM_VERSION="${HELM_VERSION:-1.0.4}"

# Resolve target KUBECONFIG (defaults to ~/.kube/htz-k8s.yml as specified for htz-k8s cluster)
DEFAULT_KUBECONFIG="$HOME/.kube/htz-k8s.yml"
if [ -n "${KUBECONFIG_FILE}" ]; then
  KUBECONFIG="${KUBECONFIG_FILE}"
elif [ -f "${DEFAULT_KUBECONFIG}" ]; then
  KUBECONFIG="${DEFAULT_KUBECONFIG}"
else
  KUBECONFIG="${KUBECONFIG:-$DEFAULT_KUBECONFIG}"
fi

FULL_IMAGE="${DOCKER_REGISTRY}/${DOCKER_USER}/${DOCKER_IMAGE}:${DOCKER_VERSION}"

# Export environment variables for docker compose interpolation
export DOCKER_REGISTRY
export DOCKER_USER
export DOCKER_IMAGE
export JAR_VERSION
export DOCKER_VERSION
export APPLICATION_NAME

# ------------------------------------------------------------------------------
# Output Logging Utilities
# ------------------------------------------------------------------------------
log_info() {
  echo -e "\033[1;34m[INFO]\033[0m $*"
}

log_success() {
  echo -e "\033[1;32m[SUCCESS]\033[0m $*"
}

log_warn() {
  echo -e "\033[1;33m[WARN]\033[0m $*"
}

log_error() {
  echo -e "\033[1;31m[ERROR]\033[0m $*" >&2
}

print_header() {
  echo -e "\033[1;36m============================================================\033[0m"
  echo -e "\033[1;36m Hitung Cepat — CI/CD & Local Runner Utility\033[0m"
  echo -e "\033[1;36m============================================================\033[0m"
  echo " Image:        ${FULL_IMAGE}"
  echo " Helm Release: ${HELM_NAME} (chart: ${HELM_REPO}/${HELM_CHART}:${HELM_VERSION})"
  echo " Namespace:    ${HELM_NS}"
  echo " Values File:  ${HELM_VALUES}"
  echo " Kubeconfig:   ${KUBECONFIG}"
  echo -e "\033[1;36m============================================================\033[0m"
}

# ------------------------------------------------------------------------------
# Action Functions
# ------------------------------------------------------------------------------
do_build() {
  log_info "Starting Docker build using docker-compose.yml..."
  log_info "Target image: ${FULL_IMAGE}"

  # Ensure external network 'myindo-net' exists for docker-compose.yml
  if ! docker network inspect myindo-net >/dev/null 2>&1; then
    log_info "Network 'myindo-net' not found. Creating network..."
    docker network create myindo-net || true
  fi

  docker compose -f docker-compose.yml build
  log_success "Docker build completed successfully: ${FULL_IMAGE}"
}

do_push() {
  log_info "Pushing Docker image to registry..."
  log_info "Image: ${FULL_IMAGE}"
  docker push "${FULL_IMAGE}"
  log_success "Image pushed successfully: ${FULL_IMAGE}"
}

do_run() {
  log_info "Running container locally using docker-compose-loc.yml..."
  log_info "Image: ${FULL_IMAGE}"

  docker compose -f docker-compose-loc.yml up -d --remove-orphans
  log_success "Container started in background (detached)."
  log_info "Container status:"
  docker compose -f docker-compose-loc.yml ps
  log_info "Access local app at: http://localhost:3000"
}

do_stop() {
  log_info "Stopping local container..."
  docker compose -f docker-compose-loc.yml down --remove-orphans
  log_success "Local container stopped and removed."
}

do_deploy() {
  log_info "Deploying to Kubernetes via Helm..."
  log_info "Cluster:    ${K8S_CLUSTER}"
  log_info "Namespace:  ${HELM_NS}"
  log_info "Release:    ${HELM_NAME}"
  log_info "Chart:      ${HELM_REPO}/${HELM_CHART}:${HELM_VERSION}"
  log_info "Image Tag:  ${DOCKER_VERSION}"

  if ! command -v helm >/dev/null 2>&1; then
    log_error "'helm' binary not found in PATH."
    exit 1
  fi

  if [ ! -f "${HELM_VALUES}" ]; then
    if [ -f "values-hitung-cepat-web-prod.yaml" ]; then
      log_warn "Values file '${HELM_VALUES}' not found, falling back to 'values-hitung-cepat-web-prod.yaml'"
      HELM_VALUES="values-hitung-cepat-web-prod.yaml"
    else
      log_error "Values file '${HELM_VALUES}' does not exist."
      exit 1
    fi
  fi

  if [ ! -f "${KUBECONFIG}" ]; then
    log_warn "Kubeconfig not found at '${KUBECONFIG}'. Make sure your Kubernetes context is configured."
  fi

  KUBECONFIG="${KUBECONFIG}" helm upgrade --install "${HELM_NAME}" "${HELM_REPO}/${HELM_CHART}" \
    --set nameOverride="${HELM_NAME}" \
    --set fullnameOverride="${HELM_NAME}" \
    --version "${HELM_VERSION}" \
    --set image.repository="${DOCKER_REGISTRY}/${DOCKER_USER}/${DOCKER_IMAGE}" \
    --set image.tag="${DOCKER_VERSION}" \
    --namespace "${HELM_NS}" \
    --values "${HELM_VALUES}"

  log_success "Helm deployment executed successfully for ${HELM_NAME} (${DOCKER_VERSION})."
}

print_help() {
  print_header
  echo "Usage: ./hitung-cepat.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  build [--push] [--deploy]  Build image via docker-compose.yml"
  echo "                               --push    : push image to registry right after build"
  echo "                               --deploy  : deploy to k8s via helm right after build/push"
  echo "  push                       Push built image (${FULL_IMAGE}) to registry"
  echo "  run                        Run built image locally with docker-compose-loc.yml"
  echo "  stop                       Stop local containers started by docker-compose-loc.yml"
  echo "  deploy                     Deploy release to k8s via helm upgrade --install"
  echo "  help                       Show this help menu"
  echo ""
  echo "Examples:"
  echo "  ./hitung-cepat.sh build"
  echo "  ./hitung-cepat.sh build --push"
  echo "  ./hitung-cepat.sh build --push --deploy"
  echo "  ./hitung-cepat.sh push"
  echo "  ./hitung-cepat.sh run"
  echo "  ./hitung-cepat.sh stop"
  echo "  ./hitung-cepat.sh deploy"
}

# ------------------------------------------------------------------------------
# Entrypoint Router
# ------------------------------------------------------------------------------
CMD="$1"
shift || true

case "${CMD}" in
  build)
    AUTO_PUSH=false
    AUTO_DEPLOY=false
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --push)
          AUTO_PUSH=true
          ;;
        --deploy)
          AUTO_DEPLOY=true
          ;;
        *)
          log_warn "Unknown option for build: $1"
          ;;
      esac
      shift
    done

    print_header
    do_build
    if [ "${AUTO_PUSH}" = true ]; then
      do_push
    fi
    if [ "${AUTO_DEPLOY}" = true ]; then
      if [ "${AUTO_PUSH}" = false ]; then
        log_info "Auto-deploy requested without explicit --push; pushing image first..."
        do_push
      fi
      do_deploy
    fi
    ;;

  push)
    print_header
    do_push
    ;;

  run)
    print_header
    do_run
    ;;

  stop)
    print_header
    do_stop
    ;;

  deploy)
    print_header
    do_deploy
    ;;

  help|-h|--help|"")
    print_help
    ;;

  *)
    log_error "Unknown command: ${CMD}"
    echo ""
    print_help
    exit 1
    ;;
esac
