# AI Market Observatory — Public Site

Public, read-only presentation layer for the AI Market Observatory.

- Canonical data and collection logic remain in a separate private repository.
- This repository contains only static frontend assets and a sanitized derived snapshot.
- `data/snapshot.json` is refreshed by the existing daily ChatGPT Scheduled Task after canonical collection/materialization.
- No secrets, collector envelopes, private repository internals, or raw observation history are published here.

The website is intentionally static: HTML, CSS, JavaScript and one generated JSON snapshot.
