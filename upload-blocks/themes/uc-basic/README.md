# Basic theme for upload-blocks

There are 4 levels of abstraction:
* Base values
* Derivative values
* Common styles
* Component styles

## Quick customization
The fastest way is simply change the values of the accent color to match your design:
```--h-accent
--s-accent
--l-accent
```

## Base values
We're using HSL because it allows to easily make derivative colors. That's what prefixes `--h-`, `--s-` and `--l-` are stand for.

`--darkmode` — 1: dark mode enabled, 0: disabled

`--*-foreground` — text color, borders and shaders

`--*-background` — background color and it's variations

`--*-accent` — colors of buttons, links and text input borders (hover and focus)

`--*-confirm` — color of confirmation notifications and badges

`--*-error` — color of error notifications and badges

`--opacity-*` — 

--ui-size:

--gap-min: 2px;
--gap-mid: 10px;
--gap-max: 20px;

--border-radius: 5px;
--transition-duration: 0.2s;

--modal-shadow: 0px 0px 1px rgba(0, 0, 0, calc(0.35 + 0.65 * var(--darkmode))), 0px 6px 40px rgba(0, 0, 0, calc(0.2 + 0.4 * var(--darkmode)));
--inset-shadow: inset 0px 2px 3px rgba(0, 0, 0, calc(0.09 + 0.1 * var(--darkmode)));

--modal-max-w: 800px;
--modal-max-h: 600px;

--file-item-height: 60px;
