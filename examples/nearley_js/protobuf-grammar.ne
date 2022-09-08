# A nearley.js grammar for the Protobuf IDL

@{%
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
%}

@lexer lexer

File -> %byte_order_mark:? SyntaxDecl:? FileElement:*

FileElement -> ImportDecl |
               PackageDecl |
               OptionDecl |
               MessageDecl |
               EnumDecl |
               ExtensionDecl |
               ServiceDecl |
               EmptyDecl

SyntaxDecl -> "syntax" "=" SyntaxLevel ";"

SyntaxLevel -> StringLiteral

StringLiteral -> %string_literal:+

EmptyDecl -> ";"

PackageDecl -> "package" PackageName ";"

PackageName -> QualifiedIdentifier

ImportDecl -> "import" ( "weak" | "public" ):? ImportedFileName ";"

ImportedFileName -> StringLiteral

TypeName -> ".":? QualifiedIdentifier

QualifiedIdentifier -> %identifier ( "." %identifier ):*

OptionDecl -> "option" OptionName "=" OptionValue ";"

CompactOptions -> "[" CompactOption ( "," CompactOption ):* "]"

CompactOption  -> OptionName "=" OptionValue

OptionName -> ( %identifier | "(" TypeName ")" ) ( "." OptionName ):*

OptionValue -> ScalarValue | MessageLiteralWithBraces

ScalarValue  -> StringLiteral | UintLiteral | IntLiteral | FloatLiteral | %identifier

UintLiteral  -> "+":? %int_literal

IntLiteral   -> "-" %int_literal

FloatLiteral -> ( "-" | "+" ):? ( %float_literal | "inf" )

MessageLiteralWithBraces -> "{" MessageTextFormat "}"

MessageTextFormat -> ( MessageLiteralField ( "," | ";" ):? ):*

MessageLiteralField -> MessageLiteralFieldName ":" Value |
                       MessageLiteralFieldName MessageValue

MessageLiteralFieldName -> FieldName |
                           "[" SpecialFieldName "]"

SpecialFieldName        -> ExtensionFieldName | TypeURL

ExtensionFieldName      -> QualifiedIdentifier

TypeURL                 -> QualifiedIdentifier "/" QualifiedIdentifier

Value          -> ScalarValue | MessageLiteral | ListLiteral

MessageValue   -> MessageLiteral | ListOfMessagesLiteral

MessageLiteral -> MessageLiteralWithBraces |
                  "<" MessageTextFormat ">"

ListLiteral -> "[" ( ListElement ( "," ListElement ):* ):? "]"

ListElement -> ScalarValue | MessageLiteral

ListOfMessagesLiteral -> "[" ( MessageLiteral ( "," MessageLiteral ):* ):? "]"

MessageDecl -> "message" MessageName "{" MessageElement:* "}"

MessageName    -> %identifier

MessageElement -> FieldDecl |
                  MapFieldDecl |
                  GroupDecl |
                  OneofDecl |
                  OptionDecl |
                  ExtensionRangeDecl |
                  MessageReservedDecl |
                  MessageDecl |
                  EnumDecl |
                  ExtensionDecl |
                  EmptyDecl

FieldDecl -> FieldCardinality:? TypeName FieldName "=" FieldNumber
             CompactOptions:? ";"

FieldCardinality -> "required" | "optional" | "repeated"

FieldName        -> %identifier

FieldNumber      -> %int_literal

MapFieldDecl -> MapType FieldName "=" FieldNumber CompactOptions:? ";"

MapType    -> "map" "<" MapKeyType "," TypeName ">"

MapKeyType -> "int32"   | "int64"   | "uint32"   | "uint64"   | "sint32" | "sint64" |
              "fixed32" | "fixed64" | "sfixed32" | "sfixed64" | "bool"   | "string"

GroupDecl -> FieldCardinality:? "group" FieldName "=" FieldNumber
             CompactOptions:? "{" MessageElement:* "}"

OneofDecl -> "oneof" OneofName "{" OneofElement:* "}"

OneofName    -> %identifier

OneofElement -> OptionDecl |
                OneofFieldDecl |
                OneofGroupDecl

OneofFieldDecl -> TypeName FieldName "=" FieldNumber
                  CompactOptions:? ";"

OneofGroupDecl -> "group" FieldName "=" FieldNumber
                  CompactOptions:? "{" MessageElement:* "}"

ExtensionRangeDecl -> "extensions" TagRanges CompactOptions:? ";"

TagRanges     -> TagRange ( "," TagRange ):*

TagRange      -> TagRangeStart ( "to" TagRangeEnd ):?

TagRangeStart -> FieldNumber

TagRangeEnd   -> FieldNumber | "max"

MessageReservedDecl -> "reserved" ( TagRanges | Names ) ";"

Names -> StringLiteral ( "," StringLiteral ):*

EnumDecl -> "enum" EnumName "{" EnumElement:* "}"

EnumName    -> %identifier

EnumElement -> OptionDecl |
               EnumValueDecl |
               EnumReservedDecl |
               EmptyDecl

EnumValueDecl -> EnumValueName "=" EnumValueNumber CompactOptions:? ";"

EnumValueName   -> %identifier

EnumValueNumber -> "-":? %int_literal

EnumReservedDecl -> "reserved" ( EnumValueRanges | Names ) ";"

EnumValueRanges     -> EnumValueRange ( "," EnumValueRange ):*

EnumValueRange      -> EnumValueRangeStart ( "to" EnumValueRangeEnd ):?

EnumValueRangeStart -> EnumValueNumber

EnumValueRangeEnd   -> EnumValueNumber | "max"

ExtensionDecl -> "extend" ExtendedMessage "{" ExtensionElement:* "}"

ExtendedMessage  -> TypeName

ExtensionElement -> FieldDecl |
                    GroupDecl

ServiceDecl -> "service" ServiceName "{" ServiceElement:* "}"

ServiceName    -> %identifier

ServiceElement -> OptionDecl |
                  MethodDecl |
                  EmptyDecl

MethodDecl -> "rpc" MethodName InputType "returns" OutputType ";" |
              "rpc" MethodName InputType "returns" OutputType "{" MethodElement:* "}"

MethodName    -> %identifier

InputType     -> MessageType

OutputType    -> MessageType

MethodElement -> OptionDecl |
                EmptyDecl

MessageType -> "(" "stream":? TypeName ")"
