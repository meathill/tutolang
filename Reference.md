Tutolang References
===================

Syntax
------

### Comments

Any lines starting with # (or spaces followed by #) are treated as code comments and will be discarded by the compiler. For example:

```
# this is a comment
    # so is this line...
```

Comments must be on its own lines according to the current implementation.

We also support the block comment syntax, #{ ... }, which can span multiple lines, as in

```
#{
  This is a
  multi-line
  comment...
}
```

You can specify double or triple curly brackets to disambiguate special cases where the } character is used in the contents being commented out via the block comment syntax, as in

```
#{{
  This is a block comment
  containing #{ ... }
}}
```


Sections
--------

### `say()`

### `file([i|e]) /path/to/file`


Contents
--------

### `say`

### `l {NUMBER}(COMMANDS)`

### `edit {NUMBER}`


Commands
--------

### `lang LANGUAGE`

Set video language.

### `subtitle LANGUAGE`

Set subtitle language.

### `Screen (portrait|landscape)`

Set screen direction.


Author
------

Lujia Zhai (Meathill) [meathill@gmail.com](mailto:meathill@gmail.com)
