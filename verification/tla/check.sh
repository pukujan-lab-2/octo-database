#!/usr/bin/env bash
# Runs TLC on every model and compares each exit code with the expected one.
# 0 = no violation, 12 = an invariant fails. An expected 12 is either a known
# finding in the code or a negative control that shows the model can fail.
# TLA2TOOLS points at tla2tools.jar.
set -euo pipefail
cd "$(dirname "$0")"
jar="${TLA2TOOLS:?set TLA2TOOLS to the path of tla2tools.jar}"

expectations=(
  "WorkspaceProvisioning WorkspaceProvisioning 0"
  "WorkspaceProvisioning WorkspaceProvisioningOrphan 12"   # finding: a losing request leaves its database
  "WorkspaceProvisioning WorkspaceProvisioningCleanup 0"
  "FileLifecycle FileLifecycleNoHash 12"                    # negative control: without the hash, restore overwrites good R2 bytes
  "FileLifecycle FileLifecycle 0"
  "FileLifecycle FileLifecycleJobsOnly 0"
  "FileLifecycle FileLifecycleOnDemandRace 12"             # finding: archive drops bytes a download just restored
  "FileLifecycle FileLifecycleNoVerify 12"                 # negative control
  "KeyRevocation KeyRevocation 0"
  "KeyRevocation KeyRevocationInFlight 12"                 # finding: in-flight requests finish after revoke
  "PhoenixGate PhoenixGate 0"
  "PhoenixGate PhoenixGateInFlight 12"                     # finding: a request that passed the check still forwards after a demotion or expiry
  "PhoenixGate PhoenixGateNoCheck 12"                      # negative control: without forward_auth the admin token goes to anyone
  "PhoenixGate PhoenixGateNoOwnerRecheck 12"               # negative control: a demoted owner's cookie would keep working
  "ToolScope ToolScope 0"
  "ToolScope ToolScopeListOnly 12"                         # negative control: relying on the tool list alone lets a narrowed key write
)

meta="$(mktemp -d)"
trap 'rm -rf "$meta"' EXIT
failed=0
for line in "${expectations[@]}"; do
  read -r spec cfg want <<<"$line"
  set +e
  java -XX:+UseParallelGC -cp "$jar" tlc2.TLC -workers auto -cleanup \
    -metadir "$meta/$cfg" -config "$cfg.cfg" "$spec.tla" >"$meta/$cfg.log" 2>&1
  got=$?
  set -e
  if [ "$got" = "$want" ]; then
    echo "ok    $cfg (exit $got)"
  else
    echo "FAIL  $cfg: expected exit $want, got $got"
    tail -40 "$meta/$cfg.log"
    failed=1
  fi
done
exit "$failed"
