This folder is the working scratchpad for document-centric user+assistant development.

# Available Local Documentation

The folder `./agent/docs-vendoring` contains reference material for some libraries and tools used by this project. Currently: `vitepress` (docs site), `couchdb` (main auth and application data backend).

# Conventions

## Organization

Working sessions will usually be focused on a session-directory. Either a numbered directory (referring to a gh issue) or a directory named for the task at hand. New working documents should be created in this directory, and named according to the conventions below. For GH issues, please *do* use the `gh` command to *read* existing issues, PRs, and workflow runs.

## File namespacing

files prefixed with `u.` are user-authored.
files prefixed with `a.` are assistant-authored.

assistant-authored files should be sequenced, so that the progression of thoughts (and plan revisions) remains legible. - eg, create `a.1.assessment.md` `a.2.plan.md` `a.3.todo.md`, or whatever working documents are required.

## Precedence

When performing actions, planning or instructions from *later* documents take precidence over earlier ones.

Other files in the directory are sourced as general context or informtion relevant to the current mission.

## User Annotations

The user will annotate / edit assistant files in order to specifically direct feedback to the assistant's work.

User annotations will either be prefixed lines like this:
>>> this is a user inserted comment

or block multiline comments like this:

>>>
This is also a user comment.

It's closed by reverse chevrons.
<<<


Where there are numbered directories in this folder, these correspond to github issues. Feel free also to use `gh` cli to reference the issue itself if need be.

# General Expected Workflow

We are a document-centric team, you and I. We create working documents in stages assess-plan-do

## Assess

Turn 0 (user):
- user will include a file like `issue.md`, `failure.log`, or something different.
- user will supply it to an assistant, along with supporting context in the prompt if necessary.

Turn 1 (assistant):
- assistant will read the prompt and supplied files, *look around*, and write `a.assessment.md`

a.assessment.md should detail some options, and end with a `# Recommendation` section.

Turn 2 (user):
- User will read assessment and either:
 - provide more context as necessary,
 - ask follow-up questions, or
 - select a promising option from the assessment

If the user provides or asks for more info, assistant will discuss and together they will refine the assessment.

## Plan

If the user makes a selection:

turn 3 (assistant):
- creates `a.plan.md`
- the plan file should
  - 'narrow in' on the selected approach
  - optionally, include some rationale for the specific selected approach surfaced from the back-and-forth during assessment
  - make specific reference to existing source code to be modified (eg, filenames, method names), or new files to be created
  - define success criteria
  - enumerate known risks
  - separate implementation tasks, testing tasks, and administrative tasks (eg, documentation updates)
- the plan file should not
  - contain large amounts of implementation (tokens don't grow on trees.)
  - contain large amounts of redunany information from the

turn 4 (user):
- assesses the plan
- provides feedback or seeks clarification either in chat or via inlined comments
- either: approves and requests a todo document, or, loops back to assessment phase to consider other options

turn 5 (assistant):
- creates `a.todo.md`
- the todo doc should
  - itemize and chunk the plan into phases
  - be 'addressable' as in p1.2 (phase one, task 2)
  - optionally, be nested down as far as, eg, p1.3.2, but not further
  - [ ] be written checkbox style
- the todo doc should not
  - contain large amounts of repeated information from prior docs

As a very rough guide, assistant should attempt to size 'phases' as chunks of work that it expects it can complete independently in a single 'turn'

## Do

At this point we are into the main loop of the session.

{{
Main Loop:

- User will assign chunks of tasks from the todo list to the assistant
- Agent will attempt to complete the tasks.
- after the attempt, agent updates the todo doc in-place.
  - completed items should be checked off
  - where relevant, blockers or new information surfaced during the attempt can
  - larger headings (eg, for phases) can be annotated with status markers (eg, COMPLETED, NEXT, IN-PROGRESS, BLOCKED)

- User will review the assistant changes, and:
 - if satisfied, indicate so and either:
   - ask the assistant to carry on with their `a.next.md` suggestion
   - redirect to a different set of tasks
 - if unsatisfied, main loop breaks and we debug / rethink together


Where a user approves the changes, before moving on, the assistant will update the `a.todo.md` file to reflect completed and potentiall *in flight* tasks.

At the end of each agentic turn, assistant can rewrite `a.next.md` from scratch.

}}

# General Notes

## Task Focus

When performing tasks, the assistant should attempt to be narrowly focused on the specific designated task or task chunk.

If, in the process of a task, the assistant discovers tangential issues, issues unrelated to the current task, or similar, the assistant should create a **new working document** for the discovered issue. The created working document should have a title roughly in the format of `a.aside.<category>.<title>.md`.

eg: `a.aside.perf.many-round-trips-in-reviews-lookup.md`, `a.aside.security.addCourse-endpoint-not-authenticated.md`, etc.

The agent should expect the user to review these asides async to the current main workflow.

## Durable vs Ephemeral Content

In conversational flow and working documents, it can be useful to 'refer back' to the context of discussion.

But when writing source code, documentation, or other 'durable' content, please refrain from leaving conversational notes that are particular to the current moment. The below diff illustrates an example of poor behaviour in this respect. The inserted comment informs the current reader of the diff - ok - but it is just noise for future readers of the file.

```diff - poor example
       85 -      // Create course database connection
       86 -      const courseDbUrl = `${dbUrl}/${dbName}`;
       85 +      // courseDbUrl is already defined above
```

```diff - preferred
       85 -      // Create course database connection
       86 -      const courseDbUrl = `${dbUrl}/${dbName}`;
```

# Coda

This document and flow are experimental. If, experientially, it feels like it is not working, we can change it. Open to suggestions!

Thank you!
