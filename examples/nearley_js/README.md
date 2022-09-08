# Nearley JS Grammar

This directory contains an NPM package for a simple lexer and parser for JavaScript.

The lexer is built using [moo.js](https://github.com/no-context/moo), and the parser is
built on top of that using the [nearly.js](https://nearley.js.org/) parser generator.

To try it out, you can use the included `proto2ast.js` script:

```shell
# First, make sure the package's dependencies are installed.
npm install

# This script parses proto source from stdin and prints the resulting
# parse tree to stdout.
./proto2ast.js < example.proto
```

This currently uses a default parse tree result from Nearley JS, which is an untyped
tree of nested JavaScript arrays. Each array represents a production. The leaves of the
tree are tokens, each represented by a JavaScript object.
