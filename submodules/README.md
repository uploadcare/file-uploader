# Do not modify this folder contents!

## Why Git submodules?

We wanted to use relative paths for module resolving to make our code base work in raw mode (without build stage). 
It needed for code accessibility in browsers environment and at the GitHub pages (submodules are accessible if they set with https source) for documentation purposes. 
Also that is more convenient for testing, code referencing and type checking flow. Unfortunately that's all impossible with NPM-style module resolving.
