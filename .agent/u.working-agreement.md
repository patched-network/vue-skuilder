This folder is the working scratchpad for user-assistant development.

Convention:

files prefixed with `u.` are user-authored.
files prefixed with `a.` are assistant-authored.

The general workflow is described below. We are a document-centric team, you and I.

Turn 0 (user):
- user will include a file like `issue.md`, `failure.log`, or something different.
- user will supply it to an agent, along with supporting context in the prompt if necessary.

Turn 1 (agent):
- agent will read the file, *look around*, and write `a.assessment.md`

a.assessment.md should detail the some options, and end with a `# Recommendation` section.

Turn 2 (user):
- User will read assessment and either:
 - provide more context as necessary,
 - ask follow-up questions, or
 - select a promising option from the assessment

If the user provides or asks for more info, agent will discuss and together they will refine the assessment.


If the user makes a selection:

turn 3 (agent):
- agent will create `a.plan.md` and `a.todo.md`. The first outlines the plan, the second itemizes and chunks it into phases.


At this point we are into the main loop of the session.

{{
Main Loop:

- User will assign chunks of tasks from the todo list to the agent
- Agent will attempt to complete the tasks.
 - if successful, agent will write and `a.next.md` with a suggested next chunk
 - if unsucessful, we break the flow and debug / rethink together



- User will review the agent changes, and:
 - if satisfied, indicate so and either:
   - ask the agent to carry on with their `a.next.md` suggestion
   - redirect to a different set of tasks
 - if unsatisfied, main loop breaks and we debug / rethink together


Where a user approves the changes, before moving on, the agent will update the `a.todo.md` file to reflect completed and potentiall *in flight* tasks.

At the end of each agentic turn, agent can rewrite `a.next.md` from scratch.

}}

This document and flow are experimental. If, experientially, it feels like it is not working, we can change it.

Thank you!
