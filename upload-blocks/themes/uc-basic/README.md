# Basic theme for upload-blocks

There are 4 levels of abstraction:
* Base values
* Derivative values
* Common styles
* Component styles

## Quick customization
The fastest way is simply change the values of the accent color and border radius to match your design:
```--h-accent
--s-accent
--l-accent
```
```
--border-radius
```
```
--shadows : NOT DONE YET
```

## Base values
We're using HSL because it allows to easily make derivative colors. That's what prefixes `--h-`, `--s-` and `--l-` are stand for.

* `--darkmode` — `1`: dark mode enabled, `0`: disabled;
* `--*-foreground` — text color, borders and shaders. Should be in contrast to background;
* `--*-background` — background color and it's variations;
* `--*-accent` — colors of buttons, links and text input borders (hover and focus). Should be in contrast to background;
* `--*-confirm` — color of confirmation notifications and badges;
* `--*-error` — color of error notifications and badges;
* `--opacity-*` — NEEDS TO BE EXPLAINED;
* `--ui-size` — minimum size of a clickable element. Also used to calculate size of the elements, that should be proportional to it;
* `--gap-*` — all paddings and margins;
* `--border-radius` — border radius and it's larger variations;
* `--transition-duration` — duration of all animated transitions;
* `--modal-shadow` — shadow of the modal window;
* `--inset-shadow` — shadow of the text input and similar elements;
* `--file-item-height` — height of the file item row in the list;
* `--modal-max-w`, `--modal-max-h` — maximum size of the modal window;

## Derivative values
Derivative values are calculated from the base values.

* `--darkmode-minus` — used for dark mode color calculations. Gives `-1` when dark mode is enabled, `1` when disabled;
* `--clr-background*` — variations of the background color;
--clr-accent
--clr-confirm
--clr-error
--clr-txt
--clr-shade-lv
--border-radius-
--border-
--clr-curtain
--clr-btn-bgr-primary* --clr-btn-txt-primary, --shadow-btn-primary
--clr-btn-bgr-secondary* --clr-btn-txt-secondary, --shadow-btn-secondary
--clr-btn-bgr-disabled --clr-btn-txt-disabled --shadow-btn-disabled

## Common styles
Common styles define similar UI elements across different blocks: buttons, inputs and links.
