# ANTLR v4 Grammar

This directory contains configuration for building a lexer and parser for the
Protobuf IDL using [ANTLR v4](https://www.antlr.org/).

You can use the ANTLR tool to generate a parser from the `g4` files herein.

To try it out, you can use the included `build.sh` and `show_ast.sh` scripts.
```shell
# First, build an ANTLR parser. This puts the parser (Java and class files)
# in a subdirectory named 'tmp'.
./build.sh

# This script parses proto source from stdin and shows a GUI with the
# resulting parse tree.
./show_ast.sh < example.proto
```
These scripts expect the ANTLR tool to be [downloaded](https://www.antlr.org/download.html)
and installed in `/usr/local/lib/antlr-4.10.1-complete.jar`. If you have
downloaded this file to a different location, you must update your `CLASSPATH`
environment variable to include this location before using these two scripts.
