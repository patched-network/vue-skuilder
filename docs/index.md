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
    details: <strong><em>Whatever</em></strong> you like. MIDI keyboards, chess boards, typing games. Sky's the limit.<br><br/>Custom cards are vue components + a grading implementation.
  - title: Adaptive and Pluggable <a href="learn/pedagogy">Pedagogy</a>
    # details: "ELO ratings for learners and cards, globally and per skill. Spaced repetition. A pipeline of generators and filters you can extend, which explains every card it picks."
    details: "Flexible content pipeline that runs <strong>either</strong> a chosen learning protocol (eg, <em>SRS</em> or <em>Elo dynamic difficulty sorting</em>), or a competitive mixture of several. Define and inject course-specific protocols as well."
  - title: Local First, Platform <a href="learn/data-layer">Capable</a>
    details: Run against CouchDB with accounts and sync, or ship a course as static files with learner data kept in the browser.
  - title: Agents <a href="do/mcp">Welcome</a> <small>(but not required!)</small>
    details: An <strong>MCP</strong> server exposes a course to agents for content authoring and inspection.
---
