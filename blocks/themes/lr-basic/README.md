# Basic theme for blocks

There are 4 levels of abstraction:

- [Base values](#base-values)
- [Derivative values](#derivative-values])
- [Common styles](#common-styles)
- [Component styles](#component-styles)

### HSL color space

We use HSL color space because it allows us to easily calculate derivative colors. That's what prefixes `--h-`, `--s-`, and `--l-` are stand for.

### Quick styling

In most cases switching the dark mode on or off and changing the accent color is enough to make blocks match your design.

<!-- If you want to do a deeper styling, see this guide
TODO: write a guide. -->

```css
--darkmode: 1;
```

```css
--h-accent: 211;
--s-accent: 100%;
--l-accent: calc(50% - 5% * var(--darkmode));
```

## Base values

- `--darkmode` — `1`: dark mode enabled, `0`: disabled;
- `--*-foreground` — text color, borders, and shaders. It should be in contrast to the background;
- `--*-background` — background color and its variations;
- `--*-accent` — colors of buttons, links, and text input borders (hover and focus). It should be in contrast to the background;
- `--*-confirm` — the color of confirmation notifications and badges;
- `--*-error` — the color of error notifications and badges;
- `--opacity-*` — opacity of different states of small icon buttons;
- `--ui-size` — minimum size of a clickable element. Also used to calculate the size of the elements, which should be proportional to it;
- `--gap-*` — paddings and margins;
- `--gap-table` — the gap between elements in lists (for example, in upload-list);
- `--borders` — `1`: borders enabled, `0`: disabled. Can be fractional, for example, 0.5 will make borders half as opaque;
- `--border-radius-element` — border radius of buttons and inputs;
- `--border-radius-frame` — border radius of modal windows and drop area;
- `--border-radius-thumb` — border radius of thumbnails;
- `--transition-duration` — duration of all animated transitions;
- `--shadows` — `1`: shadows enabled, `0`: disabled. Can be fractional, for example 0.5, will make shadows half as opaque;
- `--*-shadow` — the color of box shadows;
- `--modal-max-w`, `--modal-max-h` — the maximum size of the modal window.

## Derivative values

Derivative values are calculated from the base values.

- `--darkmode-minus` — used for dark mode color calculations. Gives `-1` when dark mode is enabled, `1` when disabled;
- `--clr-background*` — lightness variations of the background color;
- `--clr-accent*` — opacity variations of the accent color;
- `--clr-confirm` — confirmation notifications color;
- `--clr-error` — opacity and lighness variations of the error notifications color;
- `--clr-txt*` — lightness variations of the text color;
- `--clr-shade-lv*` — shading colors (foreground color with a low opacity variations);
- `--border-*` — border variations;
- `--clr-curtain` — color of the background behind the modal window;
- `--clr-btn-bgr-primary*`, `--clr-btn-txt-primary`, `--shadow-btn-primary` — primary action button values;
- `--clr-btn-bgr-secondary*`, `--clr-btn-txt-secondary`, `--shadow-btn-secondary` — secondary action button values;
- `--clr-btn-bgr-disabled`, `--clr-btn-txt-disabled`, `--shadow-btn-disabled` — disabled button values.

## Common styles

Common styles define similar UI elements across different blocks: buttons, inputs, and links.

## Component styles

Component styles are the most specific.

<!-- TODO: decide about recommendations here -->
