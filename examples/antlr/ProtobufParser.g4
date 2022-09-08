parser grammar ProtobufParser;

options {
	tokenVocab = ProtobufLexer;
}

file: BYTE_ORDER_MARK? syntaxDecl? fileElement* EOF;

fileElement: importDecl |
               packageDecl |
               optionDecl |
               messageDecl |
               enumDecl |
               extensionDecl |
               serviceDecl |
               emptyDecl;

syntaxDecl: SYNTAX EQUALS syntaxLevel SEMICOLON;

syntaxLevel: stringLiteral;

stringLiteral: STRING_LITERAL+;

emptyDecl: SEMICOLON;

packageDecl: PACKAGE packageName SEMICOLON;

packageName: qualifiedIdentifier;

importDecl: IMPORT ( WEAK | PUBLIC )? importedFileName SEMICOLON;

importedFileName: stringLiteral;

typeName: DOT? qualifiedIdentifier;

qualifiedIdentifier: ident ( DOT ident )*;

optionDecl: OPTION optionName EQUALS optionValue SEMICOLON;

compactOptions: L_BRACKET compactOption ( COMMA compactOption )* R_BRACKET;

compactOption : optionName EQUALS optionValue;

optionName: ( ident | L_PAREN typeName R_PAREN ) ( DOT optionName )*;

optionValue: scalarValue | messageLiteralWithBraces;

scalarValue : stringLiteral | uintLiteral | intLiteral | floatLiteral | ident;

uintLiteral : PLUS? INT_LITERAL;

intLiteral  : MINUS INT_LITERAL;

floatLiteral: ( MINUS | PLUS )? (FLOAT_LITERAL | INF );

messageLiteralWithBraces: L_BRACE messageTextFormat R_BRACE;

messageTextFormat: ( messageLiteralField ( COMMA | SEMICOLON )? )*;

messageLiteralField: messageLiteralFieldName COLON value |
                       messageLiteralFieldName messageValue;

messageLiteralFieldName: fieldName |
                           L_BRACKET specialFieldName R_BRACKET;

specialFieldName       : extensionFieldName | typeURL;

extensionFieldName     : qualifiedIdentifier;

typeURL                : qualifiedIdentifier SLASH qualifiedIdentifier;

value         : scalarValue | messageLiteral | listLiteral;

messageValue  : messageLiteral | listOfMessagesLiteral;

messageLiteral: messageLiteralWithBraces |
                  L_ANGLE messageTextFormat R_ANGLE;

listLiteral: L_BRACKET ( listElement ( COMMA listElement )* )? R_BRACKET;

listElement: scalarValue | messageLiteral;

listOfMessagesLiteral: L_BRACKET ( messageLiteral ( COMMA messageLiteral )* )? R_BRACKET;

messageDecl: MESSAGE messageName L_BRACE messageElement* R_BRACE;

messageName   : ident;

messageElement: fieldDecl |
                  groupDecl |
                  oneofDecl |
                  optionDecl |
                  extensionRangeDecl |
                  messageReservedDecl |
                  messageDecl |
                  enumDecl |
                  extensionDecl |
                  mapFieldDecl |
                  emptyDecl;

fieldDecl: fieldCardinality? typeName fieldName EQUALS fieldNumber
             compactOptions? SEMICOLON;

fieldCardinality: REQUIRED | OPTIONAL | REPEATED;

fieldName       : ident;

fieldNumber     : INT_LITERAL;

mapFieldDecl: mapType fieldName EQUALS fieldNumber compactOptions? SEMICOLON;

mapType   : MAP L_ANGLE mapKeyType COMMA typeName R_ANGLE;

mapKeyType:   INT32   | INT64   | UINT32   | UINT64   | SINT32 | SINT64 |
              FIXED32 | FIXED64 | SFIXED32 | SFIXED64 | BOOL   | STRING;

groupDecl: fieldCardinality? GROUP fieldName EQUALS fieldNumber
             compactOptions? L_BRACE messageElement* R_BRACE;

oneofDecl: ONEOF oneofName L_BRACE oneofElement* R_BRACE;

oneofName   : ident;

oneofElement: optionDecl |
                oneofFieldDecl |
                oneofGroupDecl;

oneofFieldDecl: typeName fieldName EQUALS fieldNumber
                  compactOptions? SEMICOLON;

oneofGroupDecl: GROUP fieldName EQUALS fieldNumber
                  compactOptions? L_BRACE messageElement* R_BRACE;

extensionRangeDecl: EXTENSIONS tagRanges compactOptions? SEMICOLON;

tagRanges    : tagRange ( COMMA tagRange )*;

tagRange     : tagRangeStart ( TO tagRangeEnd )?;

tagRangeStart: fieldNumber;

tagRangeEnd  : fieldNumber | MAX;

messageReservedDecl: RESERVED ( tagRanges | names ) SEMICOLON;

names: stringLiteral ( COMMA stringLiteral )*;

enumDecl: ENUM enumName L_BRACE enumElement* R_BRACE;

enumName   : ident;

enumElement: optionDecl |
               enumValueDecl |
               enumReservedDecl |
               emptyDecl;

enumValueDecl: enumValueName EQUALS enumValueNumber compactOptions? SEMICOLON;

enumValueName  : ident;

enumValueNumber: MINUS? INT_LITERAL;

enumReservedDecl: RESERVED ( enumValueRanges | names ) SEMICOLON;

enumValueRanges    : enumValueRange ( COMMA enumValueRange )*;

enumValueRange     : enumValueRangeStart ( TO enumValueRangeEnd )?;

enumValueRangeStart: enumValueNumber;

enumValueRangeEnd  : enumValueNumber | MAX;

extensionDecl: EXTEND extendedMessage L_BRACE extensionElement* R_BRACE;

extendedMessage : typeName;

extensionElement: fieldDecl |
                    groupDecl;

serviceDecl: SERVICE serviceName L_BRACE serviceElement* R_BRACE;

serviceName   : ident;

serviceElement: optionDecl |
                  methodDecl |
                  emptyDecl;

methodDecl: RPC methodName inputType RETURNS outputType SEMICOLON |
              RPC methodName inputType RETURNS outputType L_BRACE methodElement* R_BRACE;

methodName   : ident;

inputType    : messageType;

outputType   : messageType;

methodElement: optionDecl |
                emptyDecl;

messageType: L_PAREN STREAM? typeName R_PAREN;

ident: IDENTIFIER
    | SYNTAX
    | IMPORT
    | WEAK
    | PUBLIC
    | PACKAGE
    | OPTION
    | INF
    | REPEATED
    | OPTIONAL
    | REQUIRED
    | BOOL
    | STRING
    | BYTES
    | FLOAT
    | DOUBLE
    | INT32
    | INT64
    | UINT32
    | UINT64
    | SINT32
    | SINT64
    | FIXED32
    | FIXED64
    | SFIXED32
    | SFIXED64
    | GROUP
    | ONEOF
    | MAP
    | EXTENSIONS
    | TO
    | MAX
    | RESERVED
    | ENUM
    | MESSAGE
    | EXTEND
    | SERVICE
    | RPC
    | STREAM
    | RETURNS;
