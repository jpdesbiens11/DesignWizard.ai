# Mechanisms every screen inherits

## The principle

An ergonomic rule written screen by screen is lost by the third screen. Each rule below is carried by **a single
mechanism**, installed once when the application starts, which recognises the screens by their structure. A new
screen has nothing to declare: it inherits because it is made like the others.

How to build such a mechanism:

- **A convention of structure**, not a registration: "a group is a section whose first child is its title", "a
  panel is `.side`, what scrolls is `.side-scroll`", "a numeric field is an ordinary numeric field".
- **Delegated listeners** at document level, and an observer of the page's changes: a redrawn panel is taken back
  before it is painted.
- **Two halves**: the pure logic (keys, geometry, states), tested without a page; the half that touches the screen.
- **An attribute for what the screen knows besides**, optional (what a folded group holds, a tool that keeps a
  gesture for itself).
- **One source** for each shared control (the switch, the veil, the menu): never two versions.

Each entry says: what the user sees · **established use** or **house choice** · what a new screen must do. The
entries marked "established use" are not inventions: they are gathered here, and held.

## Contents

1. The structure of a work screen · 2. Panels · 3. Lists and trees · 4. Fields ·
5. On / Off, copies and variants · 6. What the centre shows · 7. The 3D view · 8. The menu of an item ·
9. What lasts · 10. Undo · 11. Words and units · 12. The page that stays open

## 1. The structure of a work screen — house choice

Three zones, always the same: **on the left what one enters, in the centre what one looks at, on the right what
one chooses and what one gets**. Both panels resize and hide; their width is the same from one screen to the next.
*New screen: take these three zones, even if it leaves one empty.*

## 2. Panels

- **Foldable groups — established use.** A click on the title of a group folds it (chevron to the right) and
  brings the following ones up; Alt + click keeps only one open; a button folds everything; the state is kept. A
  folded group says in a few words what it holds, and **turns amber if it still waits for a value**; the guide
  reopens the group it sends to. *New screen: give every group a title.*
- **The panel stays where it was — established use.** Redrawn after a value, it keeps its scroll position and the
  cursor in its field; after Tab, in the next field. *Nothing to do.* (A typical complaint when this is not held:
  "every time I press Enter, it goes back to the top".)
- **What one does stays at the top — established use.** The button that launches and the view switch are pinned
  at the head of the panel: they do not scroll. The result comes before the explanation. *New screen: put its
  actions in the pinned zone, not at the end of the panel.*

## 3. Lists and trees

- **Never a long list of text alone — house choice.** Every choice is presented grouped by nature, a colour per
  group, a pictogram that shows the concept and a short title per item; the detail comes after.
- **A tree carries numbers and colours that serve everywhere — established use.** Item A1 of the list is A1 on
  the label of the view and in the message of the guide, in the same colour. A click in the list lights it in the
  view, and the reverse.
- **Common settings stay on the row** (the switch, the eye); the rest goes into the menu of the row.

## 4. Fields

- **Arrows with progressive speed — house choice.** In every numeric field, an arrow adds or removes 1; held or
  clicked fast, it speeds up (×2, ×5, ×10) and a mark says the speed. Any decimal can be typed.
  *New screen: an ordinary numeric field; do not make arrows of its own.*
- **Enter validates, Escape abandons, Tab goes to the next** — established use, to hold even when the screen is
  redrawn.

## 5. On / Off, copies and variants — established use (the "suppression" and "configurations" of CAD)

- **Off = set aside.** The entry stays in the model with its values and **counts for nothing**: not for the
  calculation, nor for what shows, nor for the guide, nor for what goes out. It comes back as it was.
- **Duplicating makes a copy born Off**, right after the original: one changes a value in it, turns it On in its
  place, runs again, compares. One gesture (Alt + click) turns one entry On alone among those of its type.
- **The same switch everywhere**; what is Off is greyed and says so; every title counts what is On and what is
  Off.
- **Everything that reads the model goes through "what counts"**: a single function returns the model without
  what is Off, and every tool takes it. *This is the point that fails: one forgotten reader, and Off lies.*
- **Named variants**: the state of the model (what is On, the value of each parameter) is kept under a name, and
  a click comes back to it, in one undoable step. Each variant says what the click would change, and can be looked
  at (its drawing) without the model changing.
- **What leaves says which variant it comes from**: the name of the file and the heading of the document name it,
  whether it was asked for or is simply the one on the screen. And what leaves is made for another variant from a
  copy, by a single menu — the model does not change, and the screen says that what goes out is not what it
  shows. *Without this, two files of the same name stand for two different parts.*
- **What one sets is found again.** A setting that is long to redo (a calculation case) is written in the document
  at every change, as an undoable step; a mere visit writes nothing.

## 6. What the centre shows — established use

- **Everything zooms**: 3D view and plan with the wheel towards the pointer; a sheet with Ctrl + wheel (the wheel
  alone scrolls) with a small bar − / % / +; drag to move what overflows.
- **A magnifier** in the common bar: a lens follows the pointer over any drawing or view, its factor set with a
  short slider; the pointer acts through it; Escape puts it away. Vector content is redrawn at scale.

## 7. The 3D view — established use, except the automatic rotation

- **The pivot is the point grabbed**: the view turns about the point under the pointer at the press; what one
  holds stays in place on the screen.
- **Three axes, no stop**: the free orbit of modellers (the two axes of the screen) by default, the turntable (the
  vertical of the model stays upright) by a switch that is kept. The part follows the hand, in every direction.
- **No gesture hidden behind a key**: turning the picture in the plane of the screen is done by dragging from the
  edge of the view, which lights up under the pointer — and by two arrows next to the triad. *A trap lived: that
  gesture only existed as Alt + drag; the person asked for it again as if it were missing.*
  *A trap lived: a top view where left / right "does nothing" — the up of the screen must be kept from one gesture
  to the next, the line of sight is not enough.*
- **A cue during the gesture**: the pivot, the axis, an arc and an arrow, the angles travelled.
- **Automatic rotation — house choice**: the button held two seconds opens a small panel (way, speed). One switch
  per axis: two or three ways go together, each with its arrow turning in the cue.
- A tool that waits for a click in the view keeps the gesture for itself, and tells the mechanism.

## 8. The menu of an item — established use

A right click on a row opens **the same menu** as on the item in the view: one function builds it, from the state
of the item ("Show only this part" becomes "Show all parts"). From the keyboard, it opens under the row.

## 9. What lasts — established use

Every operation that may last shows the same veil: what is being done, a line of progress, the time elapsed,
**a word when nothing moves**, a "Cancel" button that really stops, then "Resume". The screen is never frozen
without saying why. What is clicked while the screen changes **stays the same element**: a button rebuilt at each
line of progress loses the click that straddles two lines — it is rebuilt only when its nature changes.
*New long operation: born with its veil and its cancellation.*

## 10. Undo — established use

Every change is **an undoable step, with its name** ("Length = 176", "Variant Long"). A gesture that changes
several things at once is a single step.

## 11. Words and units — domain choice

- The terms of the trade are shown as the trade names them; a glossary gives the equivalent.
- Values are kept in one system; the screen writes in the chosen system, through a single formatting function.
  What must stay in one unit (a calculation, a manufacturing file) says so.

## 12. The page that stays open — established use

A single-page application, kept open for hours, does not receive what is published meanwhile. It reads the
published version from time to time and **offers to update itself**: save, ask for its files again, reload.
Otherwise the person looks for a button their page does not have yet.
