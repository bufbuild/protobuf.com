const nearley = require("nearley");
const grammar = require("./protobuf-grammar.js");

exports.newParser = () => new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
