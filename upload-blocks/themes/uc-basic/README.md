# Basic theme for upload-blocks

-----screenshot here-----

There are 4 levels of abstraction:
* Base values
* Derivative values
* Common styles
* Component styles

We're using HSL because it allows to easily make derivative colors. That's what prefixes `--h-`, `--s-` and `--l-` are stand for.

## Quick customization
To quickly make upload-blocks match your design, you need to touch only a few values. Here is an example:

---screenshot of the reference design----

1. Turn on the darkmode
```
--darkmode: 1;
```

2. Change accent color to match the most saturated color of your design

```
--h-accent: 
--s-accent: 
--l-accent: 
```

3. Change the corner radius

```
--border-radius: 0;
```

4. Switch off the shadows

```
--shadows: 0;
```

## Base values

* `--darkmode` — `1`: dark mode enabled, `0`: disabled;
* `--*-foreground` — text color, borders and shaders. Should be in contrast to background;
* `--*-background` — background color and it's variations;
* `--*-accent` — colors of buttons, links and text input borders (hover and focus). Should be in contrast to background;
* `--*-confirm` — color of confirmation notifications and badges;
* `--*-error` — color of error notifications and badges;
* `--opacity-*` — opacity of different states of small icon buttons;
* `--ui-size` — minimum size of a clickable element. Also used to calculate size of the elements, that should be proportional to it;
* `--gap-*` — paddings and margins;
* `--border-radius` — border radius and it's larger variations;
* `--transition-duration` — duration of all animated transitions;
* `--shadows` — `1`: shadows enabled, `0`: disabled. Can be a fractional, for example 0.5 will make shadows half as opaque.
* `--*-shadow` — color of box shadows
* `--modal-max-w`, `--modal-max-h` — maximum size of the modal window;

## Derivative values
Derivative values are calculated from the base values.

* `--file-item-height` — height of the file item row in the list. Fixed value speeds up the render long file lists;
* `--darkmode-minus` — used for dark mode color calculations. Gives `-1` when dark mode is enabled, `1` when disabled;
* `--clr-background*` — lightness variations of the background color;
* `--clr-accent*` — opacity variations of the accent color;
* `--clr-confirm` — confirmation notifications color;
* `--clr-error` — opacity and lighness variations of the error notifications color;
* `--clr-txt*` — lightness variations of the text color;
* `--clr-shade-lv*` — shading colors (foreground color with a low opacity variations);
* `--border-radius-*` — corner radius variations;
* `--border-*` — border variations
* `--clr-curtain` — color of the background behind the modal window;
* `--clr-btn-bgr-primary*`, `--clr-btn-txt-primary`, `--shadow-btn-primary` — primary action button values;
* `--clr-btn-bgr-secondary*`, `--clr-btn-txt-secondary`, `--shadow-btn-secondary` — secondary action button values;
* `--clr-btn-bgr-disabled`, `--clr-btn-txt-disabled`, `--shadow-btn-disabled` — disabled button values;

## Common styles
Common styles define similar UI elements across different blocks: buttons, inputs and links.
