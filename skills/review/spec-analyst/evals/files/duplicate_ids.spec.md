# Gateway Console Foundations Specification

**Date:** 2026-08-25
**Status:** Active
**Applies to:** web-console

## Purpose

Foundational UI requirements for the gateway management console.

## Requirements

### Requirement UI-FND-01: Empty State

The gateway list SHALL render a distinct empty state when no gateways exist.

**Verification:** Load the list with zero gateways; confirm the empty-state
component renders with a create action.

### Requirement UI-FND-01: Loading State

The gateway list SHALL render a skeleton loading state while the first page of
gateways is being fetched.

**Verification:** Throttle the network; confirm the skeleton renders before data.

### Requirement UI-FND-03: Error State

The gateway list SHALL render a recoverable error state with a retry action when
the fetch fails.

**Verification:** Force a fetch failure; confirm the error state and retry.
