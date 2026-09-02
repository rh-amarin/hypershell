# Gateway Routing Specification

**Date:** 2026-08-16
**Status:** Active
**Related:** contradiction_a.spec.md

## Purpose

Defines how traffic is routed to a gateway's external exposure.

## Requirements

### Requirement: Default Route Target Port

When a routed Gateway does not specify an `exposurePort`, the control plane SHALL
program the external route to target port `9090`.

#### Scenario: Route programmed for a gateway without an explicit port

- GIVEN a routed Gateway with no `exposurePort` set
- WHEN the control plane programs its external route
- THEN the route SHALL target port `9090`
