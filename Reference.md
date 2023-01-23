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

内容区块，主要用来分割不同镜头，比如展示图片、展示代码、展示 slide 等等。

### `say(SCREEN)`

添加解说。画面由 `SCREEN` 决定。

#### SCREEN

* `image=/path/to/image`
* `video=/path/to/video`
* `browser=/path/to/webpage`

### `file([i|e]) /path/to/file`

开始解说文件内容。

### `browser /path/to/file`

使用浏览器打开目标页面。


File section
------------

讲解代码时，我们可以使用这些标记插入语音解说。文件内容标记需要放在每一行的开头，
并用中括号包裹，如 `[start]`。

### `start`

开始编辑文件时，同步讲解。除非下一行是 `l1`。

### `l{NUMBER}(COMMANDS)`

一边输入/编辑代码，一边解说。

#### COMMANDS

* `h` = hold，输入/修改完成后，要等待语音完成才进入下一行。如果下一行也有解说，则 `h` 可以忽略。

### `edit {NUMBER}`

### `end`

等待所有编辑/修改完成后，插入解说。


Browser section
---------------

预览效果时，我们可以用这些标记插入语音解说。浏览器内容标记需要放在每一行的开头，
并用中括号包裹，如 `[start]`。

### `start`

网页打开后，开始讲解。讲解完，进行下一步操作。

### `hl(SELECTOR)`

高亮符合选择器的节点。

### `click(SELECTOR)`

点击选择器选中的第一个节点。

### `end`

所有操作完成后，插入解说。

Commands
--------

### `lang LANGUAGE`

Set video language.

### `subtitle LANGUAGE`

Set subtitle language.

### `scrdir (portrait|landscape)`

Set screen direction.

### `commit COMMIT`

使用 `COMMIT` 的代码。

### `video /path/to/video`

插入一段视频。

Author
------

Lujia Zhai (Meathill) [meathill@gmail.com](mailto:meathill@gmail.com)
