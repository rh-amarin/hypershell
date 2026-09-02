# Gateway Provisioning Specification

**Date:** 2026-06-15
**Status:** Active

## Purpose

Defines how a Gateway is provisioned onto a ManagedCluster and how its listener
port is chosen.

## Requirements

### Requirement: Listener Port Selection

The control plane SHALL assign each Gateway a listener port from the cluster's
allocatable range and SHALL reject provisioning if the range is exhausted, to
avoid two Gateways binding the same port on one node.

#### Scenario: Range exhausted

- GIVEN a ManagedCluster whose allocatable port range is fully assigned
- WHEN the control plane provisions a new Gateway
- THEN it SHALL reject provisioning with a reason naming the exhausted range

## Design Decisions

| Decision | Rationale | Alternatives considered |
|----------|-----------|-------------------------|
| Ports allocated per-cluster, not per-fleet | Fleet grouping was removed; per-cluster keeps allocation local | Global port registry (rejected: single point of contention) |
| Listener range defaults to 30000-32767 | Matches the NodePort range operators already reserve | Random high ports (rejected: firewall churn) |
| Team agreed to drop mTLS between control plane and gateway for v1 | Shared cluster trust domain deemed sufficient | mTLS everywhere (deferred to a later hardening pass) |

## History

An earlier model provisioned Gateways under a Fleet; the `fleet_id` column has
been removed and provisioning is now cluster-scoped. Removed: the
`GatewayFleetBinding` resource that previously linked the two.

## KEK Rotation (Deferred)

Rotation of the key-encryption-key is out of scope for v1. A follow-up is
expected to cover HYPERSHELL-16, adding a Day-2 rotation workflow with a
dual-write window, re-encryption of stored data keys, and an operator-triggered
rollback path. This section sketches the intended design for that future work.
