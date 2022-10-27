// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const moolex = require("./lexer.js");
const lexer = moolex.lexer;

// discard whitespace and comment tokens
const ignore = [ "whitespace", "line_comment", "block_comment" ]
lexer.next = (next => () => {
  let token;
  while ((token = next.call(lexer)) && (
    ignore.includes(token.type)
  )) {}
  return token;
})(lexer.next);
var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "File$ebnf$1", "symbols": [(lexer.has("byte_order_mark") ? {type: "byte_order_mark"} : byte_order_mark)], "postprocess": id},
    {"name": "File$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "File$ebnf$2", "symbols": ["SyntaxDecl"], "postprocess": id},
    {"name": "File$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "File$ebnf$3", "symbols": []},
    {"name": "File$ebnf$3", "symbols": ["File$ebnf$3", "FileElement"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "File", "symbols": ["File$ebnf$1", "File$ebnf$2", "File$ebnf$3"]},
    {"name": "FileElement", "symbols": ["ImportDecl"]},
    {"name": "FileElement", "symbols": ["PackageDecl"]},
    {"name": "FileElement", "symbols": ["OptionDecl"]},
    {"name": "FileElement", "symbols": ["MessageDecl"]},
    {"name": "FileElement", "symbols": ["EnumDecl"]},
    {"name": "FileElement", "symbols": ["ExtensionDecl"]},
    {"name": "FileElement", "symbols": ["ServiceDecl"]},
    {"name": "FileElement", "symbols": ["EmptyDecl"]},
    {"name": "SyntaxDecl", "symbols": [{"literal":"syntax"}, {"literal":"="}, "SyntaxLevel", {"literal":";"}]},
    {"name": "SyntaxLevel", "symbols": ["StringLiteral"]},
    {"name": "StringLiteral$ebnf$1", "symbols": [(lexer.has("string_literal") ? {type: "string_literal"} : string_literal)]},
    {"name": "StringLiteral$ebnf$1", "symbols": ["StringLiteral$ebnf$1", (lexer.has("string_literal") ? {type: "string_literal"} : string_literal)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "StringLiteral", "symbols": ["StringLiteral$ebnf$1"]},
    {"name": "EmptyDecl", "symbols": [{"literal":";"}]},
    {"name": "PackageDecl", "symbols": [{"literal":"package"}, "PackageName", {"literal":";"}]},
    {"name": "PackageName", "symbols": ["QualifiedIdentifier"]},
    {"name": "ImportDecl$ebnf$1$subexpression$1", "symbols": [{"literal":"weak"}]},
    {"name": "ImportDecl$ebnf$1$subexpression$1", "symbols": [{"literal":"public"}]},
    {"name": "ImportDecl$ebnf$1", "symbols": ["ImportDecl$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "ImportDecl$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ImportDecl", "symbols": [{"literal":"import"}, "ImportDecl$ebnf$1", "ImportedFileName", {"literal":";"}]},
    {"name": "ImportedFileName", "symbols": ["StringLiteral"]},
    {"name": "TypeName$ebnf$1", "symbols": [{"literal":"."}], "postprocess": id},
    {"name": "TypeName$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "TypeName", "symbols": ["TypeName$ebnf$1", "QualifiedIdentifier"]},
    {"name": "QualifiedIdentifier$ebnf$1", "symbols": []},
    {"name": "QualifiedIdentifier$ebnf$1$subexpression$1", "symbols": [{"literal":"."}, (lexer.has("identifier") ? {type: "identifier"} : identifier)]},
    {"name": "QualifiedIdentifier$ebnf$1", "symbols": ["QualifiedIdentifier$ebnf$1", "QualifiedIdentifier$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "QualifiedIdentifier", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier), "QualifiedIdentifier$ebnf$1"]},
    {"name": "OptionDecl", "symbols": [{"literal":"option"}, "OptionName", {"literal":"="}, "OptionValue", {"literal":";"}]},
    {"name": "CompactOptions$ebnf$1", "symbols": []},
    {"name": "CompactOptions$ebnf$1$subexpression$1", "symbols": [{"literal":","}, "CompactOption"]},
    {"name": "CompactOptions$ebnf$1", "symbols": ["CompactOptions$ebnf$1", "CompactOptions$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "CompactOptions", "symbols": [{"literal":"["}, "CompactOption", "CompactOptions$ebnf$1", {"literal":"]"}]},
    {"name": "CompactOption", "symbols": ["OptionName", {"literal":"="}, "OptionValue"]},
    {"name": "OptionName$subexpression$1", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)]},
    {"name": "OptionName$subexpression$1", "symbols": [{"literal":"("}, "TypeName", {"literal":")"}]},
    {"name": "OptionName$ebnf$1", "symbols": []},
    {"name": "OptionName$ebnf$1$subexpression$1", "symbols": [{"literal":"."}, "OptionName"]},
    {"name": "OptionName$ebnf$1", "symbols": ["OptionName$ebnf$1", "OptionName$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "OptionName", "symbols": ["OptionName$subexpression$1", "OptionName$ebnf$1"]},
    {"name": "OptionValue", "symbols": ["ScalarValue"]},
    {"name": "OptionValue", "symbols": ["MessageLiteralWithBraces"]},
    {"name": "ScalarValue", "symbols": ["StringLiteral"]},
    {"name": "ScalarValue", "symbols": ["UintLiteral"]},
    {"name": "ScalarValue", "symbols": ["IntLiteral"]},
    {"name": "ScalarValue", "symbols": ["FloatLiteral"]},
    {"name": "ScalarValue", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)]},
    {"name": "UintLiteral$ebnf$1", "symbols": [{"literal":"+"}], "postprocess": id},
    {"name": "UintLiteral$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "UintLiteral", "symbols": ["UintLiteral$ebnf$1", (lexer.has("int_literal") ? {type: "int_literal"} : int_literal)]},
    {"name": "IntLiteral", "symbols": [{"literal":"-"}, (lexer.has("int_literal") ? {type: "int_literal"} : int_literal)]},
    {"name": "FloatLiteral$ebnf$1$subexpression$1", "symbols": [{"literal":"-"}]},
    {"name": "FloatLiteral$ebnf$1$subexpression$1", "symbols": [{"literal":"+"}]},
    {"name": "FloatLiteral$ebnf$1", "symbols": ["FloatLiteral$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "FloatLiteral$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "FloatLiteral$subexpression$1", "symbols": [(lexer.has("float_literal") ? {type: "float_literal"} : float_literal)]},
    {"name": "FloatLiteral$subexpression$1", "symbols": [{"literal":"inf"}]},
    {"name": "FloatLiteral", "symbols": ["FloatLiteral$ebnf$1", "FloatLiteral$subexpression$1"]},
    {"name": "MessageLiteralWithBraces", "symbols": [{"literal":"{"}, "MessageTextFormat", {"literal":"}"}]},
    {"name": "MessageTextFormat$ebnf$1", "symbols": []},
    {"name": "MessageTextFormat$ebnf$1$subexpression$1$ebnf$1$subexpression$1", "symbols": [{"literal":","}]},
    {"name": "MessageTextFormat$ebnf$1$subexpression$1$ebnf$1$subexpression$1", "symbols": [{"literal":";"}]},
    {"name": "MessageTextFormat$ebnf$1$subexpression$1$ebnf$1", "symbols": ["MessageTextFormat$ebnf$1$subexpression$1$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "MessageTextFormat$ebnf$1$subexpression$1$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "MessageTextFormat$ebnf$1$subexpression$1", "symbols": ["MessageLiteralField", "MessageTextFormat$ebnf$1$subexpression$1$ebnf$1"]},
    {"name": "MessageTextFormat$ebnf$1", "symbols": ["MessageTextFormat$ebnf$1", "MessageTextFormat$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "MessageTextFormat", "symbols": ["MessageTextFormat$ebnf$1"]},
    {"name": "MessageLiteralField", "symbols": ["MessageLiteralFieldName", {"literal":":"}, "Value"]},
    {"name": "MessageLiteralField", "symbols": ["MessageLiteralFieldName", "MessageValue"]},
    {"name": "MessageLiteralFieldName", "symbols": ["FieldName"]},
    {"name": "MessageLiteralFieldName", "symbols": [{"literal":"["}, "SpecialFieldName", {"literal":"]"}]},
    {"name": "SpecialFieldName", "symbols": ["ExtensionFieldName"]},
    {"name": "SpecialFieldName", "symbols": ["TypeURL"]},
    {"name": "ExtensionFieldName", "symbols": ["QualifiedIdentifier"]},
    {"name": "TypeURL", "symbols": ["QualifiedIdentifier", {"literal":"/"}, "QualifiedIdentifier"]},
    {"name": "Value", "symbols": ["ScalarValue"]},
    {"name": "Value", "symbols": ["MessageLiteral"]},
    {"name": "Value", "symbols": ["ListLiteral"]},
    {"name": "MessageValue", "symbols": ["MessageLiteral"]},
    {"name": "MessageValue", "symbols": ["ListOfMessagesLiteral"]},
    {"name": "MessageLiteral", "symbols": ["MessageLiteralWithBraces"]},
    {"name": "MessageLiteral", "symbols": [{"literal":"<"}, "MessageTextFormat", {"literal":">"}]},
    {"name": "ListLiteral$ebnf$1$subexpression$1$ebnf$1", "symbols": []},
    {"name": "ListLiteral$ebnf$1$subexpression$1$ebnf$1$subexpression$1", "symbols": [{"literal":","}, "ListElement"]},
    {"name": "ListLiteral$ebnf$1$subexpression$1$ebnf$1", "symbols": ["ListLiteral$ebnf$1$subexpression$1$ebnf$1", "ListLiteral$ebnf$1$subexpression$1$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ListLiteral$ebnf$1$subexpression$1", "symbols": ["ListElement", "ListLiteral$ebnf$1$subexpression$1$ebnf$1"]},
    {"name": "ListLiteral$ebnf$1", "symbols": ["ListLiteral$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "ListLiteral$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ListLiteral", "symbols": [{"literal":"["}, "ListLiteral$ebnf$1", {"literal":"]"}]},
    {"name": "ListElement", "symbols": ["ScalarValue"]},
    {"name": "ListElement", "symbols": ["MessageLiteral"]},
    {"name": "ListOfMessagesLiteral$ebnf$1$subexpression$1$ebnf$1", "symbols": []},
    {"name": "ListOfMessagesLiteral$ebnf$1$subexpression$1$ebnf$1$subexpression$1", "symbols": [{"literal":","}, "MessageLiteral"]},
    {"name": "ListOfMessagesLiteral$ebnf$1$subexpression$1$ebnf$1", "symbols": ["ListOfMessagesLiteral$ebnf$1$subexpression$1$ebnf$1", "ListOfMessagesLiteral$ebnf$1$subexpression$1$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ListOfMessagesLiteral$ebnf$1$subexpression$1", "symbols": ["MessageLiteral", "ListOfMessagesLiteral$ebnf$1$subexpression$1$ebnf$1"]},
    {"name": "ListOfMessagesLiteral$ebnf$1", "symbols": ["ListOfMessagesLiteral$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "ListOfMessagesLiteral$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ListOfMessagesLiteral", "symbols": [{"literal":"["}, "ListOfMessagesLiteral$ebnf$1", {"literal":"]"}]},
    {"name": "MessageDecl$ebnf$1", "symbols": []},
    {"name": "MessageDecl$ebnf$1", "symbols": ["MessageDecl$ebnf$1", "MessageElement"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "MessageDecl", "symbols": [{"literal":"message"}, "MessageName", {"literal":"{"}, "MessageDecl$ebnf$1", {"literal":"}"}]},
    {"name": "MessageName", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)]},
    {"name": "MessageElement", "symbols": ["FieldDecl"]},
    {"name": "MessageElement", "symbols": ["MapFieldDecl"]},
    {"name": "MessageElement", "symbols": ["GroupDecl"]},
    {"name": "MessageElement", "symbols": ["OneofDecl"]},
    {"name": "MessageElement", "symbols": ["OptionDecl"]},
    {"name": "MessageElement", "symbols": ["ExtensionRangeDecl"]},
    {"name": "MessageElement", "symbols": ["MessageReservedDecl"]},
    {"name": "MessageElement", "symbols": ["MessageDecl"]},
    {"name": "MessageElement", "symbols": ["EnumDecl"]},
    {"name": "MessageElement", "symbols": ["ExtensionDecl"]},
    {"name": "MessageElement", "symbols": ["EmptyDecl"]},
    {"name": "FieldDecl$ebnf$1", "symbols": ["FieldCardinality"], "postprocess": id},
    {"name": "FieldDecl$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "FieldDecl$ebnf$2", "symbols": ["CompactOptions"], "postprocess": id},
    {"name": "FieldDecl$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "FieldDecl", "symbols": ["FieldDecl$ebnf$1", "TypeName", "FieldName", {"literal":"="}, "FieldNumber", "FieldDecl$ebnf$2", {"literal":";"}]},
    {"name": "FieldCardinality", "symbols": [{"literal":"required"}]},
    {"name": "FieldCardinality", "symbols": [{"literal":"optional"}]},
    {"name": "FieldCardinality", "symbols": [{"literal":"repeated"}]},
    {"name": "FieldName", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)]},
    {"name": "FieldNumber", "symbols": [(lexer.has("int_literal") ? {type: "int_literal"} : int_literal)]},
    {"name": "MapFieldDecl$ebnf$1", "symbols": ["CompactOptions"], "postprocess": id},
    {"name": "MapFieldDecl$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "MapFieldDecl", "symbols": ["MapType", "FieldName", {"literal":"="}, "FieldNumber", "MapFieldDecl$ebnf$1", {"literal":";"}]},
    {"name": "MapType", "symbols": [{"literal":"map"}, {"literal":"<"}, "MapKeyType", {"literal":","}, "TypeName", {"literal":">"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"int32"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"int64"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"uint32"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"uint64"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"sint32"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"sint64"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"fixed32"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"fixed64"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"sfixed32"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"sfixed64"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"bool"}]},
    {"name": "MapKeyType", "symbols": [{"literal":"string"}]},
    {"name": "GroupDecl$ebnf$1", "symbols": ["FieldCardinality"], "postprocess": id},
    {"name": "GroupDecl$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "GroupDecl$ebnf$2", "symbols": ["CompactOptions"], "postprocess": id},
    {"name": "GroupDecl$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "GroupDecl$ebnf$3", "symbols": []},
    {"name": "GroupDecl$ebnf$3", "symbols": ["GroupDecl$ebnf$3", "MessageElement"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "GroupDecl", "symbols": ["GroupDecl$ebnf$1", {"literal":"group"}, "FieldName", {"literal":"="}, "FieldNumber", "GroupDecl$ebnf$2", {"literal":"{"}, "GroupDecl$ebnf$3", {"literal":"}"}]},
    {"name": "OneofDecl$ebnf$1", "symbols": []},
    {"name": "OneofDecl$ebnf$1", "symbols": ["OneofDecl$ebnf$1", "OneofElement"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "OneofDecl", "symbols": [{"literal":"oneof"}, "OneofName", {"literal":"{"}, "OneofDecl$ebnf$1", {"literal":"}"}]},
    {"name": "OneofName", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)]},
    {"name": "OneofElement", "symbols": ["OptionDecl"]},
    {"name": "OneofElement", "symbols": ["OneofFieldDecl"]},
    {"name": "OneofElement", "symbols": ["OneofGroupDecl"]},
    {"name": "OneofFieldDecl$ebnf$1", "symbols": ["CompactOptions"], "postprocess": id},
    {"name": "OneofFieldDecl$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "OneofFieldDecl", "symbols": ["TypeName", "FieldName", {"literal":"="}, "FieldNumber", "OneofFieldDecl$ebnf$1", {"literal":";"}]},
    {"name": "OneofGroupDecl$ebnf$1", "symbols": ["CompactOptions"], "postprocess": id},
    {"name": "OneofGroupDecl$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "OneofGroupDecl$ebnf$2", "symbols": []},
    {"name": "OneofGroupDecl$ebnf$2", "symbols": ["OneofGroupDecl$ebnf$2", "MessageElement"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "OneofGroupDecl", "symbols": [{"literal":"group"}, "FieldName", {"literal":"="}, "FieldNumber", "OneofGroupDecl$ebnf$1", {"literal":"{"}, "OneofGroupDecl$ebnf$2", {"literal":"}"}]},
    {"name": "ExtensionRangeDecl$ebnf$1", "symbols": ["CompactOptions"], "postprocess": id},
    {"name": "ExtensionRangeDecl$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ExtensionRangeDecl", "symbols": [{"literal":"extensions"}, "TagRanges", "ExtensionRangeDecl$ebnf$1", {"literal":";"}]},
    {"name": "TagRanges$ebnf$1", "symbols": []},
    {"name": "TagRanges$ebnf$1$subexpression$1", "symbols": [{"literal":","}, "TagRange"]},
    {"name": "TagRanges$ebnf$1", "symbols": ["TagRanges$ebnf$1", "TagRanges$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "TagRanges", "symbols": ["TagRange", "TagRanges$ebnf$1"]},
    {"name": "TagRange$ebnf$1$subexpression$1", "symbols": [{"literal":"to"}, "TagRangeEnd"]},
    {"name": "TagRange$ebnf$1", "symbols": ["TagRange$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "TagRange$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "TagRange", "symbols": ["TagRangeStart", "TagRange$ebnf$1"]},
    {"name": "TagRangeStart", "symbols": ["FieldNumber"]},
    {"name": "TagRangeEnd", "symbols": ["FieldNumber"]},
    {"name": "TagRangeEnd", "symbols": [{"literal":"max"}]},
    {"name": "MessageReservedDecl$subexpression$1", "symbols": ["TagRanges"]},
    {"name": "MessageReservedDecl$subexpression$1", "symbols": ["Names"]},
    {"name": "MessageReservedDecl", "symbols": [{"literal":"reserved"}, "MessageReservedDecl$subexpression$1", {"literal":";"}]},
    {"name": "Names$ebnf$1", "symbols": []},
    {"name": "Names$ebnf$1$subexpression$1", "symbols": [{"literal":","}, "StringLiteral"]},
    {"name": "Names$ebnf$1", "symbols": ["Names$ebnf$1", "Names$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "Names", "symbols": ["StringLiteral", "Names$ebnf$1"]},
    {"name": "EnumDecl$ebnf$1", "symbols": []},
    {"name": "EnumDecl$ebnf$1", "symbols": ["EnumDecl$ebnf$1", "EnumElement"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "EnumDecl", "symbols": [{"literal":"enum"}, "EnumName", {"literal":"{"}, "EnumDecl$ebnf$1", {"literal":"}"}]},
    {"name": "EnumName", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)]},
    {"name": "EnumElement", "symbols": ["OptionDecl"]},
    {"name": "EnumElement", "symbols": ["EnumValueDecl"]},
    {"name": "EnumElement", "symbols": ["EnumReservedDecl"]},
    {"name": "EnumElement", "symbols": ["EmptyDecl"]},
    {"name": "EnumValueDecl$ebnf$1", "symbols": ["CompactOptions"], "postprocess": id},
    {"name": "EnumValueDecl$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "EnumValueDecl", "symbols": ["EnumValueName", {"literal":"="}, "EnumValueNumber", "EnumValueDecl$ebnf$1", {"literal":";"}]},
    {"name": "EnumValueName", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)]},
    {"name": "EnumValueNumber$ebnf$1", "symbols": [{"literal":"-"}], "postprocess": id},
    {"name": "EnumValueNumber$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "EnumValueNumber", "symbols": ["EnumValueNumber$ebnf$1", (lexer.has("int_literal") ? {type: "int_literal"} : int_literal)]},
    {"name": "EnumReservedDecl$subexpression$1", "symbols": ["EnumValueRanges"]},
    {"name": "EnumReservedDecl$subexpression$1", "symbols": ["Names"]},
    {"name": "EnumReservedDecl", "symbols": [{"literal":"reserved"}, "EnumReservedDecl$subexpression$1", {"literal":";"}]},
    {"name": "EnumValueRanges$ebnf$1", "symbols": []},
    {"name": "EnumValueRanges$ebnf$1$subexpression$1", "symbols": [{"literal":","}, "EnumValueRange"]},
    {"name": "EnumValueRanges$ebnf$1", "symbols": ["EnumValueRanges$ebnf$1", "EnumValueRanges$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "EnumValueRanges", "symbols": ["EnumValueRange", "EnumValueRanges$ebnf$1"]},
    {"name": "EnumValueRange$ebnf$1$subexpression$1", "symbols": [{"literal":"to"}, "EnumValueRangeEnd"]},
    {"name": "EnumValueRange$ebnf$1", "symbols": ["EnumValueRange$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "EnumValueRange$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "EnumValueRange", "symbols": ["EnumValueRangeStart", "EnumValueRange$ebnf$1"]},
    {"name": "EnumValueRangeStart", "symbols": ["EnumValueNumber"]},
    {"name": "EnumValueRangeEnd", "symbols": ["EnumValueNumber"]},
    {"name": "EnumValueRangeEnd", "symbols": [{"literal":"max"}]},
    {"name": "ExtensionDecl$ebnf$1", "symbols": []},
    {"name": "ExtensionDecl$ebnf$1", "symbols": ["ExtensionDecl$ebnf$1", "ExtensionElement"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ExtensionDecl", "symbols": [{"literal":"extend"}, "ExtendedMessage", {"literal":"{"}, "ExtensionDecl$ebnf$1", {"literal":"}"}]},
    {"name": "ExtendedMessage", "symbols": ["TypeName"]},
    {"name": "ExtensionElement", "symbols": ["FieldDecl"]},
    {"name": "ExtensionElement", "symbols": ["GroupDecl"]},
    {"name": "ServiceDecl$ebnf$1", "symbols": []},
    {"name": "ServiceDecl$ebnf$1", "symbols": ["ServiceDecl$ebnf$1", "ServiceElement"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "ServiceDecl", "symbols": [{"literal":"service"}, "ServiceName", {"literal":"{"}, "ServiceDecl$ebnf$1", {"literal":"}"}]},
    {"name": "ServiceName", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)]},
    {"name": "ServiceElement", "symbols": ["OptionDecl"]},
    {"name": "ServiceElement", "symbols": ["MethodDecl"]},
    {"name": "ServiceElement", "symbols": ["EmptyDecl"]},
    {"name": "MethodDecl", "symbols": [{"literal":"rpc"}, "MethodName", "InputType", {"literal":"returns"}, "OutputType", {"literal":";"}]},
    {"name": "MethodDecl$ebnf$1", "symbols": []},
    {"name": "MethodDecl$ebnf$1", "symbols": ["MethodDecl$ebnf$1", "MethodElement"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "MethodDecl", "symbols": [{"literal":"rpc"}, "MethodName", "InputType", {"literal":"returns"}, "OutputType", {"literal":"{"}, "MethodDecl$ebnf$1", {"literal":"}"}]},
    {"name": "MethodName", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)]},
    {"name": "InputType", "symbols": ["MessageType"]},
    {"name": "OutputType", "symbols": ["MessageType"]},
    {"name": "MethodElement", "symbols": ["OptionDecl"]},
    {"name": "MethodElement", "symbols": ["EmptyDecl"]},
    {"name": "MessageType$ebnf$1", "symbols": [{"literal":"stream"}], "postprocess": id},
    {"name": "MessageType$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "MessageType", "symbols": [{"literal":"("}, "MessageType$ebnf$1", "TypeName", {"literal":")"}]}
]
  , ParserStart: "File"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();