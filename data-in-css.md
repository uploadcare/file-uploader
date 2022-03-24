## CSS context properties (CCP?)

Available values (JSON):
* string - should be in quotes
* number
* 1|0 for boolean flags

Advantages:
* CSS selectors to provide context
* Inherit properties from parent elements
* Define or redefine any value at the any level of the DOM tree
* Provide configurations via common wrapper element
* Mix contexts
* Ability to implement styling properties that not supported by default
* Ability to create "umbrella" data-channels
* Native browser technology, work in any modern browser
* Well documented in basics and well known by developers 

Disadvantages:
* No ability to notify property changes
* Possible loading order issues: styles should be loaded before property reading