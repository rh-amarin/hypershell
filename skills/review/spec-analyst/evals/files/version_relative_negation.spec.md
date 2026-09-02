# Gateway Data Contract Specification

**Date:** 2026-08-30
**Status:** Active

## Purpose

Defines the create and update request contracts for the Gateway resource and the
handling of credential material.

## Requirements

### Requirement: No Fleet Field

The Gateway create and update contracts SHALL NOT include a `fleet_id` field.

### Requirement: Credential Confidentiality

The API server SHALL NOT log credential values, tokens, or signing secrets in any
log line or error response.

### Requirement: Legacy Fleet Input Rejection

Until the 2026-12-01 compatibility window closes, to reject the removed Fleet
grouping, the API server SHALL reject any create or update request that carries a
`fleet_id` field with an HTTP 400 and a message naming the removed field, and
SHALL record a deprecation metric so remaining callers can be identified.
