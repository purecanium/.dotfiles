#!/usr/bin/env bash

# installer.sh - This script installs a policykit rule for the Battery Health Charging gnome-shell extension.
#
# This file is part of the gnome-shell extension Battery-Health-Charging@maniacx.github.com
#
# Authors: Martin Koppehel <psl.kontakt@gmail.com>, Fin Christensen <christensen.fin@gmail.com> (cpupower extension), Deminder <tremminder@gmail.com>
# Original script here https://github.com/Deminder/ShutdownTimer
# Modified by maniacx@github.com

set -e

################################
# EXTENSION SPECIFIC OPTIONS:  #
################################

ACTION_BASE='dem.batteryhealthcharging'
RULE_BASE="$ACTION_BASE.setthreshold"
BHC_BASE='batteryhealthchargingctl'
RESOURCES_DIR='resources'

EXIT_SUCCESS=0
EXIT_ERROR=1
EXIT_PRIVILEGE_REQUIRED=126

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" #stackoverflow 59895

function recent_polkit() {
    local VERSIONS
    printf -v VERSIONS '%s\n%s' "$(pkaction --version | cut -d' ' -f3)" "0.106"
    if [[ $VERSIONS != "$(sort -V <<<"$VERSIONS")" ]]; then
        echo "available"
    else
        echo "unavailable"
    fi
}

function fail() {
    echo "Failed ${1}" >&2 && exit ${EXIT_ERROR}
}
DEFAULT_SUCCESS_MSG="Success"

function success() {
    echo "${1:-$DEFAULT_SUCCESS_MSG}"
}

########################
# GENERALIZED SCRIPT:  #
########################

function usage() {
    echo "Usage: installer.sh [options] {install,update,uninstall}"
    echo
    echo "Available options:"
    echo "  --tool-user USER   Set the user of the tool (default: \$USER)"
    echo
    exit ${EXIT_ERROR}
}

if [ $# -lt 1 ]; then
    usage
fi

ACTION=""
TOOL_USER="$USER"
while [[ $# -gt 0 ]]; do
    key="$1"

    # we have to use command line arguments here as pkexec does not support
    # setting environment variables
    case $key in
        --tool-user)
            TOOL_USER="$2"
            shift
            shift
            ;;
        install | update | uninstall)
            if [ -z "$ACTION" ]; then
                ACTION="$1"
            else
                echo "Too many actions specified. Please give at most 1."
                usage
            fi
            shift
            ;;
        *)
            echo "Unknown argument $key"
            usage
            ;;
    esac
done

BHC_DIR="/usr/local/bin"
RULE_DIR="/etc/polkit-1/rules.d"

RULE_IN="${DIR}/../${RESOURCES_DIR}/10-$RULE_BASE.rules"
if [[ "$(recent_polkit)" != "available" ]]; then
    RULE_IN="${RULE_IN}.legacy"
    ACTION_IN="${DIR}/../${RESOURCES_DIR}/${ACTION_BASE}.policy.in"
fi
TOOL_IN="${DIR}/../${RESOURCES_DIR}/$BHC_BASE"

TOOL_OUT="${BHC_DIR}/${BHC_BASE}-${TOOL_USER}"
RULE_OUT="${RULE_DIR}/10-${RULE_BASE}-${TOOL_USER}.rules"
ACTION_ID="${RULE_BASE}.${TOOL_USER}"
ACTION_OUT="/usr/share/polkit-1/actions/${ACTION_ID}.policy"

function print_policy_xml() {
    sed -e "s:{{PATH}}:${TOOL_OUT}:g" \
        -e "s:{{ACTION_BASE}}:${ACTION_BASE}:g" \
        -e "s:{{ACTION_ID}}:${ACTION_ID}:g" "${ACTION_IN}"
}

function print_rules_javascript() {
    if [[ "$RULE_IN" == *.legacy ]]; then
        sed -e "s:{{RULE_BASE}}:${RULE_BASE}:g" "${RULE_IN}"
    else
        sed -e "s:{{TOOL_OUT}}:${TOOL_OUT}:g" \
            -e "s:{{TOOL_USER}}:${TOOL_USER}:g" "${RULE_IN}"
    fi

}

TOOL_NAME=$(basename ${TOOL_OUT})

if [ "$ACTION" = "install" ]; then
    if [ "${EUID}" -ne 0 ]; then
        echo "The install action must be run as root for security reasons!"
        echo "Please have a look at https://github.com/martin31821/cpupower/issues/102"
        echo "for further details."
        exit ${EXIT_PRIVILEGE_REQUIRED}
    fi

    echo -n "Installing ${TOOL_NAME} tool... "
    mkdir -p "${BHC_DIR}"
    install "${TOOL_IN}" "${TOOL_OUT}" || fail
    success

    if [ ! -z "$ACTION_IN" ]; then
        echo "Using legacy policykit install..."
        echo -n "Installing policykit action..."
        (print_policy_xml >"${ACTION_OUT}" 2>/dev/null && chmod 0644 "${ACTION_OUT}") || fail
        success
    fi

    echo -n "Installing policykit rule..."
    mkdir -p "${RULE_DIR}"
    (print_rules_javascript >"${RULE_OUT}" 2>/dev/null && chmod 0644 "${RULE_OUT}") || fail
    success

    exit ${EXIT_SUCCESS}
fi

if [ "$ACTION" = "update" ]; then
    "${BASH_SOURCE[0]}" --tool-user "${TOOL_USER}" uninstall || exit $?
    "${BASH_SOURCE[0]}" --tool-user "${TOOL_USER}" install || exit $?

    exit ${EXIT_SUCCESS}
fi

if [ "$ACTION" = "uninstall" ]; then
    if [ -f "$ACTION_OUT" ]; then
        # remove legacy "policykit action" install
        echo -n "Uninstalling policykit action..."
        rm "${ACTION_OUT}" || fail " - "cannot remove" ${ACTION_OUT}" && success
    fi
    echo -n "Uninstalling ${TOOL_NAME} tool... "
    if [ -f "${TOOL_OUT}" ]; then
        rm "${TOOL_OUT}" || fail " - cannot remove ${TOOL_OUT}" && success
    else
        echo "tool not installed at ${TOOL_OUT}"
    fi

    echo -n "Uninstalling policykit rule... "
    if [ -f "${RULE_OUT}" ]; then
        rm "${RULE_OUT}" || fail " - cannot remove ${RULE_OUT}" && success
    else
        echo "policy rule not installed at ${RULE_OUT}"
    fi

    exit ${EXIT_SUCCESS}
fi

echo "Unknown parameter."
usage
