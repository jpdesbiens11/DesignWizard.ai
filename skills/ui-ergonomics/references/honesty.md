# An honest interface

A tool-like application makes assumptions in the person's place: a default value, a calculation method, a standard.
The risk is not the assumption; it is that it passes for a decision. These rules keep the border visible.

## 1. An invented value is an example

**What the user sees.** When the tool creates something with a value it chose (an effort of 100 N, a zone of
13 mm), the field **blinks** and carries a tick. Until the value is typed or confirmed (Enter, or the tick), the
element is marked "to enter", the guide lists it, and the action that depends on it waits.

**Why.** A plausible default value is the most dangerous one: nothing tells it from an intended value, and the
result that comes out of it looks right.

**How.** The element carries the list of what it still asks for (`ask: ["F"]`). Typing a value or confirming it
removes the field from the list. One function marks a field that waits; one function says whether something
blocks. What is set aside (Off) asks for nothing.

**Not to do.** Pre-fill silently; block without saying where; ask to confirm what the person typed.

## 2. A live guide, everywhere

**What the user sees.** Every screen says what is missing or wrong, while one works, on four levels:

| Level | Meaning | Blocks the action |
|---|---|---|
| To fix | the case cannot be processed, or means nothing | yes |
| To enter | an example value waits for yours | yes |
| To check | it will run, but it is probably not what you want | no |
| Advice | a better way of doing it | no |

The most serious first, one line per point, and **a click on a line leads to the place** (the field scrolls into
view, blinks for a moment; a folded group opens). The same list reads in the screen and under a "Guide" button
common to the whole application.

**How.** Each screen has a pure function that takes its state and returns the list
(`{ level, text, element, field, fix }`). It is tested without a page. The message says the fix, not only the
fault: "No support: the product is not held. Fix: right click on a face → Support here."

## 3. A register of sources, with its level of verification

**What the user sees.** In the help, every method, convention or standard a tool uses has its line: what it
covers, what the tool takes from it, and **how it was verified**:

| Level | What it means |
|---|---|
| read | the document was opened and read |
| tested | the results are compared, by tests, with reference values |
| page read | only the presentation page was read |
| excerpt | seen as an excerpt or a summary: to re-read before relying on it |
| to verify | values taken over without a recorded re-reading |
| usage | a rule of thumb in common use, said as such |
| house choice | a convention of the application: no standard behind it |
| not read | cited by its designation; the text was not read |

**Why.** A tool that cites a standard gives the impression of applying it. The level tells the truth: never more
than what was done. It is also what lets someone of the trade know what to re-read.

**How.** One list (a module), read by the help screen and by the tests. Every new function adds its lines. An
interface convention has its place there too ("usage", or "house choice").

## 4. A name, not a number

A property that comes from a reference — a material, a fluid, a component — **is not typed**: one picks the named
entry in a base, its value shows beside it, not editable, and the entry says where it comes from.
*Reason: a typed number has no origin any more; a name has one, which can be checked.*

## 5. Estimate before calculating, then cross-check

Before a heavy calculation, the screen writes **the hand estimate** a practitioner would make, step by step.
Afterwards it puts the two side by side with a verdict (agreeing, notable gap, discordant) and says what to look at
if they do not agree. *Reason: a result without an expected order of magnitude cannot be criticised.* The
principle holds outside calculation: announce what you expect before launching, compare after.

## 6. A result remembers its case

Every result keeps what counted when it was produced ("Case solved: A1 · E2 — 1 condition Off"). As soon as an
entry changes, the result shown is marked **"of before"** until the next calculation, instead of disappearing or
staying unmentioned. The trials of a session read side by side.

## 7. Saying what the tool does not do

Every function documents its limits in the product ("What this brick does not do"), and a deliverable carries its
identity: who produced it, which version, which date, and which of the electronic or printed version prevails.
