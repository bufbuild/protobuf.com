#!/bin/sh

set -e

if [[ ! -d ./tmp ]]; then
  ./build.sh
fi
cd tmp
java -Xmx500M -cp "/usr/local/lib/antlr-4.10.1-complete.jar:$CLASSPATH" org.antlr.v4.gui.TestRig Protobuf file -gui

