---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "vue-skuilder"
  tagline: "AGPL toolkit for adaptive tutoring systems"
  actions:
    - theme: brand
      text: What is Skuilder?
      link: introduction
    - theme: alt
      text: Dev Quickstart
      link: do/quickstart
    - theme: alt
      text: GitHub
      link: https://github.com/patched-network/vue-skuilder

features:
  - title: Fully <a href="extend/custom-cards">Extensible</a> Flash Cards
    details: A card is a Vue component plus a small class that grades it. Build <strong><em>whatever</em></strong> you like. MIDI keyboards, chess boards, typing games.
  - title: Adaptive and Pluggable <a href="learn/pedagogy">Pedagogy</a>
    details: "ELO ratings for learners and cards, globally and per skill. Spaced repetition. A pipeline of generators and filters you can extend, which explains every card it picks."
  - title: Local First, Platform <a href="learn/data-layer">Capable</a>
    details: Run against CouchDB with accounts and sync, or ship a course as static files with learner data kept in the browser.
  - title: Agents <a href="do/mcp">Welcome</a> <small>(but not required!)</small>
    details: An <strong>MCP</strong> server exposes a course to agents for content authoring and inspection.
---
