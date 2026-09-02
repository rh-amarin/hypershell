# Gateway Secret Rotation Specification

**Date:** 2026-08-28
**Status:** Active
**Related:** openshell-gateway-credentials.spec.md

## Purpose

Defines how a gateway's signing secret is rotated without interrupting traffic.

## Requirements

### Requirement: Scheduled Rotation

The control plane SHALL rotate a gateway's signing secret every 90 days by
generating a new secret version and updating the gateway Deployment to reference
it.

#### Scenario: Secret reaches rotation age

- GIVEN a running Gateway whose current signing secret is 90 days old
- WHEN the control plane reconciles the Gateway
- THEN the control plane SHALL create a new signing secret version
- AND it SHALL update the Deployment to reference the new version
- AND it SHALL retain the previous version until the rollout completes

### Requirement: Rotation Failure Is Non-Destructive

If secret generation fails, the control plane SHALL keep the existing secret in
place and SHALL set the Gateway `phase` to `Degraded` with a reason.

#### Scenario: Secret generation fails during rotation

- GIVEN a running Gateway due for rotation
- WHEN secret generation returns an error
- THEN the control plane SHALL leave the existing secret unchanged
- AND it SHALL set `phase` to `Degraded`
