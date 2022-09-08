# Grammar Examples

This folder contains examples of the Protobuf grammar, using parser generators.

* `nearley_js`: This directory contains a simple JavaScript parser built using
  the [nearley.js](https://nearley.js.org/) parser generator and [moo.js](https://github.com/no-context/moo)
  for lexical analysis.

* `antlr`: This directory contains a configuration file for the [ANTLR](https://www.antlr.org/)
  parser generator.

  Antlr already includes grammars for the Protobuf IDL (separate
  ones for [proto2](https://github.com/antlr/grammars-v4/blob/master/protobuf2/Protobuf2.g4)
  vs. [proto3](https://github.com/antlr/grammars-v4/blob/master/protobuf3/Protobuf3.g4)
  syntax). However, these are based on older grammars that were once published
  to Google's official docs site. Not only do they require you to know or to
  ascertain the file's syntax level before parsing, but they also contain
  inaccuracies that make them unsuitable for real use.

  Just as this repo contains a grammar that remedies the inaccuracies in the
  official documentation, the configuration in this example directory remedies
  the inaccuracies in the existing Antlr grammars.

These examples only implement the _grammar_ and do not attempt to implement
all language validation. For example, syntax validation, to enforce the differences
between proto2 and proto3 syntax, is present in neither.

For a more thorough example that implements all validation, as well as other
phases of a compiler (up to and including descriptor production but excluding
code generation), see the [protocompile](https://gitbub.com/jhump/protocompile)
project, a Go implementation built using the [goyacc](https://pkg.go.dev/golang.org/x/tools/cmd/goyacc)
parser generator.