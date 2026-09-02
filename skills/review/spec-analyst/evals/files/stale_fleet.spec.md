# Gateway Grouping Specification

**Date:** 2026-05-02
**Status:** Active

## Purpose

Defines how gateways are grouped for tenancy and quota purposes.

## Requirements

### Requirement: Fleet Membership

Every Gateway SHALL belong to exactly one Fleet, identified by `fleet_id`. The
control plane SHALL reject a Gateway whose `fleet_id` does not reference an
existing Fleet.

### Requirement: Sector Assignment

A Fleet SHALL be assigned to a Sector, and quota SHALL be enforced per Sector.
