---
title: Parser Examples
sidebar_position: 30
---

The contents of this website reside in a repo on GitHub:
https://github.com/bufbuild/protobuf.com

In this repo are some [example parsers](https://github.com/bufbuild/protobuf.com/tree/main/examples)
that were created using the grammar presented in the [language spec](./language-spec.md):

* [nearley_js](https://github.com/bufbuild/protobuf.com/tree/main/examples/nearley_js):
  This directory contains a simple JavaScript parser built using the `nearley.js` parser
  generator and `moo.js` for lexical analysis.

* [antlr](https://github.com/bufbuild/protobuf.com/tree/main/examples/antlr):
  This directory contains configuration files for the ANTLR parser generator.

Both of these examples are just simple parsers. Their output is an abstract syntax tree, and
they do not perform any semantic validation. They also do not enforce the syntactic
differences between proto2 and proto3 syntax. But they are reasonable starting points for
building a more highly-featured parser. Over time, we may augment these parsers to include
more features, and we also may add new examples to the list using other parser generators.

Another example that may be interesting to examine, in addition to the above, is the actual
parser that powers Buf. It uses YACC for Go (aka [Goyacc](https://pkg.go.dev/golang.org/x/tools/cmd/goyacc)),
so it includes inlined Go code for producing an [AST](https://pkg.go.dev/github.com/bufbuild/protocompile@v0.14.1/ast).
That configuration can be found [here](https://github.com/bufbuild/protocompile/blob/v0.14.1/parser/proto.y).
Lexical analysis in Buf uses a [hand-written tokenizer in Go](https://github.com/bufbuild/protocompile/blob/v0.14.1/parser/lexer.go#L169).
