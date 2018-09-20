## Fork Notice

This is a fork of https://github.com/eeue56/elm-static-html that provides Elm 0.19 support. The binary has been renamed to `static-html-from-elm`. It is 100% backwards compatibile with your old `elm-static-html` configuration.

# static-html-from-elm


Turn an Elm app into a static HTML site.


Your modules must look like this:


```elm
module Main exposing (..)

import Html
import Html.Attributes exposing (class, href)

view : Html.Html msg
view =
    Html.div []
        [ Html.h1 [ class "hello" ] [ Html.text "new!" ]
        , Html.a [ href "/login" ] [ Html.text "Login" ]
        , Html.text "hello"
        ]

```

then you can use

```bash

static-html-from-elm --filename Main.elm --output index.html

```

which will produce

```html
<div><h1 class="hello">new!</h1><a href="/login">Login</a>hello</div>
```


## Flags

`static-html-from-elm -f Main.elm` will print the output to stdout by default
You can create an initial config file through `static-html-from-elm --init-config`, though it's not needed to work.

You can use the config file to generate multiple files through `static-html-from-elm -c elm-static-html.json`.
The config file looks like this:

```js
{
    "files": {
        "<ElmFile.elm>": {
            "output": "<OutputFile.html>",
            "viewFunction": "view"
        },
        "<AnotherElmFile.elm": {
            "output": "<AnotherOutputFile.html>",
            "viewFunction": "someViewFunc"
        }
        /* ... */
    }
}
```

To generate multiple output files from a single elm file, supply an array of outputFile/viewFunction pairs:

```js
{
	"files": {
		"<ElmFile.elm>": [{
			"output": "<OutputFile.html>",
			"viewFunction": "view"
		}, {
			"output": "<AnotherOutputFile.html>",
			"viewFunction": "anotherView"
		}]
	}
}
```

## Notes

An .elm-static-html folder is created in order to generate the correct HTML and JS needed. You can delete it if you want, but it'll make builds a little slower.
