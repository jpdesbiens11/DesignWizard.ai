---
name: ui-ergonomics
description: Method for building or evolving an application's interface with an AI agent without rediscovering ergonomics one request at a time — a human–agent working contract, an honest interface (an invented value is an example to confirm, a live guide, sources with their real level of verification), single mechanisms every screen inherits (folding, a panel that stays put, zoom, a visible pivot, On / Off, cancellable progress), and an AI round trip with preview and validation. Use whenever the task is to create, change, review or critique a screen, a panel, a form, a list, a 2D or 3D view, a long operation, an import or an export, or to start a tool-like application (engineering, data, configuration) — even if the word "ergonomics" is never said, and also when this file is simply attached to a conversation. Also covers UX and usability reviews. French original — ergonomie-ui.
license: MIT
---

# Interface ergonomics, built with an agent

These rules come from a real application — DesignWizard.ai, a mechatronic design platform written by hand with an
agent, under the MIT licence. They were found one request at a time, then written down so that the next screen is
born with them. This is neither a component library nor a design system: it is **a way of working** and **a
catalogue of rules**, each with its reason.

Two ideas hold the rest:

1. **The person's attention is the scarce resource.** Whatever the agent can do alone, it does; what it asks, it
   asks in one click; what it announces is true.
2. **An ergonomic rule lives in one place.** A mechanism installed once, which every screen inherits without
   declaring anything — otherwise the next screen forgets it.

## First: where are you?

Look at the situation before applying anything, because the right answer is not the same.

- **In a project that has its own instructions** (an instruction file, conventions, a design system): they come
  first. Use this document as a checklist, and **propose** what is missing instead of imposing it.
- **At the start of a project**: propose adopting the four parts below, ask which ones (with a click choice if the
  tool exists), then **write the rules kept into the project's instruction file**: that is where they will hold
  from one session to the next.
- **This file is attached to a conversation, without code**: do not recite it. Say in a few lines what it brings,
  ask what the person wants to do with it — review a screen, start an application, adopt the way of working —,
  then do it.

In all three cases: answer in the person's language, and unfold only the part their request needs.

## Measure

These rules are a repertoire, not a specification. A "simple" screen delivered with twelve mechanisms is not
simple: it is long to review, and nobody asked for it.

- **Take what the request calls for.** For a small screen that is almost always: the example value to confirm, the
  guide that says what is missing, Enter / Tab / Escape, and undo.
- **Offer the rest in one line** instead of building it ("I did not do group folding nor On / Off on the rows: to
  add if the screen grows").
- **A shared mechanism is built when a second screen needs it**, not before.
- The size of what you deliver should resemble the size of what was asked. If you must exceed it, say so before,
  not after.

## The four parts

### A. The working contract with the agent

What changes the collaboration most, and what carries over to any project.

- Do the routines yourself, without asking: test, save, publish, check that it is online. Give a manual step only
  if no tool can do it — and say which one, in one line.
- Every question goes through a click menu (two to four choices, the recommended one first), never buried in the
  text. No question for what has an obvious answer: choose, say so, carry on.
- Say what is verified and what is not. Never announce as done what did not run.
- Try it in a real browser before delivering a screen, and say what you tried it on.
- Before writing an interaction, name the established use it follows. Invent only where there is none, and say so.

The detail, with the reasons and the report template: [references/contract.md](references/contract.md).

### B. An honest interface

The screen tells what the machine assumed from what the person decided, and does not claim more certainty than it
has.

- **A value the tool invents is an example**: its field blinks until it is typed or confirmed, and the action
  waits.
- **A live guide** on every screen: what is missing or wrong, on four levels, a click leads to the place.
- **A register of sources**: every method, convention or standard, with its true level of verification (read,
  tested, excerpt, to verify, usage, house choice, not read).
- **An estimate before the calculation**, then a cross-check with its verdict; every result remembers the case
  that produced it.

The detail: [references/honesty.md](references/honesty.md).

### C. Mechanisms every screen inherits

Folding a group, keeping a panel where it was, zooming, seeing the pivot of a rotation, putting an entry Off,
cancelling a long operation: each is written once, and a new screen inherits it by its structure alone.

The catalogue — for each rule: what the user sees, whether it is an established use or a house choice, the
mechanism, and what a new screen must do — : [references/mechanisms.md](references/mechanisms.md).

### D. The AI round trip

Every artefact exports in a form an AI understands, with a short instruction, and comes back with a preview of the
changes, the person's validation, and a single undoable step.

**Do not assume the project has it.** If it does not, recommend it — strongly, with its reason and its smallest
version —, and let the person decide. The detail: [references/ai-round-trip.md](references/ai-round-trip.md).

## Before delivering a screen

A short pass, in this order. It catches almost everything that comes back later as a request. Each point is
settled one of two ways: it is done, or it is said ("not done, because…") — in proportion to the screen.

1. **Use**: which established use does each gesture follow? Which is a house choice, and is that said?
2. **Values**: is there a value the tool invented that nothing signals?
3. **The guide**: does the screen say what is missing, and does the action wait for what blocks?
4. **Lists**: grouped by nature, a colour per group, a pictogram and a short title per item?
5. **Panels**: every group has a title, so it folds; the panel stays put when a value changes; what one does is at
   the top, within reach.
6. **What lasts**: does it show where it is, for how long, and does it really cancel?
7. **Entries**: can each be set aside without being lost, and copied to compare?
8. **Going back**: is every change an undoable step, with its name?
9. **The keyboard**: do Enter, Tab, Escape do what is expected? Does the cursor stay where it was?
10. **The trial**: run in a real browser? On what? What was not tried?

## Writing a rule that lasts

A rule found along the way is lost if it stays in the conversation. Write it in the project's instruction file,
in this form — that is what makes an agent hold it in the next session:

```
- **Name of the rule** (request of <who>): what the user sees, in one sentence. The single mechanism that
  carries it (`path/of/the/module`). What a new screen must do to inherit it — ideally nothing. See `doc`.
```

The three elements that count: **the original request** (one knows why the rule exists), **the single mechanism**
(one knows where to change it), **the inheritance** ("every new brick is born with it").

## What is established use, what is a choice

Out of honesty towards whoever takes these rules up: most gestures of the catalogue are **established uses**
(folding, zooming, a visible pivot, On / Off and variants, cancellable progress). They are not new; they are
gathered, and held by a mechanism. What is less common: the example value to confirm, the register of sources with
its level of verification, the AI round trip per artefact, the estimate before the calculation, and the way of
writing rules so that an agent holds them. Each entry of the catalogue says which side it is on.

These rules were proven on a desktop application, with mouse and keyboard, in Chromium. They were not tried on
touch, nor on Firefox and Safari: adapt, and say what you tried.
