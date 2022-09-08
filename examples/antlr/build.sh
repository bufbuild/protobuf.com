#!/bin/sh

set -e

mkdir -p tmp
cd tmp
cp ../Protobuf*.g4 .
java -Xmx500M -cp "/usr/local/lib/antlr-4.10.1-complete.jar:$CLASSPATH" org.antlr.v4.Tool Protobuf*.g4
javac *.java

