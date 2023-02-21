---
title: Language Specification
sidebar_position: 10
---

This is a specification for the Protocol Buffers IDL (Interface Definition Language).
Protocol Buffers are also known by the shorthand "Protobuf".

Protobuf is a platform-agnostic and implementation-language-agnostic
way of describing data structures and RPC interfaces. Tools can then generate code
in a variety of implementation languages for interacting with these structures
and for consuming and exposing RPC services.

Google's documentation can be found [here](https://developers.google.com/protocol-buffers/)
(with separate grammars for [proto2](https://developers.google.com/protocol-buffers/docs/reference/proto2-spec)
and [proto3](https://developers.google.com/protocol-buffers/docs/reference/proto3-spec)
syntax). But these grammars are incomplete. In the face of these
documentation shortcomings, the actual implementation in the `protoc` compiler prevails
as the de facto spec. Without complete and accurate documentation, it is very hard for
the community to contribute quality tools around the language.

This document aims to remedy the situation and provide that complete
and correct specification. This content was developed over the course of implementing a [pure Go
compiler for Protobuf](https://pkg.go.dev/github.com/jhump/protoreflect@v1.10.1/desc/protoparse).
It is used in [Buf](https://buf.build) and has been tested against a very large corpus
of Protobuf sources to verify its correctness and parity with `protoc`. The test corpus
includes use of the more exotic features of the language (which are the main things notably
absent or incorrect in Google's official documentation).


## Notation

The syntax is specified using Extended Backus-Naur Form (EBNF):
```ebnf
Production  = production_name "=" Expression "." .
Expression  = Alternative { "|" Alternative } .
Alternative = Term { Term } .
Term        = production_name | literal [ "…" literal ] | Exclusion | Group | Option | Repetition .
Exclusion   = "!" literal | "!" "(" literal { "|" literal } ")" .
Group       = "(" Expression ")" .
Option      = "[" Expression "]" .
Repetition  = "{" Expression "}" .
```

Productions are expressions constructed from terms and the following operators, in increasing precedence:

* **|**:  Alternation
* **!**:  Exclusion
* **()**: Grouping
* **[]**: Option (0 or 1 times)
* **{}**: Repetition (0 to n times)

Lower-case production names are used to identify lexical tokens. Non-terminals are in
[PascalCase](https://en.wiktionary.org/wiki/Pascal_case). Literal source characters are
enclosed in double quotes `""` or back quotes ``` `` ```. In double-quotes, the contents
can encode otherwise non-printable characters. The backslash character (`\`) is used to
mark these encoded sequences:

* `"\n"`: The newline character (code point 10).
* `"\r"`: The carriage return character (code point 13).
* `"\t"`: The horizontal tab character (code point 9).
* `"\v"`: The vertical tab character (code point 11).
* `"\f"`: The form feed character (code point 12).
* `"\xHH"`: Where each H is a hexadecimal character (0 to 9, A to F). The hexadecimal-encoded
            8-bit value indicates a byte value between 0 and 255.
* `"\\"`: A literal backslash character.

These escaped characters represent _bytes_, not Unicode code points (thus the
8-bit limit). To represent literal Unicode code points above 127, a sequence of
bytes representing the UTF-8 encoding of the code point will be used.

A string of multiple characters indicates all characters in a sequence. In other
words, the following two productions are equivalent:
```ebnf
foo = "bar" .
foo = "b" "a" "r" .
```

The exclusion operator is only for use against literal characters and means that
all characters _except for_ the given ones are accepted. For example `!"a"` means
that any character except lower-case `a` is accepted; `!("a"|"b"|"c")` means that
any character except lower-case `a`, `b`, or `c` is accepted.

The form `a … b` represents the set of characters from a through b as alternatives.


## Source Code Representation

Source code is Unicode text encoded in UTF-8. In general, only comments and string literals
can contain code points outside the range of 7-bit ASCII.

For compatibility with other tools, a file with Protobuf source may contain a UTF-8-encoded
byte order mark (U+FEFF, encoded as `"\xEF\xBB\xBF"`), but only if it is the first Unicode
code point in the source text.

A single file containing Protobuf IDL source code will be referred to below as a
"source file". By convention, the name of a source file typically ends in `.proto`.


## Lexical Elements

Parsing a source file first undergoes lexical analysis. This is the process of
converting the source file, which is a sequence of UTF-8 characters, into a sequence of
lexical elements, also called _tokens_. (This process is also known as "tokenization".)

Having a tokenization phase allows us to more simply describe the way inputs are transformed
into syntactical elements and how things like whitespace and comments are handled without
cluttering the main grammar.

Tokenization is "greedy", meaning a token matches the longest possible sequence in the input.
That way input like `"0.0.0"`, `"1to3"`, and `"packageio"` can never be interpreted as token
sequences [`"0.0"`, `".0"`]; [`"1"`, `"to"`, `"3"`]; or [`"package"`, `"io"`]
respectively; they will always be interpreted as single tokens.

If a sequence of input is encountered that does not match any of the rules for acceptable
tokens, then the source is invalid and has a syntax error.

### Whitespace and Comments

Whitespace is often necessary to separate adjacent tokens in the language. But, aside from
that purpose during tokenization, it is ignored. Extra whitespace is allowed anywhere between
tokens. Block comments can also serve to separate tokens, are also allowed anywhere between
tokens, and are also ignored by the grammar.

Protobuf source allows for two styles of comments:
 1. Line comments: These begin with `//` and continue to the end of the line.
 2. Block comments: These begin with `/*` and continue until the first `*/`
    sequence is encountered. A single block comment can span multiple lines.

So the productions below are used to identify whitespace and comments, but they will be
discarded.
```ebnf
whitespace = " " | "\n" | "\r" | "\t" | "\f" | "\v" .
comment    = line_comment | block_comment .

line_comment       = "//" { !("\n" | "\x00") } .
block_comment      = "/*"  block_comment_rest .
block_comment_rest = "*" block_comment_tail |
                     !("*" | "\x00") block_comment_rest .
block_comment_tail = "/" |
                     "*" block_comment_tail |
                     !("*" | "/" | "\x00") block_comment_rest .
```

If the `/*` sequence is found to start a block comment, but the above rule is not
matched, it indicates a malformed block comment: EOF was reached before the
concluding `*/` sequence was found. Such a malformed comment is a syntax
error.

If a comment text contains a null character (code point zero) then it is malformed
and a syntax error should be reported.

```txt title="Examples"
// a line comment

// a longer, multi-line
// line comment is just
// multiple line comments
// all in a row

/* a block comment in one line */

/* a multi-line
   block comment */

/**
 * A multi-line block comment
 * using JavaDoc convention
 */
```

### Character Classes

The following categories for input characters are used through the lexical analysis
productions in the following sections:
```ebnf
letter        = "A" … "Z" | "a" … "z" | "_" .
decimal_digit = "0" … "9" .
octal_digit   = "0" … "7" .
hex_digit     = "0" … "9" | "A" … "F" | "a" … "f" .

byte_order_mark = "\xEF\xBB\xBF" .
```

The `byte_order_mark` byte sequence is the UTF-8 encoding of the byte-order mark
character (U+FEFF).

### Tokens

The result of lexical analysis is a stream of tokens of the following kinds:
 * `identifier`
 * 39 token types corresponding to keywords
 * `int_literal`
 * `float_literal`
 * `string_literal`
 * 16 token types corresponding to symbols, punctuation, and operators.

The rules for identifying these tokens can be found below.

#### Identifiers and Keywords

An identifier is used for named elements in the protobuf language, like names
of messages, fields, and services.
```ebnf
identifier = letter { letter | decimal_digit } .
```

```txt title="Examples"
x
foo
a_b_c
plan9
option
UPPER_CASE
MixedCase
_any_Crazy_CASE_with_01234_numbers
c3p0
```

There are 39 keywords in the protobuf grammar.
When an `identifier` is found, if it matches a keyword, its token type is changed
to match the keyword, per the rules below. All of the keyword token types below
are *also* considered identifiers by the grammar. For example, a production in the
grammar that references `identifier` will also accept `syntax` or `map`.
```ebnf
syntax   = "syntax" .      float    = "float" .       oneof      = "oneof" .
import   = "import" .      double   = "double" .      map        = "map" .
weak     = "weak" .        int32    = "int32" .       extensions = "extensions" .
public   = "public" .      int64    = "int64" .       to         = "to" .
package  = "package" .     uint32   = "uint32" .      max        = "max" .
option   = "option" .      uint64   = "uint64" .      reserved   = "reserved" .
inf      = "inf" .         sint32   = "sint32" .      enum       = "enum" .
repeated = "repeated" .    sint64   = "sint64" .      message    = "message" .
optional = "optional" .    fixed32  = "fixed32" .     extend     = "extend" .
required = "required" .    fixed64  = "fixed64" .     service    = "service" .
bool     = "bool" .        sfixed32 = "sfixed32" .    rpc        = "rpc" .
string   = "string" .      sfixed64 = "sfixed64" .    stream     = "stream" .
bytes    = "bytes" .       group    = "group" .       returns    = "returns" .
```

#### Numeric Literals

Handling of numeric literals is a bit special in order to avoid a situation where
`"0.0.0"` or `"100to3"` is tokenized as [`"0.0"`, `".0"`] or [`"100"`, `"to"`, `"3"`]
respectively. Instead of these input sequences representing a possible sequence of 2
or more tokens, they are considered invalid numeric literals.

So input is first scanned for the `numeric_literal` token type:
```ebnf
numeric_literal = [ "." ] decimal_digit { digit_point_or_exp } .

digit_point_or_exp = "." | decimal_digit | ( "e" | "E" ) [ "+" | "-" ] | letter .
```

```txt title="Examples"
123
0xab
.01234
4.56e+123
0.0.0
100to3
```

When a `numeric_literal` token is found, it is then checked to see if it matches the `int_literal`
or `float_literal` rules (see below). If it does then the scanned token is included in the
result token stream with `int_literal` or `float_literal` as its token type. But if it does *not*
match, it is a malformed numeric literal which is considered a syntax error.

Below is the rule for `int_literal`, which supports octal and hexadecimal representations in
addition to standard decimal:
```ebnf
int_literal = decimal_literal | octal_literal | hex_literal .

decimal_literal = "0" | ( "1" … "9" ) [ decimal_digits ] .
octal_literal   = "0" octal_digits .
hex_literal     = "0" ( "x" | "X" ) hex_digits .
decimal_digits  = decimal_digit { decimal_digit } .
octal_digits    = octal_digit { octal_digit } .
hex_digits      = hex_digit { hex_digit } .
```

```txt title="Examples"
0
1234
0741
0x0f6db2
```

Note that octal and hexadecimal integer literals must be _less
than_ 2<sup>64</sup> (0x10000000000000000 in hex; 02000000000000000000000 in octal). If they
are beyond this limit, they are invalid numeric literals. If a decimal literal is beyond this
limit (>= 18,446,744,073,709,551,616), it is treated as if it were a `float_literal`.

Below is the rule for `float_literal`, which supports scientific notation for extremely
large and small values:
```ebnf
float_literal = decimal_digits "." [ decimal_digits ] [ decimal_exponent ] |
                decimal_digits decimal_exponent |
                "." decimal_digits [ decimal_exponent ] .

decimal_exponent  = ( "e" | "E" ) [ "+" | "-" ] decimal_digits .
```

```txt title="Examples"
1.
0.0
.123
555.555
1.234e-12
.953e20
5E+40
```

Floating point values are represented using 64-bit (double precision) IEEE754 format. If
a given value cannot be exactly represented in this format (due to precision constraints),
it is replaced with the nearest value that _can_ be represented by this format. When the
value is too small to be represented, that nearest value will be zero. When the value is
too large to be represented, it is replaced with `inf` or `-inf` (depending on the sign
of the original value).

:::note

The tokenization implementation in Google's reference implementation, `protoc`,
does not perform two stages to identify numeric literals as described here. But this
strategy is easier to describe in EBNF and correctly accepts all valid numeric literals,
rejects all invalid ones, and makes it easy for a parser implementation to report good
error messages.

:::

#### String Literals

Character and binary string data is represented using string literals. These support
C-style escape sequences.
```ebnf
string_literal = single_quoted_string_literal | double_quoted_string_literal .

single_quoted_string_literal = "'" { !("\n" | "\x00" | "'" | `\`) | rune_escape_seq } "'" .
double_quoted_string_literal = `"` { !("\n" | "\x00" | `"` | `\`) | rune_escape_seq } `"` .

rune_escape_seq    = simple_escape_seq | hex_escape_seq | octal_escape_seq | unicode_escape_seq .
simple_escape_seq  = `\` ( "a" | "b" | "f" | "n" | "r" | "t" | "v" | `\` | "'" | `"` | "?" ) .
hex_escape_seq     = `\` ( "x" | "X" ) hex_digit [ hex_digit ] .
octal_escape_seq   = `\` octal_digit [ octal_digit [ octal_digit ] ] .
unicode_escape_seq = `\` "u" hex_digit hex_digit hex_digit hex_digit |
                     `\` "U" hex_digit hex_digit hex_digit hex_digit
                             hex_digit hex_digit hex_digit hex_digit .
```

```txt title="Examples"
"foo"
'bar'
"A string with \"nested quotes\" in it"
'Another with \'nested quotes\' inside'
"Some whitespace:\n\r\t\v"
'Hex escaped bytes: \x01\x2\X03\X4'
'A string with a literal back-slash \\ in it'
"A string that has a NULL character in hex: \x00"
"Another with a NULL in octal: \00"
"A unicode right arrow can use unicode escape \u2192 or not →"
'Long unicode escape can represent emojis \U0001F389 but isn't necessary 🎉'
```

While the long form of unicode escapes (starting with `\U`) ostensibly allows
encoding extremely large values, the highest allowed value is U+10FFFF.

If a string literal contains a newline or null character then it is malformed, and a
syntax error should be reported. (But an _encoded_ newline or null, using escape sequences,
is allowed: `\n`, `\x0a`, or `\00`).

String literals are used for constant values of `string` fields, which should be valid UTF-8. They are also
used for constant values of `bytes` fields. So they must be able to represent arbitrary binary data,
in addition to UTF-8 strings. To that end, octal and hex escapes always represent a single
byte, not a unicode code point. To represent valid unicode characters outside the 7-bit ASCII
range, use unicode escape sequences, not octal or hex escapes.

The unicode escapes do not necessarily end up as 2 or 4 bytes in the resulting string (despite
the length of the escape sequence) since they will be encoded using UTF-8.

The following table describes the meaning of the various simple escapes:

| Value | Description                                                                                                             |
|-------|-------------------------------------------------------------------------------------------------------------------------|
| `\a`  | Alert/bell. ASCII 0x07.                                                                                                 |
| `\b`  | Backspace. ASCII 0x08.                                                                                                  |
| `\f`  | Formfeed/page break. ASCII 0x0C.                                                                                        |
| `\n`  | Newline. ASCII 0x0A                                                                                                     |
| `\r`  | Carriage return. ASCII 0x0D.                                                                                            |
| `\t`  | Horizontal tab. ASCII 0x09.                                                                                             |
| `\v`  | Vertical tab. ASCII 0x0B.                                                                                               |
| `\\`  | A literal back-slash `\`. ASCII 0x5C.                                                                                   |
| `\'`  | A literal single-quote `'`. ASCII 0x27. Leading back-slash only required when string literal enclosed in single-quotes. |
| `\"`  | A literal double-quote `"`. ASCII 0x22. Leading back-slash only required when string literal enclosed in double-quotes. |
| `\?`  | A literal question mark `?`. ASCII 0x3F. Leading back-slash not required.                                               |

#### Punctuation and Operators

The symbols below represent all other valid input characters used in the protobuf language.
```ebnf
semicolon = ";" .     colon     = ":" .     l_paren   = "(" .     l_bracket = "[" .
comma     = "," .     equals    = "=" .     r_paren   = ")" .     r_bracket = "]" .
dot       = "." .     minus     = "-" .     l_brace   = "{" .     l_angle   = "<" .
slash     = "/" .     plus      = "+" .     r_brace   = "}" .     r_angle   = ">" .
```


## Syntax

The sections below describe all the elements of the protobuf IDL and include EBNF
productions that describe their syntax.

The elements are presented in "top down" order: the first element described encompasses
an entire source file and is the objective for parsing a valid source file. For
any given production, any other productions to which it refers that have not yet been
defined are presented thereafter, possibly in a subsequent section. Remember that
lower-snake-case identifiers in EBNF refer to lexical elements, which are defined above in
the previous section.

The grammar presented here is a _unified_ grammar: it is capable of parsing both proto2
and proto3 syntax files. This means you do not need multiple passes, such as a pre-parse
to determine the syntax level of the file and then a full-parse using a syntax-specific
grammar. The differences between the two do not require a separate grammar and can be
implemented as a post-process step to validate the resulting parsed syntax tree. The
relevant differences between proto2 and proto3 syntax are called out in the sections
below.


## Source File Organization

A valid source file contains zero or more declarations and may begin with an optional
UTF byte order mark.
```ebnf
File = [ byte_order_mark ] [ SyntaxDecl ] { FileElement } .

FileElement = ImportDecl |
              PackageDecl |
              OptionDecl |
              MessageDecl |
              EnumDecl |
              ExtensionDecl |
              ServiceDecl |
              EmptyDecl .
```

### Declaration Types

There are two different kinds of declarations in a source file:
1. **Simple declarations**: A simple declaration generally describes a single language
   element and then ends with a semicolon `;`.
2. **Block declarations**: A block declaration is used for composite elements: those that
   may contain other elements. Instead of ending with a semicolon, they end with a block
   enclosed in braces (`{` and `}`). The contained elements are defined inside these braces.

Empty declarations are allowed as top-level declarations in a file as well as in most kinds of
block declarations. They have no content: they consist solely of a terminating semicolon. They
are ignored.
```ebnf
EmptyDecl = semicolon .
```

### Syntax Declaration

Files should define a syntax level. If present, this must be the first
declaration in the file. The string literal in the declaration is the
syntax level, and it must have a value of "proto2" or "proto3". Other
values are not allowed (though the set of allowed values may be expanded
in the future). If a file contains no syntax declaration then the proto2
syntax is assumed.
```ebnf
SyntaxDecl =  syntax equals SyntaxLevel semicolon .

SyntaxLevel = StringLiteral .
```

```txt title="Examples"
syntax = "proto2":
syntax = "proto3";
```

String literals support C-style concatenation. So the sequence
`"prot" "o2"` is equivalent to `"proto2"`.
```ebnf
StringLiteral = string_literal { string_literal } .
```

### Package Declaration

A file can only include a single package declaration, though it
can appear anywhere in the file (except before the syntax).
```ebnf
PackageDecl = package PackageName semicolon .

PackageName = QualifiedIdentifier .
```

```txt title="Examples"
package buf;
package google.api;
package foo.bar.baz;
```

Packages use dot-separated namespace components. A compound name
like `foo.bar.baz` represents a nesting of namespaces, with `foo`
being the outermost namespace, then `bar`, and finally `baz`.
So all the elements in two files, with packages `foo.bar.baz`
and `foo.bar.buzz` for example, reside in the `foo` and `foo.bar`
namespaces.

A full package name, with any whitespace removed, must be less than
512 characters long. It also must contain no more than 100 dots (i.e.
101 components or fewer).

### Imports

In order for one file to re-use message and enum types defined in
another file, the one file must import the other.
```ebnf
ImportDecl = import [ weak | public ] ImportedFileName semicolon .

ImportedFileName = StringLiteral .
```

```txt title="Examples"
import "google/protobuf/descriptor.proto";
import public "other/file.proto";
import weak "deprecated.proto";
```

A "public" import means that everything in that file is treated
as if it were defined in the importing file, for the benefit of
transitive importers. For example, if file "a.proto" imports
"b.proto" and "b.proto" has "c.proto" as a _public_ import, then
the elements in "a.proto" may refer to elements defined in
"c.proto", even though "a.proto" does not directly import "c.proto".

A "weak" import means that the import is not required as a runtime
dependency. Fields that depend on types defined in these imports
can also be marked with a field option named `weak`.

:::caution

Use of weak imports and weak field options is strongly discouraged and is
supported by few target runtimes.

:::

The string literal must be a relative path (e.g. it may not start with
a slash `/`). Paths always use forward slash as the path separator,
even when compiled on operating systems that use back-slashes (`\`),
such as Windows.

The set of files that a file imports are also known as the file's
dependencies.

#### Visibility

When one element in a file refers to another element (defined in the same file
or possible in another file), the referenced element must be _visible_ to that
file. Imports are how elements in one file are made visible to another.

The elements that are visible to a given file include the following:
1. Everything defined inside that given file
2. Everything defined inside the files that the given file imports
3. Everything defined inside files that are _publicly_ imported by the files that the
   given file imports. [Public imports](#imports) are transitive, so if `a.proto` imports
   `b.proto` which _publicly_ imports `c.proto` which in turn _publicly_ imports `d.proto`,
   then everything in `c.proto` and `d.proto` is visible to `a.proto`.


## Named Elements

There are numerous types of declarations in the Protobuf IDL that are "named
elements": packages, messages, fields, oneofs, enums, enum values, extensions,
services, and methods.

Packages are not declared in the same way as other elements. Other elements
are explicitly declared in a source file, and it is an error if two
explicitly declared elements have the same name. A package declaration on the
other hand is more like a _reference_ to a package. Referring to a package
implicitly declares that package and all of its ancestors. So it is fine if
multiple files indicate the same package name: this does not indicate a package
name conflict but rather indicates that multiple files contribute elements
to that same package.

A line like `package foo.bar.baz;`, for example, is a reference that implicitly
declares three different packages:
1. `foo.bar.baz`
2. `foo.bar`
3. `foo`

Named elements form a hierarchy, or a tree. An element that may contain child
elements is a "composite element".
```
─ Package
   ├─ Messages
   │   ├─ Fields
   │   ├─ Oneofs
   │   │   └─ Fields
   │   ├─ Messages
   │   │   └─ (...more...)
   │   ├─ Enums
   │   │   └─ Enum Values
   │   └─ Extensions
   │
   ├─ Enums
   │   └─ Enum Values
   │
   ├─ Extensions
   │
   └─ Services
       └─ Methods
```
As seen above, the structure of a message is recursive: messages can contain other messages;
these nested messages can themselves contain messages; and so on. Note that a source file
is _not_ a named element in the hierarchy and thus absent from the diagram above. Files are
just a way of grouping and organizing elements.

### Fully-Qualified Names

All named elements can be uniquely identified by their fully-qualified name. When
the element is declared, it is given a simple name, consisting of a single
identifier. Its fully-qualified name includes a prefix that indicates the context
and location of the declaration.

Every node in this tree has a fully-qualified name that is easy to compute: take the
fully-qualified name of the parent node and append to that a dot (`"."`) and the node's
simple name. There are two exceptions to this simple rule:
 1. Enum values are treated as if _siblings_ of the enums that contain them, not child nodes.
    The reason behind this is mostly a legacy decision to support generated C++ code since
    enums in C++ behave the same way with regard their enclosing namespace.
 2. Similarly, fields defined inside a oneof are treated as if _siblings_ of the oneof. This
    is so that any normal field of a message can be uniquely identified by its simple name,
    regardless of whether it is part of a oneof (a property required by the text and JSON
    serialization formats for Protobuf messages).

Due to the above two exceptions, the only elements that are composite elements _per the
structure implied by fully-qualified names_ are packages, messages, and services.

The following example source demonstrates this by showing the fully-qualified names of
all named elements, as computed by the logic described above:
```protobuf
syntax = "proto3";                            // Fully-qualified name
                                              //----------------------
package foo.bar;                              // foo.bar
                                              //
import "google/protobuf/descriptor.proto";    //
                                              //
message Message {                             // foo.bar.Message
    oneof id {                                // foo.bar.Message.id
      string name = 1;                        // foo.bar.Message.name
      uint64 num = 2;                         // foo.bar.Message.num
    }                                         //
    message NestedMessage {                   // foo.bar.Message.NestedMessage
      extend google.protobuf.MessageOptions { //
        string fizz = 49999;                  // foo.bar.Message.NestedMessage.fizz
      }                                       //
      option (NestedMessage.fizz) = "buzz";   //
      enum Kind {                             // foo.bar.Message.NestedMessage.Kind
        NULL = 0;                             // foo.bar.Message.NestedMessage.NULL
        PRIMARY = 1;                          // foo.bar.Message.NestedMessage.PRIMARY
        SECONDARY = 2;                        // foo.bar.Message.NestedMessage.SECONDARY
      }                                       //
      Kind kind = 1;                          // foo.bar.Message.NestedMessage.kind
    }                                         //
    NestedMessage extra = 3;                  // foo.bar.Message.extra
}                                             //
                                              //
enum Unit {                                   // foo.bar.Unit
  VOID = 0;                                   // foo.bar.VOID
}                                             //
                                              //
service FooService {                          // foo.bar.FooService
  rpc Bar(Message) returns (Message);         // foo.bar.FooService.Bar
}                                             //
```

As shown by the extension `fizz` in this example, the fully-qualified name of
an extension depends only on the context where the extension is declared. It has no
relation to the message being extended.

All named elements in the Protobuf IDL must have _unique_ fully-qualified names. It
is not allowed, for example, for a message to have a field and nested enum that have
the same name.

Since fields in a oneof are actually _siblings_ of the oneof, they are
actually represented as if direct children of the enclosing message. This means that
you cannot have two fields with the same name, even if they are enclosed in different
oneofs.

Also seen above, names are case-sensitive, which is why it is allowed to have an enum
named `Kind` (capitalized) and a field named `kind` (lower-case) at the same level,
inside of `NestedMessage`.


## Type References

Various elements in the source file allow for referencing another element, either
defined in the same source file or defined in one of the source file's imports.
```ebnf
TypeName = [ dot ] QualifiedIdentifier .

QualifiedIdentifier = identifier { dot identifier } .
```

```txt title="Examples"
string
int32
UserResponse
other.Message
.foo.bar.Message
foo.bar.baz.Service.Request
```

These references are usually _type_ references, referring to user-defined message
and enum types. In some cases (such as in options), these references can instead
refer to extensions.

### Fully-Qualified References

References are often simple identifiers. This works especially well when the target
type is in the same package as the referring element. For example, a field on a
top-level message can refer to any other top-level message in the same package
without any qualifiers.

If a reference is prefixed with a dot (`.`), it means that the name that follows is already
fully-qualified: it contains the full package name and the names of any enclosing
messages for the target element. So the referenced element can easily be found from
the name alone.

### Relative References

When a reference is an unqualified identifier, it is just a single, simple name. A
reference can also be _partially_ qualified: it has multiple name components separated
by dots (`.`), but it does not start with a dot. Both unqualified and partially
qualified references are "relative" references -- since the element to which they
refer is relative to the context in which the reference appears.

The process of resolving a relative reference identifies the fully-qualified name of
the referenced element, or it determines that there is no such element and that the
reference is not valid. This process relies on the concept of lexical scopes.

#### Scopes

Every named element in a source file is defined in a lexical scope. These
scopes form a hierarchy that mirrors the hierarchy of the elements. There are
three kinds of scopes:

1. **Package scope**: The scope of a package refers to all elements defined in that
   package.

   All elements in a file are defined in the scope of its package. Package scopes form
   a hierarchy. If a package's name has a single component, then the package scope's
   parent is that of the "default" package (which has no name). Otherwise, the package
   scope's parent is that of the package's "enclosing namespace". The package's enclosing
   namespace is the package's name with the rightmost component removed. For example,
   the parent namespace of package "foo.bar.baz" is "foo.bar".

   If the file does not declare a package, all of its contents are in the "default"
   package.

   All declarations that are not inside a message or service reside directly in the
   package scope of the file's package.

2. **Message scope**: The scope of a message refers to all elements defined inside
   that message's body, including nested messages which also correspond to their
   own nested scope.

   If the message is nested inside another message, then the scope's parent is the
   scope of the enclosing message. Otherwise, the scope's parent is the package scope
   of the package in which the message is defined.

3. **Service scope**: The scope of a service refers to all elements defined inside
   that service's body. The scope's parent is the package scope of the package in
   which the service is defined.

Scopes are named after the element (package, message, or service) to which they
correspond. The name of a scope's parent can be computed in the same way as described
above for computing the parent of a package: discard the rightmost component. (The name
of the "default" package's scope is the empty string, and it has no parent.)

Within a scope, all elements in an ancestor scope may be referenced using a partially
qualified reference. Common ancestors between two elements may be elided in a reference.
For example, an element inside the `foo.bar.Baz.Bedazzle` scope can omit the `foo.bar`
prefix to refer to an element `foo.bar.FizzBuzz` because they both have the `foo.bar`
component in common. So the reference could be written as `Baz.Bedazzle`. Such a
reference could also use more qualifiers than necessary and be written as
`bar.Baz.Bedazzle` or `foo.bar.Baz.Bedazzle`.

#### Reference Resolution

Resolving a relative reference starts with the scope in which the reference is declared.
So if the reference is the extendee of a top-level "extends" block, its scope is that of
the file's package. If the reference is a field type inside a message, its scope is that
of the enclosing message.

There are two exceptions to the starting scope:
1. When resolving custom option _names_ for a message option, skip the initial scope and
   proceed to the scope's parent (the package scope for options in top-level messages, or
   the scope of the enclosing message for options in nested messages).
2. When resolving extension names that appear inside a message literal in option _values_,
   skip all scopes corresponding to enclosing messages and use the file's scope.

The process then queries all visible elements for a match in this scope. If there is no
match, we move on to the scope's parent and repeat the query. The process continues
through each ancestor scope until a match is found. If the search gets to the root scope,
that of the "default" package (with the empty name), and the element has still not been
found, the reference is not valid.

Querying for a match in a given scope depends on whether the relative reference is
unqualified or not:

<dl>
<dt>If the reference is unqualified</dt>
<dd>

  Compute a candidate fully-qualified name as the name of the scope, then a dot, and
  then the reference. For example, a reference `Baz` inside of a package scope `foo.bar`
  results in a candidate name of `foo.bar.Baz`.

  Examine all visible elements for one whose fully-qualified name matches this. If
  there is no match found, the reference cannot be to an element in this scope.
  Continue to the next scope.

  If the reference is for the type name for a field (including type references in the
  type declaration of a map field) but the matched element is neither a message nor an
  enum, act as if no match was found. Continue to the next scope.

  If we make it this far, resolution is complete: the candidate name fully identifies
  the referenced element.
</dd>
<dt>If the reference is partially qualified</dt>
<dd>

  Compute a candidate fully-qualified name as the name of the scope, then a dot, and
  then _only the first component_ of the reference. For example, a reference `Baz.Buzz`
  inside of a package scope `foo.bar` results in a candidate name of `foo.bar.Baz`.

  Examine all visible elements for one whose fully-qualified name matches this. If
  there is no match found, the reference cannot be to an element in this scope.
  Continue to the next scope.

  If the matched element is not a package, message, or service, act as if no match was
  found. (These are the only elements that also correspond to scopes, in which the rest
  of the reference may be found.) Continue to the next scope.

  Since we've matched the first name component, we have identified the correct
  scope in which the referenced element must exist.

  Now compute a new candidate fully-qualified name, as above, using the entire
  reference. Using the same example, a reference `Baz.Buzz` inside of a package scope
   `foo.bar` results in a candidate name of `foo.bar.Baz.Buzz`.

  Examine all visible elements for one whose fully-qualified name matches this new
  candidate. If there is no match found, the reference does not refer to any visible
  element and is therefore not valid.

  If we make it this far, resolution is complete: the candidate name fully identifies the referenced
  element.
</dd>
</dl>

When resolution succeeds, a subsequent check is necessary to make sure that the kind of
the referenced element is valid in the referring context. For example, only extensions
are allowed in option names; only messages are allowed in RPC method input and output
types; only messages are allowed as the extendee name for extensions; only messages and
enums are allowed in field types.


## Options

Many elements defined in a source file allow the user to
specify options, which provide a way to customize behavior and also
provide the ability to use custom annotations on elements (which can
then be used by code generation plugins or runtime libraries).
```ebnf
OptionDecl = option OptionName equals OptionValue semicolon .
```

```txt title="Examples"
option deprecated = true;
option (foo.bar.Message) = { a:1 b:2 c:3 };
option (foo.bar).flags = 0x5467;
```

These declarations may appear as top-level declarations in the file, in which
case they describe options for the file itself. They may also appear inside
any block declaration, in which case they describe options for the enclosing
element.

Some elements that use a simple declaration can also have options, in which
case a more compact syntax is used.
```ebnf
CompactOptions = l_bracket CompactOption { comma CompactOption } r_bracket .

CompactOption  = OptionName equals OptionValue .
```

```txt title="Examples"
[deprecated = true]
[default = "unset", json_name = "EnrollStatus", (validator.Required) = true]
[ (foo.bar.Message) = { a:1, b:2, c:"three" } ]
```

### Option Names

Option names refer to fields on the various concrete options messages, described
in more detail in the next section below. Parenthesized names refer to extension
fields. An extension on one of the concrete option types is also called a
"custom option".
```ebnf
OptionName = ( SimpleName | ExtensionName ) [ dot OptionName ] .

SimpleName    = identifier .
ExtensionName = l_paren TypeName r_paren
```

```txt title="Examples"
deprecated
json_name
(foo.bar)
abc.def.xyz
(foo).bar.(.baz.bob)
```

No option can be declared that references the name `uninterpreted_option`. This
only applies for a standard option (i.e. name is not in parentheses). There are
other restrictions on option names in specific contexts, described throughout this
document, and they also only apply to an un-parenthesized name.

An option name can have multiple components, separated by dots (`.`), which form
a path to a field that is nested inside a message structure. More than one component
is only valid if the first component named an option whose type is a message. See
the next section for more details.

#### Resolving Option Names

Each component of an option name can refer to either a normal field, if it is an
un-parenthesized identifier, or an extension field, if it is a parenthesized
reference. The name components are processed in sequence, from left to right.
They cumulatively define a path to a field inside one of the above concrete options
types.

Resolving these names to fields in a message first requires knowing which concrete
options type to use. And that depends on the context -- the kind of element on which
the options are being defined:

| Context         | Options message                                                                                                                           |
|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| file \*         | [google.protobuf.FileOptions](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L341)           |
| message †       | [google.protobuf.MessageOptions](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L466)        |
| field ‡         | [google.protobuf.FieldOptions](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L534)          |
| oneof           | [google.protobuf.OneofOptions](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L638)          |
| extension range | [google.protobuf.ExtensionRangeOptions](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L128) |
| enum            | [google.protobuf.EnumOptions](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L646)           |
| enum value      | [google.protobuf.EnumValueOptions](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L667)      |
| service         | [google.protobuf.ServiceOptions](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L681)        |
| method          | [google.protobuf.MethodOptions](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L701)         |

__*__ An option that is a top-level declaration, not in the context of
any other element, is in the file context.

__†__ In the context of a [group](#groups), option declarations inside the
group's body are considered to be message options.

__‡__ In the context of a [group](#groups), compact option declarations
that precede the group's body are considered to be field options.

All of the above concrete options have a field named `uninterpreted_option`
which is for internal use only. (Option declarations may not refer to this
field.)

To resolve an option name, we start with the relevant message type (from
the table above) as the context message. For each name component, we do the
following:

* The current name component must be a field defined on the context message.
  If the name is parenthesized, it refers to a custom option, which must be an
  extension field on the context message. If the context message has no such
  field or extension, the option name is not valid.
* If there are no more name components, the option name has been successfully
  resolved! The named field is the one to which the option name refers.
* If there are more name components, the named field's type must be a message
  type and must not be repeated or a map type. So if it's not a message type
  or if it's a repeated or map field, the option name is not valid.

  The named field's message type becomes the new context message, and we can
  continue to the next name component.

At the end of this process, we have resolved the option name to a particular
field.

Multiple option names may refer to other fields inside the same messages.
This is known as a de-structured message, where the message's contents are
defined across multiple option declarations, instead of with a single
declaration that uses a message literal. When de-structuring, it is not
allowed for one option to override a value in the same field set by
another option. It is also not allowed for two options to set different
fields in the same oneof (only one may be set).

Multiple option names _may_ refer to the same field, however, if it is a
repeated field. In this case, later values are not overriding earlier ones.
Instead, all the values in the order they appear in source are concatenated
into a single list of values for the repeated field.

The example below demonstrates both of these:
```protobuf
option (google.api.http).custom.kind = "FETCH";
option (google.api.http).custom.path = "/foo/bar/baz/{id}";
option (google.api.http).additional_bindings = {
    get: "/foo/bar/baz/{id}"
};
option (google.api.http).additional_bindings = {
    post: "/foo/bar/baz/"
    body: "*"
};
```

The following is equivalent to the above, and instead uses a single message
literal instead of de-structuring:
```protobuf
option (google.api.http) = {
    custom: {
        kind: "FETCH"
        path: "/foo/bar/baz/{id}"
    }
    additional_bindings: [
      {
          get: "/foo/bar/baz/{id}"
      },
      {
          post: "/foo/bar/baz/"
          body: "*"
      }
    ]
};
```

The following is a more comprehensive example showing how custom options
can be defined and used, including the use of extensions in the option
name, both as a custom option name as well as to set an extension field
deeper in the option's structure:
```protobuf
syntax = "proto2";

package foo.bar;

import "google/protobuf/descriptor.proto";

message ExtendableOption {
  optional string name = 1;
  optional uint64 id = 2;
  message Inner {
    optional int32 x = 1;
    optional int32 y = 2;
    extensions 10 to 20;
  }
  optional Inner inner = 3;
}

extend google.protobuf.FileOptions {
  optional ExtendableOption ext = 12121;
}

extend ExtendableOption.Inner {
  repeated string tag = 10;
}

option (foo.bar.ext).name = "Bob Loblaw";
option (foo.bar.ext).inner.x = 100;
option (foo.bar.ext).inner.y = 200;
option (foo.bar.ext).inner.(foo.bar.tag) = "foo";
option (foo.bar.ext).inner.(foo.bar.tag) = "bar";
```

### Option Values

Option values are literals. In addition to scalar literal values
(like integers, floating point numbers, strings, and booleans), option
values can also be a message literal, which describes a more complex
piece of data. Message literals must be enclosed in braces (`{` and `}`).
```ebnf
OptionValue = ScalarValue | MessageLiteralWithBraces .

ScalarValue  = StringLiteral | UintLiteral | IntLiteral | FloatLiteral | identifier .
UintLiteral  = [ plus ] int_literal .
IntLiteral   = minus int_literal .
FloatLiteral = [ minus | plus ] ( float_literal | inf ) .

MessageLiteralWithBraces = l_brace MessageTextFormat r_brace .
```

```txt title="Examples"
+inf
true
nan
-123
456.789e+101
+1.0203
"foo bar"
'foo-bar-baz'
{ name:"Bob Loblaw" id:123 profession:"attorney" loc<lat:-41.293, long: 174.781675> }
```

Identifiers are used as option values in the following cases:
* If the option's type is an enum type, use identifiers for the unqualified enum value names.
* If the option's type is boolean, use `true` and `false` identifiers as values.
* If the option's type is a floating point number, one may use `inf` and `nan` identifiers as values.

To set multiple values when an option field is repeated, use multiple option
declarations with the name of that field. It is an error to use multiple option
declarations in the same context and with the same name unless the named field
is repeated.

It is an error to use multiple option declarations in the same context that all
name different fields of a oneof. Since only one of the fields can be set at a time,
declarations that attempt to set more than one are not allowed.

### Protobuf Text Format

For option values that are message literals, the syntax is the same as the
Protobuf "text format", enclosed inside of braces (`{` and `}`):
```ebnf
MessageTextFormat = { MessageLiteralField [ comma | semicolon ] } .

MessageLiteralField = MessageLiteralFieldName colon Value |
                      MessageLiteralFieldName MessageValue .

MessageLiteralFieldName = FieldName |
                          l_bracket SpecialFieldName r_bracket .
SpecialFieldName        = ExtensionFieldName | TypeURL
ExtensionFieldName      = QualifiedIdentifier .
TypeURL                 = QualifiedIdentifier slash QualifiedIdentifier .

Value          = ScalarValue | MessageLiteral | ListLiteral .
MessageValue   = MessageLiteral | ListOfMessagesLiteral .
MessageLiteral = MessageLiteralWithBraces |
                 l_angle MessageTextFormat r_angle .

ListLiteral = l_bracket [ ListElement { comma ListElement } ] r_bracket .
ListElement = ScalarValue | MessageLiteral .

ListOfMessagesLiteral = l_bracket [ MessageLiteral { comma MessageLiteral } ] r_bracket .
```

```txt title="Examples"
a:123 b:456
addr{num: 3 st: "Abbey Rd" city: "London" postal_code: "NW8 9AY" country: "UK"}
single:1 repeated:["a", "b", "c", "d", "e", "f"]
[foo.bar]: "extension value"
```

Field names may refer to normal fields. But if the name is enclosed in brackets (`[` and `]`)
then it refers to an extension field. For extension fields, the reference is not allowed to
include a leading dot (indicating it is already fully-qualified). Extension names in the text
format are resolved in the same fashion as other [relative references](#relative-references).

List literals are only valid inside the text format, which means they can be used in option
values only inside a message literal. So, for repeated options that are not nested inside a
message, the list literal syntax cannot be used. Instead, the source file must define multiple
options, all naming the same repeated option, each one with an element of the list. The option's
final value is the concatenation of all values for that field, in the order in which they
appear in the source.

The grammar only allows the separating colon (`:`) between field name and value to be omitted
when the value is a message literal or a list of message literals. This still allows an empty
list to be used without a preceding colon. However, when interpreting options, if the actual
field type for the value is not a message type, a missing colon is considered a syntax error,
even if the value is an empty list literal.

The kind of value that appears in this format must be compatible with the type of the
named field:

| Field Type                                                   | Allowed Value Types                                         |
|--------------------------------------------------------------|-------------------------------------------------------------|
| `int32`, `int64`, `sint32`, `sint64`, `sfixed32`, `sfixed64` | _UintLiteral_ \*, _IntLiteral_ \*                           |
| `uint32`, `uint64`, `fixed32`, `fixed64`                     | _UintLiteral_ †                                             |
| `float`, `double`                                            | _FloatLiteral_, _UintLiteral_, _IntLiteral_, _identifier_ ‡ |
| `bool`                                                       | _identifier_ §                                              |
| `string`, `bytes`                                            | _StringLiteral_                                             |
| An enum type                                                 | _identifier_, _UintLiteral_ ¶, _IntLiteral_ ¶               |
| A message type                                               | _MessageLiteral_                                            |

__*__ Integer field types can only use _UintLiteral_ and _IntLiteral_ values if the
represented number is in the range [-2<sup>31</sup>,2<sup>31</sup>) for 32-bit types
or [-2<sup>63</sup>,2<sup>63</sup>) for 64-bit types.

__†__ Unsigned integer field types can only use _UintLiteral_ values if the
represented number is in the range [0,2<sup>32</sup>) for 32-bit types
or [0,2<sup>64</sup>) for 64-bit types.

__‡__ Floating point field types can only use _identifier_ values if the identifier
is `inf` or `nan`.

__§__ Boolean field types can only use identifiers `true`, `false`, `True`, `False`,
`T`, and `F` as values. Note that all of these may be used inside the text format, in a
message literal. But for non-message options (e.g. option values _outside_ the text format),
only `true` and `false` can be used.

__¶__ Enum fields may only use numeric values inside a message literal. If the enum type
is _open_ (defined in a file using proto3 syntax) then any value is allowed as long as
it is in the range for 32-bit integers: [-2<sup>31</sup>,2<sup>31</sup>). If the enum type
is _closed_ (defined in a file using proto2 syntax) then the numeric value must match one
of the enum's known named values.

#### Any Messages

If the type of the message literal is `google.protobuf.Any`, a custom format is allowed. This
custom format looks like a message literal with a single key. That one key is the type URL,
enclosed in brackets. The type URL includes the name of the concrete message type contained
therein. The value for this key is another message literal: the text format of that concrete
message type. A type URL (and thus a key with a slash `/` in it) is not allowed in the field
name of a message literal other than this special case.

The following shows an example of an option with an `Any` value in it that uses this
custom syntax:
```protobuf
syntax = "proto3";

package foo.bar;

import "google/protobuf/descriptor.proto";

extend google.protobuf.MessageOptions {
    google.protobuf.Any extra = 33333;
}

message MyOptionData {
    string name = 1;
    uint64 id = 3;
}

message MyMessage {
    // highlight-start
    option (extra) = {
        [type.googleapis.com/foo.bar.MyOptionData]: {
            name: "foobar"
            id: 42
        }
    };
    // highlight-end
}
```

The reference compiler, `protoc`, only supports this syntax when the domain
in the URL is "type.googleapis.com" or "type.googleprod.com". The definition
of the named message is resolved the same way as if a field type referred to
the message. Therefore, the message type indicated in the type URL *must be
[visible](#visibility) to the file*.

:::note
The compiler does _not_ make an HTTP request for the given URL to resolve the details
of the type. Instead, it relies on available sources that are included in the compilation
operation.

Alternate compilers could support URLs with domains other than "type.googleapis.com" and
"type.googleprod.com". However, such support is hampered by the fact that the grammar
does not currently support additional path components in the type URL and does not even
support the full range of allowed characters in a URL path component.
:::

## Messages

The core of the Protobuf IDL is defining messages, which are heterogeneous
composite data types.
```ebnf
MessageDecl = message MessageName l_brace { MessageElement } r_brace .

MessageName    = identifier .
MessageElement = FieldDecl |
                 MapFieldDecl |
                 GroupDecl |
                 OneofDecl |
                 OptionDecl |
                 ExtensionRangeDecl |
                 MessageReservedDecl |
                 MessageDecl |
                 EnumDecl |
                 ExtensionDecl |
                 EmptyDecl .
```

```txt title="Example"
message UserData {
  option deprecated = true;
  message Name {
    string first = 1;
    string mi = 2;
    last = 3;
  }
  Name name = 1;
  repeated string tags = 2;
}
```

:::info

Files using the proto3 syntax are not allowed to include _GroupDecl_ or
_ExtensionRangeDecl_ elements.

Messages are not allowed to include an option named `map_entry`, regardless of syntax level.

:::

In addition to being a composite data type, messages are also a level of namespacing.
Nested messages, enums, and extensions declared inside a message have no relation to the
enclosing message, other than the fact that their fully-qualified name includes the name
of the enclosing message.

A top-level message is considered to be at a nesting depth of 1. Its children are at a
nesting depth of 2, and so on. It is an error to have a message with a nesting depth of
32 or higher.

### Fields

Field declarations found directly inside messages are "normal fields". They can also be
found inside `extends` blocks, for defining [extension fields](#extensions).

Each field indicates its cardinality (`required`, `optional`, or `repeated`; also called
the field's "label"), its type, its name, and its tag number.
```ebnf
FieldDecl = [ FieldCardinality ] TypeName FieldName equals FieldNumber
            [ CompactOptions ] semicolon .

FieldCardinality = required | optional | repeated .
FieldName        = identifier .
FieldNumber      = int_literal .
```

```txt title="Examples"
int32 sum = 1;
optional string name = 123;
Foo.Bar bar = 42;
required bool yes = 10101 [deprecated=true];
```

:::info

In a file using the proto2 syntax, fields *must* include a cardinality
(despite it being optional in the production above).

In a file using the proto3 syntax, fields are not allowed to use the `required`
cardinality, are not allowed to include an option named `default`, and are not
allowed to refer to enum types that are defined in files that use proto2 syntax.

:::

Fields in a message are identified both by name and by number. The number, also
called the "tag", is used in the binary format, for a more compact on-the-wire
representation. This also means a field can be renamed without impacting on-the-wire
compatibility.

When the cardinality is omitted, the subsequent type name
may *not* start with an identifier that could be confused for another
statement in this scope (something other than a field declaration). So such
field declarations inside a message declaration may not have a type name that
starts with any of the following identifiers:
* "message"
* "enum"
* "oneof"
* "extensions"
* "reserved"
* "extend"
* "option"
* "optional"
* "required"
* "repeated"

Similarly, a field declaration in an `extends` block that omits the cardinality
may not have a type name that starts with any of the following identifiers:
* "optional"
* "required"
* "repeated"

Note that it is acceptable if the above words are _prefixes_ of the first token in
the type name. For example, inside a message a type name "enumeration" is allowed, even
though it starts with "enum". But a name of "enum.Statuses" would not be allowed, because
the first constituent token is "enum". A _fully-qualified_ type name (one that starts with
a dot) is always accepted, regardless of the first identifier token, since the dot prevents
ambiguity.

#### Field Numbers

Field numbers must be greater than zero. The maximum allowed value is
536,870,911 (2<sup>29</sup>-1) for normal fields. The same limit holds for extension
fields, too, unless the extended message uses [message set wire format](#message-set-wire-format),
in which case the maximum allowed value is 2,147,483,646 (2<sup>31</sup>-2).

In this range, between 1 and 536,870,911, there is a restricted range that may not be
used for any field: 19,000 to 19,999 (inclusive). These numbers are reserved for internal
runtime use. It is allowed for a reserved range or extension range to overlap this
special restricted range, but no actual field or extension can be declared with a
number in the range.

:::tip

When creating messages, authors should prefer lower numbers: unmarshaling a message is
typically optimized for smaller field numbers, and smaller values are more efficiently
encoded and decoded. So it is recommended to always start numbering fields at 1 and to
use smaller values for more commonly used fields when possible.

:::

The numbers assigned to a message's fields must be distinct: two fields may not use the
same number. Furthermore, a field's number must not be contained by any of the message's
reserved ranges. And numbers for normal fields may not be contained by any of the message's
extension ranges.

#### Field Types

When defining a field, the type name may refer to a [message or enum type](#type-references).
But it may also use one of the following pre-defined scalar type names:

| Scalar type names             | Description                                                           |
|-------------------------------|-----------------------------------------------------------------------|
| `int32`, `sint32`, `sfixed32` | 32-bit signed integers, in the range [-2<sup>31</sup>,2<sup>31</sup>) |
| `int64`, `sint64`, `sfixed64` | 64-bit signed integers, in the range [-2<sup>63</sup>,2<sup>63</sup>) |
| `uint32`, `fixed32`           | 32-bit unsigned integers, in the range [0,2<sup>32</sup>)             |
| `uint64`, `fixed64`           | 64-bit unsigned integers, in the range [0,2<sup>64</sup>)             |
| `float`                       | 32-bit (single precision) IEEE 754 floating point value               |
| `double`                      | 64-bit (double precision) IEEE 754 floating point value               |
| `bool`                        | A boolean value (true or false)                                       |
| `string`                      | A sequence of UTF-8-encoded characters, of length zero or greater.    |
| `bytes`                       | A sequence of bytes, of length zero or greater.                       |

As seen above, there are multiple type names that map to the same kind of integer value.
These different names refer to different ways of encoding the value on the wire.

| Scalar type names                    | Encoding                                                                                                                        |
|--------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| `int32`, `int64`, `uint32`, `uint64` | [Variable length encoding, least significant group first](https://developers.google.com/protocol-buffers/docs/encoding#varints) |
| `sint32`, `sint64`                   | [Variable length encoding, zig-zag order](https://developers.google.com/protocol-buffers/docs/encoding#signed-ints)             |
| `fixed32`, `sfixed32`                | Fixed length encoding, 4 bytes (32 bits)                                                                                        |
| `fixed64`, `sfixed64`                | Fixed length encoding, 8 bytes (64 bits)                                                                                        |

:::info

In a file using the proto3 syntax, a field's type may _not_ refer to an enum
type that is declared in a file that uses the proto2 syntax. Enum semantics
around [default values](#field-presence-and-default-values) in the proto2 syntax
are not compatible with message semantics and [default cardinality](#cardinality)
in the proto3 syntax.

:::

#### Cardinality

If the cardinality is omitted, `optional`, or `required`  then the field can have a
normal, singular value. If the cardinality is `repeated` then the field can have one
or more values and is represented as a list or an array of values.

When the cardinality is `required`, a message is considered invalid if the field is
not present.

:::caution

When using the proto2 syntax, use of `required` is considered hazardous and is
strongly discouraged.

When a field is required, runtime libraries do not even allow de-serializing a
message if the field is missing. This makes it difficult in practice to change a
required field to be optional in the future (or vice versa), because it becomes
likely for consumers of the message, working with a different version of the
schema, to refuse to de-serialize it. This is why it is not supported in the
proto3 syntax.

For that reason, if you want to enforce that a field is present, define the field
as `optional` in the source file and then use application-level validation logic
to verify that it's present (the same way that other custom validation rules would
be enforced).

:::

When the cardinality is omitted on a normal field definition that is not contained
inside a onoef (proto3 syntax only), it is known as _default_ cardinality. But for
fields inside a oneof, the cardinality is always `optional`. If an extension field
definition omits the cardinality, it behaves the same as `optional` cardinality, not
default.

| Cardinality | Number of values                         | Supports [field presence](#field-presence-and-default-values) |
|-------------|------------------------------------------|---------------------------------------------------------------|
| _default_   | Message types: 0 (absent) or 1 (present) | Yes                                                           |
|             | Scalar types: 1                          | No                                                            |
| `optional`  | 0 (absent) or 1 (present)                | Yes                                                           |
| `repeated`  | 0 or more                                | No                                                            |
| `required`  | 1                                        | N/A (must be present)                                         |

With default cardinality (proto3 syntax only), scalar fields are only emitted during
serialization if they contain a value other than the default (which is always the
zero value in proto3 syntax).

#### Field Presence and Default Values

A field that is present is one whose value is explicitly set. Similarly, a field
that is absent is one whose value was never explicitly set. If a field's presence
can be determined, that quality is preserved in the face of serialization. In other
words, after de-serializing a message, it would be possible to detect if the field
was explicitly set before it was serialized.

A field supports field presence if it is possible to distinguish at runtime
between the case where a field is absent and where a field is present but has
its default value.

Every field has a default value. When the value of a field is examined, if the
field is not present, its default value is observed. The default value for a field
is the zero value for its type, unless customized, _except_ for enum types that
are defined in a file that uses the proto2 syntax. For these enums, the default
value is the first value declared inside the enum (which might not be the number
zero). The default can only be customized in the proto2 syntax and only for
`optional` fields with scalar types.

The zero value for repeated fields and map fields is an empty list or map. The
zero value for a non-repeated field depends on the field's type:

| Type                 | Zero value                              |
|----------------------|-----------------------------------------|
| _all numeric types_  | 0                                       |
| `bool`               | `false`                                 |
| `string`             | `""` (empty string)                     |
| `bytes`              | `""` (empty bytes)                      |
| _enum types_         | _the first value defined in the enum_ * |
| _message types_      | `{}` (empty message)                    |

__*__ In proto3 syntax, the first value in an enum _must_ have a numeric
      value of zero. So, in proto3, the default value of an enum field is
      the one with a value of zero.

In most runtimes, an _absent_ value is represented using a sentinel value like
`nil`, `null`, or `None` (specific to the implementation language), which
can be distinguished from any other value of the field's type. This "sentinel
null" value means that the field is not present. So, even if the field supports
presence, it is not possible to detect if the field was explicitly set to a
sentinel null value.

With repeated and map fields, it is not possible for the list or map to contain
an _absent_ value. If a sentinel null value is used as an element inside a list
or value inside a map, it will get transformed to a zero value if serialized and
then de-serialized. Some runtime implementations may even refuse to serialize
such a message and consider the presence of a sentinel null value inside a list
or map value to mean the message is malformed.)

#### Maps

Fields can be defined whose type is a map -- a set of distinct keys, each of which is
associated with a value. Such fields use an alternate syntax. They do not include an
explicit cardinality because they are always implicitly repeated, since a map can have
more than one entry.
```ebnf
MapFieldDecl = MapType FieldName equals FieldNumber [ CompactOptions ] semicolon .

MapType      = map l_angle MapKeyType comma MapValueType r_angle .
MapKeyType   = int32   | int64   | uint32   | uint64   | sint32 | sint64 |
               fixed32 | fixed64 | sfixed32 | sfixed64 | bool   | string .
MapValueType = TypeName .
```

```txt title="Examples"
map<uint32,string> names_by_id = 5 [json_name="NamesByID"];
map<string, .foo.bar.Baz> bazes = 222;
map < fixed64, fixed64 > bits_and_bits = 16;
```

The set of types allowed as a map key is restricted since the key must have a
clear notion of value-based identity, so that duplicate keys can be identified,
to ensure uniqueness.

The actual value for a field type may not have more than one value associated
with any given key. If a value on the wire indicates duplicate keys, when the
map is deserialized, only the last value for the key is retained and earlier,
duplicate values are discarded.

Maps _implicitly_ declare a nested message named `<PascalCaseName>Entry`, where
_PascalCaseName_ is the field's name converted to [Pascal case](https://en.wiktionary.org/wiki/Pascal_case).
For example, a map field named `settings_dictionary` would result in an implicitly
declared message named `SettingsDictionaryEntry`. Thus it is an error for a message
to contain _both_ a map field named `settings_dictionary` and an explicit nested
message named `SettingsDictionaryEntry` as this would result in a name conflict for
the nested message.

The logic to compute the Pascal case name for map entry messages is identical to the
logic to compute the [JSON name](#default-json-names), except that the first character
is forced to be upper-case.

The synthetic message is defined with two fields: `key` and `value`, with field
numbers 1 and 2 respectively. The types of these fields matches the key and value
types in the declaration. It also uses a special message option named `map_entry`,
indicating to code generators that this is the entry for a map field.

The following example demonstrates the way the synthetic message looks:
```protobuf
// Map type:
message Foo {
    map<string, FooSettings> settings_by_name = 1;
}

// Behaves as if:
message Foo {
    message SettingsByNameEntry {
        option map_entry = true;

        string key = 1;
        FooSettings value = 2;
    }
    repeated SettingsByNameEntry settings_by_name = 1;
}
```
Note that the second message in the above example is hypothetical: it is
not actually valid because explicit use of the `map_entry` message option
is prohibited.

:::info

The synthetic map entry message may _not_ be directly referenced by other
field definitions. For example, the following is invalid:

```protobuf
message Foo {
  map<string, bytes> data_by_name = 1;
}

message Bar {
  // highlight-start
  // The field below tries to refer to the synthesized map entry
  // message, which is not allowed.
  Foo.DataByNameEntry extra = 1;
  // highlight-end
}
```

:::

The [Protobuf text format](#protobuf-text-format) does not include any special
syntax for map fields. Instead, the text format looks as if they were defined
like the second example above: a repeated field whose type is a map entry
message. Since the text format is used to define message literals in custom
options, map fields used in custom options are represented this way. Below is
an example:
```protobuf
syntax = "proto3";

import "google/protobuf/descriptor.proto";

message MyOption {
    map<string, string> switches = 1;
}

extend google.protobuf.MessageOptions {
    MyOption my_option = 33333;
}

message MyMessage {
    // highlight-start
    option (my_option) = {
        switches: [
          { key: "foo"  value: "fizzle" }
          { key: "bar"  value: "barrels" }
          { key: "baz"  value: "bedazzle" }
        ]
    };
    // highlight-end
}
```

#### Groups

:::info

Groups cannot be used in files that use the proto3 syntax.

:::

Groups are like a shorthand mechanism in proto2 for defining both a nested message
and a field of that message type, in a single declaration. The message definition is
inlined into the group field declaration.
```ebnf
GroupDecl = [ FieldCardinality ] group FieldName equals FieldNumber
            [ CompactOptions ] l_brace { MessageElement } r_brace .
```

```txt title="Example"
group User = 5 {
  optional string name = 1;
  optional string address = 2;
  optional string ss_num = 3;
  optional uint32 birth_month = 4;
  optional uint32 birth_day = 5;
  repeated string extra = 6;
}
```

The group's name must start with a capital letter. In some contexts, the group field
goes by the lower-cased form of this name.

The body inside the braces is subject to all the same rules as a message declaration.

Groups result in a nested message with the group's name and an implicit field whose
name is the group's name converted to all lowercase. For example, a group named
`SecurityOptions` would result in an implicitly declared field named `securityoptions`.
Thus it is an error for a message to contain _both_ a group named `SecurityOptions`
and an explicit field named `securityoptions` as this would result in a name
conflict for the field.

The field use the number and options declared prior to the opening brace; the message
has all the contents inside the braces. The following example demonstrates the way the
synthetic message looks:
```protobuf
// Group:
message Foo {
    optional group Bar = 1 [json_name = 'bbarr'] {
        option deprecated = true;

        optional uint32 id = 1;
        optional string name = 2;
    }
}

// Behaves as if:
message Foo {
    message Bar {
        option deprecated = true;

        optional uint32 id = 1;
        optional string name = 2;
    }
    optional Bar bar = 1 [json_name = 'bbarr'];
}
```
The only functional difference between the above two messages is that the one
that uses a group has a slightly different representation on the wire. Groups
are encoded in the binary format a little differently than other fields whose
type is a message.

The nested message derived from the group behaves in all other respects as a
normal nested message and can be used by other messages:
```protobuf
message Foo {
    optional group Bar = 1 {
        optional uint32 id = 1;
        optional string name = 2;
    }
}

message Baz {
    // Allowed to reference the group as if it
    // were a normal nested message
    // highlight-start
    optional Foo.Bar bar = 1;
    // highlight-end
}
```

#### Pseudo-Options

Fields support two "pseudo-options" -- options whose names do not correspond to
any field on the relevant options message:

* **`default`**:
  In proto2 syntax, this option can be used for non-repeated fields with scalar types to
  define a custom default value for when the field is absent. Without a custom default,
  the field's default value is usually the zero value for the field's type. Read more
  about default values [here](#field-presence-and-default-values).

  The custom default value's type must match the field's type. For example, on a field
  whose type is `string`, the value of the `default` pseudo-option must be a string literal.
  If the field's type is an enum, the `default` value must be an identifier that indicates
  one of the enum's values.

  This pseudo-option is not allowed when using proto3 syntax.

* **`json_name`**:
  This option is used to customize the JSON representation of a message. By default, the
  JSON form will be a JSON object whose keys are derived from the fields' names. But this
  option can be used to supply a custom key for a field. The value of this pseudo-option
  must be a string.

  Custom JSON names may _not_ start with an open bracket (`[`) and end with a close
  bracket (`]`) since that denotes an extension field name in the JSON format.

  Extension fields are not allowed to use this pseudo-option. Extension names are always
  represented in JSON as the extension's fully-qualified name enclosed in brackets (`[`
  and `]`).

##### Default JSON Names

If no `json_name` pseudo-option is present, the JSON name of the field will be the field's
name converted to camelCase. To convert to camelCase:
* Discard any trailing underscores (`_`)
* When a leading or interior underscore is encountered, discard the underscore and
  capitalize the next non-underscore character encountered.
* Any other non-underscore and non-capitalized character is retained as is.

Here are some examples:

| Field name     | Default JSON name |
|----------------|-------------------|
| `foo_bar_baz`  | `fooBarBaz`       |
| `__foo__bar__` | `FooBar`          |
| `FooBar`       | `FooBar`          |

The above applies only to normal fields. For extensions, the JSON name of the field will
be the extension's fully-qualified name enclosed in brackets (`[` and `]`).

#### JSON Name Conflicts

To avoid possible conflicting field names in the JSON format for a message, fields are
checked for possible conflicts. This check proceeds in two steps:

1. First, the field's _default_ JSON name is checked for conflicts against all other
   fields' default JSON names. If fields have custom JSON names defined, they are ignored
   in this step. Fields _default_ JSON names must also be unique since the JSON format for
   [field masks](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#json-encoding-of-field-masks)
   does not currently consider custom JSON names.
2. Second, the field's _effective_ JSON name is checked for conflicts against all other
   fields' effective JSON names. A field's effective JSON name is its custom JSON name
   (defined by the `json_name` pseudo-option) or its default JSON name if no custom JSON
   name is defined. When comparing the JSON names for two fields, if neither field has a
   custom JSON name, the comparison should be skipped since a conflict would have already
   been reported in the first step above.

If a conflict is found, the message definition is invalid.

:::info

The JSON format was introduced at the same time as the proto3 syntax. For backwards
compatibility, it is not an error for files using the proto2 syntax to have fields
whose _default_ JSON names conflict with one another (step one above). A compiler may
still choose to issue a warning for this condition.

:::

### Oneofs

A "oneof" is a set of fields that act like a discriminated union. At runtime, only zero
or one field may be populated. If a field is set, but another field in the oneof is already
set, that other field gets unset. (There can be only one.)
```ebnf
OneofDecl = oneof OneofName l_brace { OneofElement } r_brace .

OneofName    = identifier .
OneofElement = OptionDecl |
               OneofFieldDecl |
               OneofGroupDecl .
```

```txt title="Example"
oneof authentication_method  {
   PasswordVersion password = 1;
   OIDCProvider oidc = 2;
   SAMLConnectionID saml = 3;
   OTPKind otp = 4;
   OAuth2ClientID access_token = 5;
}
```

:::info

Files using the proto3 syntax are not allowed to include _OneofGroupDecl_ elements.

:::

A oneof must contain at least one field or group. Fields in a oneof always omit
the cardinality (`required`, `optional`, or `repeated`) and are always optional.
```ebnf
OneofFieldDecl = TypeName FieldName equals FieldNumber
                 [ CompactOptions ] semicolon .
```

These fields follow the same restrictions as other field declarations
that have no leading cardinality: the first token of the _TypeName_ may not be an
identifier whose text could be ambiguous with other elements. It also may not
match any of the cardinality keywords. To that end, fields in a oneof may not have
a type name that starts with any of the following:
* "option"
* "optional"
* "required"
* "repeated"

Oneofs may also define group fields. A group's name must start with a capital letter. In
some contexts, the group field goes by the lower-cased form of this name.
```ebnf
OneofGroupDecl = group FieldName equals FieldNumber
                 [ CompactOptions ] l_brace { MessageElement } r_brace .
```

Just like groups defined directly in the message, this is shorthand for defining both
a nested message and a field. But in this case, the field is inside a oneof.

### Extension Ranges

:::info

Extension ranges cannot be declared in files that use the proto3 syntax.

:::

Extendable messages (proto2 syntax only) may define ranges of tags that are reserved
for extensions. Extension fields for the message must use a tag number in one of these ranges.
```ebnf
ExtensionRangeDecl = extensions TagRanges [ CompactOptions ] semicolon .

TagRanges     = TagRange { comma TagRange } .
TagRange      = TagRangeStart [ to TagRangeEnd ] .
TagRangeStart = FieldNumber .
TagRangeEnd   = FieldNumber | max .
```

```txt title="Examples"
extensions 100;
extensions 10 to 10000;
extensions 10 to 20, 50 to 100, 20000 to max [(foo.bar) = "baz"];
```

When the `max` keyword is used as the end of the range, it is interpreted as the maximum
allowed tag number, 536,870,911. _However_, if the message uses the [message set wire format](#message-set-wire-format),
the maximum tag number is instead 2,147,483,646 (2<sup>31</sup>-2).

If the end of the range is absent (the tag range is just a single number), it is
interpreted as an open range (i.e. inclusive) where the start and end values are the same.

Extension ranges for the same message are not allowed to overlap one another and also
not allowed to overlap any reserved range of numbers.

### Reserved Names and Numbers

Messages can reserve field names and numbers to prevent them from being used.
This is typically to prevent old tag numbers and names from being recycled.
```ebnf
MessageReservedDecl = reserved ( TagRanges | Names ) semicolon .

Names = StringLiteral { comma StringLiteral } .
```

```txt title="Examples"
reserved 100;
reserved 10 to 10000;
reserved 10 to 20, 50 to 100, 20000 to max;
reserved "foo";
reserved "foo", "bar", "baz";
```

Just like extension ranges, the `max` keyword is equivalent to 536,870,911, except for
in messages that use the message set wire format (in which case the max is 2,147,483,646).

When a field number is reserved, the message's fields may not use that number. Extension
fields that extend the message also may not use that number.

Similarly, when a field name is reserved, it is not allowed to be used by any of the
message's fields. (Extension names are exempt from this since they are always
identified by their fully-qualified name.) The contents of the string literal that
defines the reserved name must represent a valid identifier. In other words, they
must match the production for the [_identifier_](#identifiers-and-keywords) lexical
element.

Reserved ranges for the same message are not allowed to overlap one another and also
not allowed to overlap any extension range.

### Message Set Wire Format

If a message includes an option named `message_set_wire_format` whose value is `true`
then that message uses the message set wire format. This is an alternate encoding
scheme (which is why field numbers for such messages have a different range).

:::caution

The message set wire format is **deprecated**. Its use is
strongly discouraged and is supported in few target runtimes.

:::

Messages defined with this option have a few additional constraints:
1. The message must be in a file that uses the proto2 syntax. Files that use proto3
   syntax are not allowed to define messages that use the message set wire format.
2. The message must _not_ define any normal fields (no map fields or groups either).
3. The message _must_ define at least one extension range.
4. Extensions of such messages must be optional (no repeated extensions allowed).
5. Extensions of such messages must have a message type (no scalar extensions allowed).


## Enums

Enums represent an enumerated type, where values must be one of the defined
enum values.
```ebnf
EnumDecl = enum EnumName l_brace { EnumElement } r_brace .

EnumName    = identifier .
EnumElement = OptionDecl |
              EnumValueDecl |
              EnumReservedDecl |
              EmptyDecl .
```

```txt title="Example"
enum JobState {
  PENDING = 0;
  QUEUED = 1;
  STARTED = 2;
  FINISHED = 3;
  FAILED = 4;
}
```

Enums defined inside files using the proto3 syntax are considered **open**. That means
that other numeric values, outside the set of named enum values, are acceptable. Enums
in files using the proto2 syntax, on the other hand, are **closed**. This means that
unrecognized numeric values are not acceptable. When unmarshaling the value for a closed
enum field, if the value is not recognized, it is treated as if it were unrecognized
field. In other words, the enum field will remain absent, and the unrecognized value
(along with the tag number preface) will be stored with the message's unrecognized
fields.

### Enum Values

Enums must contain at least one enum value.
```ebnf
EnumValueDecl = EnumValueName equals EnumValueNumber [ CompactOptions ] semicolon .

EnumValueName   = identifier .
EnumValueNumber = [ minus ] int_literal .
```

```txt title="Examples"
JOB_STATE_UNSET = 0;
NEGATIVE = -1;
UNKNOWN = 12 [deprecated = true];
```

:::info

Files using the proto3 syntax _must_ use a numeric value of zero for the first
enum value defined.

:::

Like fields, enum values are identified both by name and by number. The number is
used in the binary format, for a more compact on-the-wire representation. Unlike
fields, numeric values for enum values can be negative. The allowed range for enum
value numbers is -2,147,483,648 to 2,147,483,647, inclusive (-2<sup>31</sup> to
2<sup>31</sup>-1).

Within the context of a single enum type, enum values should have unique numeric
values. No two enum values defined inside the same enum can have the same number.
However, this constraint can be relaxed if the enum allows aliases, which is
indicated by an option named `allow_alias` that has a value of `true`.  Not only is
the constraint relaxed, but it actually becomes mandatory for the enum to have
multiple values sharing a number. So if an enum allows aliases but all of its values
use distinct numbers, it is an error.

An enum value's number must not be contained by any of the enum's reserved ranges.

Value names (the first `identifier` token) may not match either of these keywords:
  * "reserved"
  * "option"

#### JSON Name Conflicts {#enum-value-json-name-conflicts}

To avoid possible conflicting enum value names in the JSON format for a message, enum
value names are checked for possible conflicts. Though the JSON format for an enum is
the enum value's name, the conflict check is more strict and nuanced than simply
comparing names.

The JSON name conflict check is not case-sensitive. Instead of converting a name to
lower-case for a case-insensitive check, the name is first stripped of any prefix
that matches the name of the enclosing enum and then is converted to PascalCase.

Removing a possible prefix of the enclosing enum name ignores case and underscores.
For example, if the enum's name is `FooBar`, then prefixes like `FOOBAR`, `FOO_BAR`,
`FooBar`, `foobar`, and even `__f_o_o___b_a_r__` would be removed from the beginning
of an enum value name.

To convert to PascalCase:
* Discard any leading and trailing underscores (`_`)
* Capitalize the first non-underscore character in the name.
* When an interior underscore is encountered, discard the underscore and
  capitalize the next non-underscore character encountered.
* Any other non-underscore and non-capitalized character is converted to lower-case.

Converting to PascalCase this way achieves the desired case-insensitive check.
For example, names `FOO_BAR`, `foo_bar`, and `Foo_Bar` will all be converted to
`FooBar` and thus be identified as conflicts. But `FOOBAR` and `FOO_BAR` will be
different (`Foobar` and `FooBar` respectively), and thus not be a conflict.

If the `allow_alias` enum option is used, it is acceptable for aliases of the
same numeric value to have conflicting names.

If two enum values in an enum have a conflict (and are not aliases for the same
numeric value), and the source file uses the proto3 syntax, the enum definition
is invalid.

:::info

The JSON format was introduced at the same time as the proto3 syntax. For backwards
compatibility, it is not an error for proto2 files to have enum values whose names
conflict with one another per the check described above. A compiler may still choose
to issue a warning for this condition.

:::

### Reserved Names and Numbers {#enum-reserved-names-and-numbers}

Like messages, enums can also reserve names and numbers, typically to prevent
recycling names and numbers from old enum values.
```ebnf
EnumReservedDecl = reserved ( EnumValueRanges | Names ) semicolon .

EnumValueRanges     = EnumValueRange { comma EnumValueRange } .
EnumValueRange      = EnumValueRangeStart [ to EnumValueRangeEnd ] .
EnumValueRangeStart = EnumValueNumber .
EnumValueRangeEnd   = EnumValueNumber | max .
```

```txt title="Examples"
reserved 100;
reserved 10 to 10000;
reserved -2 to -5, 20000 to max;
reserved "FOO";
reserved "FOO", "BAR", "BAZ";
```

When the `max` keyword is used as the end of the range, it is interpreted as the maximum
allowed value, 2,147,483,647.

If the end of the range is absent (the value range is just a single number), it is
interpreted as an open range (i.e. inclusive) where the start and end values are the same.

Reserved ranges for the same enum are not allowed to overlap one another.

The contents of the string literal that defines a reserved name must represent a valid
identifier. In other words, they must match the production for the
[_identifier_](#identifiers-and-keywords) lexical element.

## Extensions

Fields declared directly inside a message are known as "normal fields". But it
is also possible to define "extension fields", also know simply as
"extensions". Extensions can only be declared for an _extendable message_,
which is one that declares at least one [extension range](#extension-ranges).

Extensions may be declared in both proto2 and proto3 syntax
levels, but an extendable message can only be defined in a file with
proto2 syntax.
```ebnf
ExtensionDecl = extend ExtendedMessage l_brace { ExtensionElement } r_brace .

ExtendedMessage  = TypeName .
ExtensionElement = FieldDecl |
                   GroupDecl .
```

```txt title="Example"
extend google.protobuf.MessageOptions {
  repeated foo.bar.Frobnitzes frobnitzes = 29384;
  string haiku = 29385;
  uint64 bitmask = 29386 [deprecated = true];
}
```

The extended message is also known as the "extendee".

An `extend` block must contain at least one field or group.

:::info
️
Files using the proto3 syntax are not allowed to include _GroupDecl_ elements.

Files using the proto3 syntax are only allowed to declare extensions that
are custom options. This means that the extendee must be one of the following:
* `google.protobuf.FileOptions`
* `google.protobuf.MessageOptions`
* `google.protobuf.FieldOptions`
* `google.protobuf.OneofOptions`
* `google.protobuf.ExtensionRangeOptions`
* `google.protobuf.EnumOptions`
* `google.protobuf.EnumValueOptions`
* `google.protobuf.ServiceOptions`
* `google.protobuf.MethodOptions`

:::

Though the _FieldDecl_ and _GroupDecl_ productions are re-used here,
extension fields may _never_ use the `required` cardinality.

The field number used by an extension _must_ be contained by one of the extendee's
extension ranges. A normal field, conversely, _may not_ use a number contained by an
extension range.

Extension fields always support detecting whether the field is present or not, unlike
the default behavior of normal fields with scalar types when using the proto3 syntax
level.

The field numbers assigned to extensions for a given extendable message are meant to be
globally unique. It is not allowed for two extensions to be declared that extend
the same message and have the same field number. (The extent to which this can be
verified by a parser is limited to the set of files of which the parser is aware.)


## Services

Services are used to define RPC interfaces. Each service is a collection
of RPC methods.
```ebnf
ServiceDecl = service ServiceName l_brace { ServiceElement } r_brace .

ServiceName    = identifier .
ServiceElement = OptionDecl |
                 MethodDecl |
                 EmptyDecl .
```

```txt title="Example"
service BlobService {
  rpc CreateBlob(CreateBlobRequest) returns (CreateBlobResponse);
  rpc FetchBlob(FetchBlobRequest) returns (FetchBlobResponse);
  rpc UpdateBlob(UpdateBlobRequest) returns (UpdateBlobResponse);
  rpc DeleteBlob(DeleteBlobRequest) returns (DeleteBlobResponse);
}
```

### Methods

Each method defines a single operation and must indicate the method's
input and output types, also known as request and response type respectively.
```ebnf
MethodDecl = rpc MethodName InputType returns OutputType semicolon |
             rpc MethodName InputType returns OutputType l_brace { MethodElement } r_brace .

MethodName    = identifier .
InputType     = MessageType .
OutputType    = MessageType .
MethodElement = OptionDecl |
                EmptyDecl .

MessageType = l_paren [ stream ] TypeName r_paren .
```

```txt title="Examples"
rpc QueryBlobs(QueryBlobsRequest) returns (stream blobsvc.model.Blob);
rpc BatchCreateBlobs(stream CreateBlobRequest) returns (BatchCreateBlobsResponse);
rpc PatchBlob(PatchBlobRequest) returns (.blobsvc.model.Blob) {
    option deprecated = true;
}
```

The `stream` keyword may appear in either the method's input or output type, or
even both. When present, it indicates that the type of the input or output is a
sequence of zero or more instances of the named message type. If not present,
the input or output is exactly one of the named message type.

A method that uses streams for neither input nor output is known as a "unary" method.
If it uses a stream only for the input type, it is known as a "client-streaming" method.
If it uses a stream only for the output type, it is known as a "server-streaming" method.
Finally, if it uses streams for both input and output, it is known as a "bidi-streaming"
method. Depending on the underlying transport, a bidi-streaming method may support
_full duplex_ bidi-streaming, where the client can send input messages and the server
can send output messages asynchronously and concurrently. (Standard HTTP 1.1, on the
other hand, only supports _half duplex_ bidi-streaming, where the client must send all
of its input messages before the server may begin sending its output messages.)
