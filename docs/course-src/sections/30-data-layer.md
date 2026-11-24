---
section: data-layer
title: Data layer
pages: learn/data-layer, skuilder.json
---

## intro data-layer-intro

**Everything goes through data-layer interfaces**, with two implementations:

- **couch**: CouchDB + PouchDB. Accounts, sync, live card ratings.
- **static**: JSON from any host; learner data in the browser. This course is static.

[Read: Data Layer](/vue-skuilder/learn/data-layer.html)

## card dl-two elo=1000

The data layer's two implementations, chosen by `type` at startup, are {{couch and static||sql and nosql|local and remote}}.

## card dl-static-elo elo=1080

In a static deployment, card ratings are {{frozen at pack time||updated from every learner's answers}}.

## card dl-static-user elo=1040

With the static data layer, a learner's history, reviews and ratings persist {{in that browser only||across devices, via sync}}.

## card dl-static-pipeline elo=1100

Because its strategy documents are packed with it, a static course {{runs the same navigation pipeline as a live one||falls back to random card order}}.

## card dl-strategy-docs elo=1060

Navigation strategies are stored as {{documents in the course database||code in the app bundle only|rows in a config file}}, each naming an implementing class and its config.

## card dl-localsync elo=1140

On CouchDB, a course can opt in to `localSync`, where the app {{copies the course into the browser and reads from the copy||caches only the current session's cards}}.

## card dl-root-manifest elo=1120

A static app's root `skuilder.json` maps course names to URLs, and those URLs {{may point at another site||must be on the same origin}}.
