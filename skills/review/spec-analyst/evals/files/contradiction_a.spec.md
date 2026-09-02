# Gateway Exposure Port Specification

**Date:** 2026-08-14
**Status:** Active

## Purpose

Defines the external exposure port for a routed gateway.

## Requirements

### Requirement: Default Exposure Port

A routed gateway SHALL be exposed on external port `8080` by default when the
Gateway resource does not specify an `exposurePort`.

#### Scenario: Gateway created without an explicit port

- GIVEN a routed Gateway with no `exposurePort` set
- WHEN the control plane reconciles it
- THEN the gateway SHALL be exposed on port `8080`
