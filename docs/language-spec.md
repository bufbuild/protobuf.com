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

Google's documentation can be found [here](https://protobuf.dev/) (with separate
grammars for [proto2](https://protobuf.dev/reference/protobuf/proto2-spec/) and
[proto3](https://protobuf.dev/reference/protobuf/proto3-spec/) syntax). But these
grammars are incomplete. In the face of these documentation shortcomings, the
actual implementation in the `protoc` compiler prevails as the de facto spec.
Without complete and accurate documentation, it is very hard for the community to
contribute quality tools around the language.

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
Term        = Reference | literal [ "…" literal ] |
              Exclusion | Group | Option | Repetition .
Reference   = production_name [ "-" Subtraction ] .
Subtraction = Atom | "(" Atom { "|" Atom } ")" .
Atom        = production_name | literal .
Exclusion   = "!" literal | "!" "(" literal { "|" literal } ")" .
Group       = "(" Expression ")" .
Option      = "[" Expression "]" .
Repetition  = "{" Expression "}" .
```

Productions are expressions constructed from terms and the following operators, in increasing precedence:

* **|**:  Alternation
* **-**:  Subtraction
* **!**:  Exclusion
* **()**: Grouping
* **[]**: Option (0 or 1 times)
* **\{\}**: Repetition (0 to n times)

Production names that are in [lower_snake_case](https://en.wiktionary.org/wiki/snake_case)
are used to identify lexical tokens. Production names for non-terminals are in
[PascalCase](https://en.wiktionary.org/wiki/Pascal_case).

### Literals

Literal source characters are enclosed in double quotes `""` or back quotes ``` `` ```. In
double-quotes, the contents can encode otherwise non-printable characters. The backslash
character (`\`) is used to mark these encoded sequences:

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

Literals may only be used in productions for lexical tokens. Productions for
non-terminals may only refer to other productions (for lexical tokens or for other
non-terminals) and may not use literals.

### Subtraction

Both operands in a subtraction expression can only represent single lexical tokens.
Where a production is named, the production must always accept exactly one token. This
kind of expression is used to narrow a production that accepts many alternatives so
that it accepts fewer alternatives. For example, the following `ShortWords` production
accepts all three-letter strings consisting of lower-case letters _other than_
`"abc"` and `"xyz"`.
```ebnf
ShortWords = three_letter_words - ( "abc" | "xyz" )

three_letter_words = letter letter letter
letter =             "a" … "z"
```

### Exclusion

The exclusion operator is only for use against literal characters and means that
all characters _except for_ the given ones are accepted. For example `!"a"` means
that any character except lower-case `a` is accepted; `!("a"|"b"|"c")` means that
any character except lower-case `a`, `b`, or `c` is accepted.

The form `a … b` represents the set of characters from a through b as alternatives.


## Source Code Representation

Source code is Unicode text encoded in UTF-8. In general, only comments and string literals
can contain code points outside the range of 7-bit ASCII.

For compatibility with other tools, a file with Protobuf source may contain a UTF-8-encoded
byte-order mark (U+FEFF, encoded as `"\xEF\xBB\xBF"`), but only if it is the first Unicode
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
 * 41 token types corresponding to keywords
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

There are 43 keywords in the protobuf grammar.
When an `identifier` is found, if it matches a keyword, its token type is changed
to match the keyword, per the rules below. All of the keyword token types below
are *also* considered identifiers by the grammar. For example, a production in the
grammar that references `identifier` will also accept `syntax` or `map`.
```ebnf
syntax  = "syntax" .      oneof      = "oneof" .        int32    = "int32" .
edition = "edition" .     map        = "map" .          int64    = "int64" .
import  = "import" .      extensions = "extensions" .   uint32   = "uint32" .
weak    = "weak" .        reserved   = "reserved" .     uint64   = "uint64" .
public  = "public" .      rpc        = "rpc" .          sint32   = "sint32" .
package = "package" .     stream     = "stream" .       sint64   = "sint64" .
option  = "option" .      returns    = "returns" .      fixed32  = "fixed32" .
inf     = "inf" .         to         = "to" .           fixed64  = "fixed64" .
nan     = "nan" .         max        = "max" .          sfixed32 = "sfixed32" .
message = "message" .     repeated   = "repeated" .     sfixed64 = "sfixed64" .
enum    = "enum" .        optional   = "optional" .     bool     = "bool" .
service = "service" .     required   = "required" .     float    = "float" .
extend  = "extend" .      string     = "string" .       double   = "double" .
group   = "group" .       bytes      = "bytes" .        export   = "export" .
local   = "local" .
```

:::info

The `export` and `local` keywords are only recognized as keywords in files using
edition 2024 or later. In older files, they are treated as regular identifiers.

:::

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
it is replaced with the nearest value that _can_ be represented by this format using
[IEEE 754 round-to-nearest, ties-to-even](https://en.wikipedia.org/wiki/IEEE_754#Roundings_to_nearest)
rules. When the value is too small to be represented, that nearest value will be zero. When
the value is too large to be represented, that nearest value will be infinity. A floating
point literal will always result in a value and never result in a _NaN_ (only the use of
the `nan` identifier can produce such a value; see [_Option Values_](#option-values) for
more).

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
'Long unicode escape can represent emojis \U0001F389 but isn\'t necessary 🎉'
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
semicolon = ";" .        equals  = "=" .        r_brace   = "}" .
comma     = "," .        minus   = "-" .        l_bracket = "[" .
dot       = "." .        l_paren = "(" .        r_bracket = "]" .
slash     = "/" .        r_paren = ")" .        l_angle   = "<" .
colon     = ":" .        l_brace = "{" .        r_angle   = ">" .
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

The grammar presented here is a _unified_ grammar: it is capable of parsing files that
use the proto2, proto3, or Editions syntax. This means you do not need multiple passes,
such as a pre-parse to determine the syntax level of the file and then a full-parse
using a syntax-specific grammar. The differences between the three do not require a
separate grammar and can be implemented as a post-process step to validate the resulting
parsed syntax tree. The relevant differences between the various syntaxes are called out
in the sections below.


## Source File Organization

A valid source file contains zero or more declarations and may begin with an optional
UTF byte-order mark.
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
As described [above](#whitespace-and-comments), whitespace and comments are ignored.
So whitespace and/or comments preceding any declaration are allowed and will be
discarded. However whitespace and comments are _not allowed_ before the byte-order
mark. If present, the byte-order mark **must** be the first three bytes in the file.

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
declaration in the file. When the "syntax" keyword is used, the string
literal indicates the syntax level and must have a value of "proto2" or
"proto3". If the "edition" keyword is used, the file uses Editions syntax,
and the string literal indicates a particular edition. By convention,
editions are named after the year in which their development began. The
first edition is "2023".

Other values for the string literal are not allowed (though the set of
allowed values may be expanded in the future). If a file contains no syntax
or edition declaration then the proto2 syntax is assumed.
```ebnf
SyntaxDecl = syntax equals SyntaxLevel semicolon |
             edition equals Edition semicolon .

SyntaxLevel = StringLiteral .
Edition     = StringLiteral .
```

```txt title="Examples"
syntax = "proto2":
syntax = "proto3";
edition = "2023";
edition = "2024";
```

String literals support C-style concatenation. So the sequence
`"prot" "o2"` is equivalent to `"proto2"`.
```ebnf
StringLiteral = string_literal { string_literal } .
```

#### Allowed Editions

The actual string values allowed in the `edition` statement are
defined by the `google.protobuf.Edition` enum, which is defined in
[`google/protobuf/descriptor.proto`](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L68-L101).

The first edition is represented by the `EDITION_2023` value. All
earlier values (those with lower numeric values) should be ignored
for the purpose of considering what string values are allowed.
Similarly, the sentinel `EDITION_MAX` value and all values whose
names end in `_TEST_ONLY` should also be ignored.

Of the values that remain (not ignored per the above), the portion
of the value name _after_ the `EDITION_` prefix is what is allowed.
For example, with the value `EDITION_2023`, `2023` is what can be
used, i.e. `edition = "2023";`.

Note, however, that just because an edition is declared in the
enum does not necessarily mean that the edition is actually
_supported_ or even completely defined. For example, a future
value like `EDITION_2025` may be present in the enum before
it is fully implemented, because the value must be added to
the enum *before* any implementation work can actually begin.
Once the edition is adequately implemented for users to try it
out, it can be made available for users of `protoc` via an
`--experimental_editions` flag. (Users were able to experiment
with editions 2023 and 2024 in this way in earlier releases of
Protobuf before they became generally available.)

Edition 2023 became generally available in Protobuf v27.0.
Edition 2024 became generally available in Protobuf v32.0.

So the compiler must limit the set of allowed values to only
valid entries in the enum and only to editions that the compiler
actually supports and implements.

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

### Symbol Visibility

Message and enum definitions can be annotated to override their
default symbol visibility. This is controlled by the
[`default_symbol_visibility`](#default-symbol-visibility) feature.

```ebnf
SymbolVisibility = export | local .
```

:::info

The `export` and `local` keywords are only allowed in files using
edition 2024 or later. `export` makes the symbol visible to files that
import this file. `local` restricts the symbol to use within the file
where it is defined. Values of `default_symbol_visibility` feature
further restrict which symbols are visible.

:::

### Imports

In order for one file to re-use message and enum types defined in
another file, the one file must import the other.
```ebnf
ImportDecl = import [ weak | public | option ] ImportedFileName semicolon .

ImportedFileName = StringLiteral .
```

```txt title="Examples"
import "google/protobuf/descriptor.proto";
import public "other/file.proto";
import weak "deprecated.proto";
import option "custom_option.proto";
```

The string literal must be a relative path (e.g. it may not start with
a slash `/`). Paths always use forward slash as the path separator,
even when compiled on operating systems that use back-slashes (`\`),
such as Windows.

The paths that are imported must be unique: referring to the same
path from multiple import statements is not allowed.

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
supported by few target runtimes. Both `import weak` and the `weak` field
option are banned in files using edition 2024 or later.

:::

An "option" import makes only custom options from the imported file
available for use; messages, enums, and other types defined in the
imported file are not visible for use as field types or in other
declarations. All `import option` declarations must appear after all
other import declarations in the file. Option imports are only
available in files using edition 2024 or later.

The set of files that a file imports are also known as the file's
direct dependencies.

The graph that is formed of files as vertices and imports as edges is
a directed acyclic graph (aka, DAG). Therefore imports are not allowed to
introduce cycles; a file's set of transitive dependencies must not include
itself. For example, if "a.proto" imports "b.proto", then "b.proto" must
not import "a.proto". Furthermore, "b.proto" cannot even _indirectly_
reference "a.proto" via transitive dependencies. So if "b.proto" imports
"c.proto", it also must import neither "a.proto" nor "b.proto", and so on.

#### Visibility

When one element in a file refers to another element (defined in the same file
or possibly in another file), the referenced element must be _visible_ to that
file. Imports are how elements in one file are made visible to another.

The elements that are visible to a given file include the following:
1. Everything defined inside that given file
2. Everything defined inside the files that the given file imports
3. Everything defined inside files that are _publicly_ imported by the files that the
   given file imports. [Public imports](#imports) are transitive, so if `a.proto` imports
   `b.proto` which _publicly_ imports `c.proto` which in turn _publicly_ imports `d.proto`,
   then everything in `c.proto` and `d.proto` is visible to `a.proto`.
4. For files imported via `import option`, only custom options defined in the imported
   file are visible. Other types (messages, enums, etc.) from an option import are not
   available for use as field types or in other declarations.

#### Well-Known Imports

The "well-known" imports are a set of files that define the well-known types. The
term "well-known" means they are available to all Protobuf sources. Instead of requiring
a user to supply these files, the compiler should be able to provide their contents. All
of the well-known types are in files whose path begins with "google/protobuf". Furthermore,
the package for each file starts with `google.protobuf`, with the exception of the three files
that define custom features, which use the short package `pb`.

As of v1.65.0 of `buf` and v31.1 of `protoc`, the well-known imports include the following
files:
* `google/protobuf/any.proto`
* `google/protobuf/api.proto`
* `google/protobuf/compiler/plugin.proto`
* `google/protobuf/cpp_features.proto`
* `google/protobuf/descriptor.proto`
* `google/protobuf/duration.proto`
* `google/protobuf/empty.proto`
* `google/protobuf/field_mask.proto`
* `google/protobuf/go_features.proto`
* `google/protobuf/java_features.proto`
* `google/protobuf/source_context.proto`
* `google/protobuf/struct.proto`
* `google/protobuf/type.proto`
* `google/protobuf/wrappers.proto`

The authoritative source for all of these files is the official Protobuf repo
at https://github.com/protocolbuffers/protobuf.


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
    enums in C++ behave the same way with regards to their enclosing namespace.
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

### Constrained Type References

There are several places in the grammar where a type reference is constrained to
enable a predictive parser implementation while preventing ambiguity. In these
cases, the first token of the type reference is more limited than above: instead
of matching any identifier (including any keywords), some keywords are excluded.
```ebnf
FieldDeclTypeName          = FieldDeclIdentifier [ dot QualifiedIdentifier ] |
                             FullyQualifiedIdentifier .
MessageFieldDeclTypeName   = MessageFieldDeclIdentifier [ dot QualifiedIdentifier ] |
                             FullyQualifiedIdentifier .
ExtensionFieldDeclTypeName = ExtensionFieldDeclIdentifier [ dot QualifiedIdentifier ] |
                             FullyQualifiedIdentifier .
OneofFieldDeclTypeName     = OneofFieldDeclIdentifier [ dot QualifiedIdentifier ] |
                             FullyQualifiedIdentifier .
MethodDeclTypeName         = MethodDeclIdentifier [ dot QualifiedIdentifier ] |
                             FullyQualifiedIdentifier .

FieldDeclIdentifier          = identifier - group .
MessageFieldDeclIdentifier   = FieldDeclIdentifier - (
                                 message | enum   | oneof    | reserved | extensions |
                                 extend  | option | optional | required | repeated
                               ) .
ExtensionFieldDeclIdentifier = FieldDeclIdentifier - (
                                 optional | required | repeated
                               ) .
OneofFieldDeclIdentifier     = FieldDeclIdentifier - (
                                 option | optional | required | repeated
                               ) .
MethodDeclIdentifier         = identifier - stream .

FullyQualifiedIdentifier = dot QualifiedIdentifier .
```

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
ExtensionName = l_paren TypeName r_paren .
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
| file \*         | [google.protobuf.FileOptions](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L452)           |
| message †       | [google.protobuf.MessageOptions](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L581)        |
| field ‡         | [google.protobuf.FieldOptions](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L666)          |
| oneof           | [google.protobuf.OneofOptions](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L835)          |
| extension range | [google.protobuf.ExtensionRangeOptions](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L188) |
| enum            | [google.protobuf.EnumOptions](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L849)           |
| enum value      | [google.protobuf.EnumValueOptions](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L884)      |
| service         | [google.protobuf.ServiceOptions](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L912)        |
| method          | [google.protobuf.MethodOptions](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L938)         |

__*__ An option that is a top-level declaration, not in the context of
any other element, is in the file context.

__†__ In the context of a [group](#groups), option declarations inside the
group's body are considered to be message options.

__‡__ In the context of a [group](#groups), compact option declarations
that precede the group's body are considered to be field options.

All of the above types are defined in the well-known import named
`"google/protobuf/descriptor.proto"`.

All of the above concrete options have a field named `uninterpreted_option`
which is for internal use only. (Option declarations may not refer to this
field.)

:::note

All of the concrete options have a field named `features`. This field's type
is a message: [`google.protobuf.FeatureSet`](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L1012).

Syntactically, values for this field are specified just like any other option
field. However, files that use proto2 or proto3 syntax may _not_ use this option.
It can **only** be used in sources that use Editions syntax.

:::

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

ScalarValue         = StringLiteral | IntLiteral | FloatLiteral |
                      SpecialFloatLiteral | identifier .
IntLiteral          = [ minus ] int_literal .
FloatLiteral        = [ minus ] float_literal .
SpecialFloatLiteral = minus inf | minus nan .

MessageLiteralWithBraces = l_brace MessageTextFormat r_brace .
```

```txt title="Examples"
-inf
true
nan
-123
456.789e+101
1.0203
"foo bar"
'foo-bar-baz'
{ name:"Bob Loblaw" id:123 profession:"attorney" loc<lat:-41.293, long: 174.781675> }
```

Identifiers are used as option values in the following cases:
* If the option's type is an enum type, use identifiers for the unqualified enum value names.
* If the option's type is boolean, use `true` and `false` identifiers as values.
* If the option's type is a floating point number, one may use `inf` and `nan` identifiers as values.
  The actual bitwise-representation of `nan` values is not specified, but it should be a
  [quiet (aka non-signaling) _NaN_](https://en.wikipedia.org/wiki/IEEE_754#NaNs).

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
SpecialFieldName        = ExtensionFieldName | TypeURL .
ExtensionFieldName      = QualifiedIdentifier .
TypeURL                 = QualifiedIdentifier slash QualifiedIdentifier .

Value                  = TextFormatScalarValue | MessageLiteral | ListLiteral .
TextFormatScalarValue  = StringLiteral | IntLiteral | FloatLiteral |
                         SignedIdentifier | identifier .
SignedIdentifier       = minus identifier .
MessageValue           = MessageLiteral | ListOfMessagesLiteral .
MessageLiteral         = MessageLiteralWithBraces |
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
-Infinity
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

| Field Type                                                   | Allowed Value Types                                                |
|--------------------------------------------------------------|--------------------------------------------------------------------|
| `int32`, `int64`, `sint32`, `sint64`, `sfixed32`, `sfixed64` | _IntLiteral_ \*                                                    |
| `uint32`, `uint64`, `fixed32`, `fixed64`                     | _IntLiteral_ †                                                     |
| `float`, `double`                                            | _FloatLiteral_, _IntLiteral_, _SignedIdentifier_ ‡, _identifier_ ‡ |
| `bool`                                                       | _identifier_ §                                                     |
| `string`, `bytes`                                            | _StringLiteral_                                                    |
| An enum type                                                 | _identifier_, _IntLiteral_ ¶                                       |
| A message type                                               | _MessageLiteral_                                                   |

__*__ Integer field types can only use _IntLiteral_ values if the represented
number is in the range [-2<sup>31</sup>,2<sup>31</sup>) for 32-bit types or
or [-2<sup>63</sup>,2<sup>63</sup>) for 64-bit types.

__†__ Unsigned integer field types can only use _IntLiteral_ values if the
represented number is in the range [0,2<sup>32</sup>) for 32-bit types
or [0,2<sup>64</sup>) for 64-bit types.

__‡__ Floating point field types can only use _identifier_ values if the identifier
is `inf`, `infinity`, or `nan`. But this is a case-insensitive check (so `INF`
and `NaN` could also be used). Similarly, the _identifier_ component of a
_SignedIdentifier_ value must be `inf`, `infinity`, or `nan` (case-insensitive).
Note that all of these may be used inside the text format, in a message literal.
But for non-message options (e.g. option values _outside_ the text format), only
`inf` and `nan` (lower-case) can be used.

__§__ Boolean field types can only use identifiers `true`, `false`, `True`, `False`,
`t`, and `f` as values. Note that all of these may be used inside the text format, in a
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
support the full range of allowed characters in a domain component or URL path component.
:::

### Meta-Options

A "meta-option" is a field option that controls the behavior of other options.
Let's explore what that means:

* Options are themselves fields, of concrete options message. (See
  [_Resolving Option Names_](#resolving-option-names).)
* Since they are fields, that means they too can be annotated with field options.
* Such an option, one that is intended to be used on other options, is a meta-option.

Below are the meta-options:
1. [`retention`](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L771):
   This option controls whether runtimes should retain the value of this option and
   make it available at runtime, for reflection use cases. This meta-option can be
   ignored when parsing and validating Protobuf sources. It is only used during code
   generation, to decide what options to make available to a Protobuf runtime.

   ```protobuf title="Example"
   extend google.protobuf.FileOptions {
       repeated MyCustomData my_custom_data = 50001 [
           // highlight-start
           // The my_custom_data option is only available when
           // processing source. It is unavailable at runtime.
           retention = RETENTION_SOURCE
           // highlight-end
       ];
   }
   ```

2. [`targets`](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L789):
   This option controls the target types -- the types of elements to which this field
   applies. This is described in more detail [below](#target-types).

3. [`edition_defaults`](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L795):
   This option is required for feature fields and is used to to resolve feature values.
   This is described in more detail [below](#feature-defaults).

4. [`feature_support`](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L804-L822):
   This option is also required for feature fields and defines the range of editions in
   which a feature field may be used. This is described in more detail [below](#feature-lifetimes).

#### Target Types

The `targets` meta-option limits the kinds of elements where an option can be
used. When the options are resolved, this meta-option should be consulted for
all fields set. This includes all elements in an option name. It also includes
all field names referenced inside of a message literal. If any of the referenced
fields has a non-empty value for the `targets` meta-option, and none of the
values match the context in which the reference is found, it is an invalid use
of that field.

The table below lists all of the target types and the context in which they may be
used:

| Context         | Target Type                   |
|-----------------|-------------------------------|
| file            | `TARGET_TYPE_FILE`            |
| message         | `TARGET_TYPE_MESSAGE`         |
| field           | `TARGET_TYPE_FIELD`           |
| oneof           | `TARGET_TYPE_ONEOF`           |
| extension range | `TARGET_TYPE_EXTENSION_RANGE` |
| enum            | `TARGET_TYPE_ENUM`            |
| enum value      | `TARGET_TYPE_ENUM_ENTRY`      |
| service         | `TARGET_TYPE_SERVICE`         |
| method          | `TARGET_TYPE_METHOD`          |

In the following file, for example, the highlighted option use is invalid: the
field referenced can only be used in file and field contexts but is incorrectly
used in an enum context.

```protobuf title="Example"
syntax = "proto3";

package foo.bar;

import "google/protobuf/descriptor.proto";

enum Abc {
  // highlight-start
  option (enum_extra).foo = true;
  // highlight-end

  ABC = 0;
}

extend google.protobuf.FileOptions {
  Extra file_extra = 33333;
}
extend google.protobuf.MessageOptions {
  Extra message_extra = 33333;
}
extend google.protobuf.FieldOptions {
  Extra field_extra = 33333;
}
extend google.protobuf.EnumOptions {
  Extra enum_extra = 33333;
}

message Extra {
  string name = 1;
  uint64 id = 2;

  // This field can only be used on files and fields.
  bool foo = 3 [
    targets = TARGET_TYPE_FILE,
    targets = TARGET_TYPE_FIELD
  ];
}
```

### Features

All of the various concrete option messages have a field named `features`. **Values
for this field, or fields inside of it, may only be set by `option` declarations
in files that use the Editions syntax** (by declaring an `edition` at the top of the
file instead of a `syntax`).

The type of this field in all cases is [`google.protobuf.FeatureSet`](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L1012).
The term "feature" or "feature field" refers to a field of this message. All such
fields must have a boolean or enum type. They may not be repeated. This message
defines extension ranges. The type of all extension fields should be a message. The
fields of those message are called "custom features" or "custom feature fields".
Similarly, these fields may not be repeated and must have a type of bool or enum.

Each feature field uses the `targets` meta-option to indicate to which kind of element
it applies. Typically, there will be at least two such types allowed: the actual element
type to which the value applies as well as `TARGET_TYPE_FILE`, which allows setting a
file-wide default value (that is inherited by all elements in the file unless overridden).

Features control the semantics of the language. They allow elements in a file that
uses Editions syntax to use the semantics of either proto2 or proto3 syntaxes. They
also allow fine-grained control, allowing a single file to mix these semantics in ways
that were not possible when using proto2 or proto3 syntax. For example, an enum in a
file that uses proto2 syntax is always closed; an enum in a file that uses proto3 syntax
is always open. But enums in a file that uses Editions syntax can be either, and both
open and closed enums can be defined in the same file when using Editions syntax.

Features are how the first edition, "2023", unified the proto2 and proto3 syntaxes.
A file that uses proto3 syntax can be migrated to Editions syntax and preserve all of its
semantics. A file that uses proto2 syntax can also be migrated to Editions syntax and
preserve all of its semantics. And features allow these semantics to change incrementally,
in a fine-grained way -- even as granular as changing a single field at a time.

#### Feature Resolution

In a source file, features are defined **sparsely**. So the author of a Protobuf
source file is not expected to put features on every element. Instead, they are
expected to use file-wide defaults for cases where they want different semantics
than the defaults for the file's edition, and to use per-element features only
when they wish that element to have different semantics than the file's defaults.

The default values for a feature can change from one edition to the next. So in
order to compute the value of a feature for a particular element, we have to
examine that element's features, the features of its ancestors (from which it
can "inherit" override values, such as a file-wide default), and also the default
value of the feature for the file's edition.

An "element" in this context is anything that can have options, since features are
represented as options. The table in the [_Target Types_](#target-types) section
above enumerates the nine types of elements. The root of the hierarchy is the file
itself (so feature resolution never needs to examine feature values outside of a
single file). The parent of a top-level element (message, enum, extension, or service)
is the file. The parent of a field, oneof, or extension range is its enclosing message.
When types are nested inside a message (enums, extensions, and other messages), the
enclosing message is their parent.  The parent of an enum value is the enclosing enum.
The parent of an RPC method is the enclosing service.

We can generalize the above and state the ancestry of an element is defined by the
lexical blocks (`{ ... }`) in which it is defined. The one exception to this is that,
though fields in a oneof are lexically defined inside the oneof body, the enclosing
_message_ is the parent of those fields, not the oneof.

The following example demonstrates the hierarchy, stating the parent of each element:
```protobuf title="example.proto"
edition = "2023";                             // Parent
                                              //----------------------
package foo.bar;                              //
                                              //
import "google/protobuf/descriptor.proto";    //
                                              //
message Message {                             // file "example.proto"
    oneof id {                                // message foo.bar.Message
      string name = 1;                        // message foo.bar.Message
      uint64 num = 2;                         // message foo.bar.Message
    }                                         //
    message NestedMessage {                   // message foo.bar.Message
      extend google.protobuf.MessageOptions { //
        string fizz = 49999;                  // message foo.bar.Message.NestedMessage
      }                                       //
      option (NestedMessage.fizz) = "buzz";   //
      enum Kind {                             // message foo.bar.Message.NestedMessage
        NULL = 0;                             // enum foo.bar.Message.NestedMessage.Kind
        PRIMARY = 1;                          // enum foo.bar.Message.NestedMessage.Kind
        SECONDARY = 2;                        // enum foo.bar.Message.NestedMessage.Kind
      }                                       //
      Kind kind = 1;                          // message foo.bar.Message.NestedMessage
    }                                         //
    NestedMessage extra = 3;                  // message foo.bar.Message
    extensions 1 to 100;                      // message foo.bar.Message
}                                             //
                                              //
enum Unit {                                   // file "example.proto"
  VOID = 0;                                   // enum foo.bar.Unit
}                                             //
                                              //
service FooService {                          // file "example.proto"
  rpc Bar(Message) returns (Message);         // service foo.bar.FooService
}                                             //
```
The file itself has no parent element: it is the root of the hierarchy.

The algorithm to resolve a feature for a particular element looks like so:
1. Examine the element's options.
   * If available, examine the option message's `features` field.
     * If present, query for the particular feature field in question.
       * If present, its value is the resolved feature value. **Done.**
2. If the element is a file (so there is no parent), the resolved
   feature value is the default value for the file's edition. **Done.**
3. Get the element's parent.
4. Go back to step 1, repeating the algorithm, but substituting parent
   for element.

Computing the default value of a feature for a particular edition is discussed
in the [next section](#feature-defaults).

An alternative to the above algorithm is to pre-compute the resolved values for all
features, for all elements. This utilizes a logical ["merge" operation](#merging-protobuf-messages)
to combine two Protobuf messages. It also traverses the hierarchy in the opposite
direction, top-down instead of bottom-up. The algorithm for this approach looks
like so:
1. Compute a `FeatureSet` message where all fields (including all custom feature
   fields, which are the fields of known extensions) have the default value for
   the file's edition. Call this message "current".
2. Query for the `features` field of the file's options.
   * If present, merge the value from the file's options into "current".
3. Store "current" as the resolved feature set for the file.
4. For each child element (top-level messages, enums, extensions, and services):
   1. Query for the `features` field of this element's options.
      * If present, clone the "current" `FeatureSet`, and merge the value from the
        element's options into the clone. Assign the result as "current".
   2. Store "current" as the resolved feature set for the element.
   3. Repeat the above steps recursively, for each child of the element.
      * If the element is a message, its children are its fields, oneofs, extension
        ranges, nested messages, nested enums, and nested extensions.
      * If the element is an enum, its children are its enum values.
      * If the element is a service, its children are its RPC methods.
      * If the element is a field (or extension), oneof, extension range, enum
        value, or RPC method, it has no children.

##### Merging Protobuf Messages

Merging two Protobuf messages, "a" and "b", mutates "a". By convention, this is
called "merging b into a". The algorithm works like so:
* For each field that is present in "b":
  * If that field is not present in "a":
    * Update "a", setting the field to the value in "b".
  * Else if the field is a map field:
    * For each key in the map value in "b":
      * Set the value in the map value in "a" using the key and the value from "b".
        If the key is already present in "a", the value is replaced with the value
        in "b".
  * Else if the field is repeated:
    * For each element in the values in "b", append to the values in "a". If "a" is
      initially empty, then its values will exactly match the values in "b".
  * Else if the field's type is a message:
    * Recursively merge the message value in "b" into the message value in "a".
  * Else:
    * Replace the value in "a" with the value in "b".

The process is designed to produce the same result as the following (less
efficient) process:
* Serialize "a" to bytes.
* Serialize "b" to bytes.
* Concatenate the bytes from "b" to the end of the bytes from "a".
* Clear "a" and de-serialize the combined bytes into it.

##### Feature Resolution Example

Let's consider the following example:
```protobuf
edition = "2023";

option features.field_presence = IMPLICIT;

message ExampleMessage {
  string not_utf8 = 1 [features.utf8_validation = NONE];
  repeated bool flags = 2 [features.repeated_field_encoding = EXPANDED];
  ExampleMessage child = 3 [features.message_encoding = DELIMITED];
}

enum ExampleEnum {
  option features.enum_type = CLOSED;
  VALUE = 1;
}
```
The default features for edition 2023 look like so:
```protobuf
{
  field_presence: EXPLICIT
  enum_type: OPEN
  repeated_field_encoding: PACKED
  utf8_validation: VERIFY
  message_encoding: LENGTH_PREFIXED
  json_format: ALLOW
}
```

The resolved features for the example file above look like so, due to its
one option that overrides the `field_presence` feature:
```protobuf
{
  // highlight-start
  field_presence: IMPLICIT
  // highlight-end
  enum_type: OPEN
  repeated_field_encoding: PACKED
  utf8_validation: VERIFY
  message_encoding: LENGTH_PREFIXED
  json_format: ALLOW
}
```

The resolved features for the `ExampleMessage` are the same as for the file
above because it does not override any features via option declarations.

Its fields inherit its features and then override some of them:
```protobuf title="non_utf8"
{
  field_presence: IMPLICIT
  enum_type: OPEN
  repeated_field_encoding: PACKED
  // highlight-start
  utf8_validation: NONE
  // highlight-end
  message_encoding: LENGTH_PREFIXED
  json_format: ALLOW
}
```

```protobuf title="flags"
{
  field_presence: IMPLICIT
  enum_type: OPEN
  // highlight-start
  repeated_field_encoding: EXPANDED
  // highlight-end
  utf8_validation: VERIFY
  message_encoding: LENGTH_PREFIXED
  json_format: ALLOW
}
```

```protobuf title="child"
{
  field_presence: IMPLICIT
  enum_type: OPEN
  repeated_field_encoding: PACKED
  utf8_validation: VERIFY
  // highlight-start
  message_encoding: DELIMITED
  // highlight-end
  json_format: ALLOW
}
```

The resolved features for `ExampleEnum` vary from the file's features just by
the one value:
```protobuf
{
  field_presence: IMPLICIT
  // highlight-start
  enum_type: CLOSED
  // highlight-end
  repeated_field_encoding: PACKED
  utf8_validation: VERIFY
  message_encoding: LENGTH_PREFIXED
  json_format: ALLOW
}
```

The final element, the enum value `VALUE`, has the same resolved features as
`ExampleEnum` since it does not override any features.

#### Feature Defaults

The `edition_defaults` meta-option is how default values for features are configured.
This option allows for defining the values for a particular edition.

The actual value is a string and it must be in the format that the value would have
in the [text format](#protobuf-text-format). Since feature fields should have an enum
or bool type, this means the strings are simple identifiers for `true`, `false`,
or valid enum value names.

Each value is associated with a particular edition, but there are also a few entries
in the `Edition` enum that have special meaning here:

| Edition          | Purpose                                                                                                                                                                                       |
|------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `EDITION_LEGACY` | Indicates the behavior prior to when the feature was introduced.                                                                                                                              |
| `EDITION_PROTO2` | Indicates the behavior for elements in a file that uses proto2 syntax. This is effectively the same as `EDITION_LEGACY`.                                                                      |
| `EDITION_PROTO3` | Indicates the behavior for elements in a file that uses proto3 syntax.                                                                                                                        |
| `EDITION_MAX`    | Should not be used for default values. Used by plugins as a "max edition", to indicate they support all editions (only for plugins whose output does not depend on any features or editions). |

Default values are defined sparsely. If a value is not present for a particular edition,
that edition uses the default of the highest edition that _is_ present. The "highest" edition
is the one with the highest numeric value that is less than the particular edition that is
absent.

Let's consider the following example:
```protobuf
edition_defaults = { edition: EDITION_LEGACY, value: "A" },
edition_defaults = { edition: EDITION_PROTO3, value: "B" },
edition_defaults = { edition: EDITION_2024, value: "C" }
```

We can use the rule in the previous paragraph to derive the values for the missing editions.
That gives us the following defaults for all editions (including values for files that use
proto2 or proto3 syntax):

| Edition          | Value |
|------------------|-------|
| `EDITION_PROTO2` | `A`   |
| `EDITION_PROTO3` | `B`   |
| `EDITION_2023`   | `B`   |
| `EDITION_2024`   | `C`   |

So the reason the table above states that `EDITION_PROTO2` is effectively the same as
`EDITION_LEGACY` is because of the way defaults are represented sparsely and the fact
that `EDITION_PROTO2` is the first concrete value in the enum. By convention, the first
default should be `EDITION_LEGACY`, which means there should be no need to specify a
default for `EDITION_PROTO2`.

If a future `EDITION_2025` were added and no new default value added for it, that
edition would use the value `C`, which comes from the highest default prior to 2025,
that of `EDITION_2024`.

#### Feature Lifetimes

The `feature_support` meta-option limits in which editions a feature field can be
used. For backwards-compatibility, fields can't just be added to or removed from
`FeatureSet` in later editions.

Because of the nature of how option names are resolved, and the fact that features
are defined as options, if a new field gets added in a future edition, then the
compiler would start accepting use of that feature even in files that indicate an
older edition. But that wouldn't be valid because the code generators and runtimes
for that older edition wouldn't actually know about that newer feature.

Similarly, once a feature is no longer needed it can't just be removed, because
then it's no longer in the definition for `FeatureSet`, so the compiler would no
longer be able to resolve that feature field's name and could no longer accept the
use of that field in older editions, even if older editions are still supported by
the compiler.

So instead of adding and removing the field, the author must instead define the
editions in which the field can be used using the `feature_support` option.

In addition to logically adding and removing feature fields, the `feature_support`
option can also be used to deprecate a feature field. In an edition in which the
field is deprecated, the compiler may emit a warning about the deprecation if
that field were actually used.

Let's take a look at an example, which comes from the `(pb.cpp).legacy_closed_enum`
custom C++ feature that is defined in the well-known file `google/protobuf/cpp_features.proto`:
```protobuf
feature_support = {
  edition_introduced: EDITION_2023
  edition_deprecated: EDITION_2023
  deprecation_warning: "The legacy closed enum treatment in C++ is "
                       "deprecated and is scheduled to be removed in "
                       "edition 2025.  Mark enum type on the enum "
                       "definitions themselves rather than on fields."
}
```
In this example, the first edition in which the feature can be used is 2023.
Interestingly, it is deprecated in that very first edition. A compiler should
include the specified warning message when a deprecated field is used. Based
on that warning, we will expect to see `edition_removed: EDITION_2025` added
to this option once such a value is added to the `Edition` enum.

If a feature field is referenced in an earlier edition than its configured
`edition_introduced` value, the compiler must emit an error. Similarly, if a
feature field is referenced in an edition that is equal to or later than its
configured `edition_removed` value, the compiler must emit an error. All
features should include an `edition_introduced` value. But as seen in the
example above, an `edition_removed` may not be present (an `edition_deprecated`
might also not  be present), in which case `EDITION_MAX` is used (which
basically means the feature can be used in any edition that is later than
or equal to the one in which it was introduced).

An "earlier" edition is one with a lower numeric value. A "later" edition is
one with a higher numeric value.

Enum values also have an option named [`feature_support`](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L903),
and [its type](https://github.com/protocolbuffers/protobuf/blob/v32.0/src/google/protobuf/descriptor.proto#L804-L821)
is the same as that of the eponymous meta-option. Its usage is the same as
above, but it defines the lifetime of feature _values_, for features that
have enum types. Similar to how the `feature_support` meta-option allows for
logically adding, removing, and deprecating feature fields in future editions,
this enum value option allows logically adding, removing, and deprecating values
in future editions.

### Option Validation

There are several rules that a compiler is expected to enforce regarding where an
option may be used and what its allowed values are. Examples of such validation
include verifying that an option is only used on certain target types and verifying
that the `features` field is only used in files that use Editions syntax.

Caveats and rules for option usage, such as when an option can or cannot be used
and restrictions on its allowed values, can be found throughout this document.

The following are additional rules for _file_ options.

* The `java_string_check_utf8` option may not be used in files that use the
  Editions syntax. Instead, there is a custom feature named
  [`(pb.java).utf8_validation`](#java-utf8-validation), defined in the well-known
  file `"google/protobuf/java_features.proto"`, that can be used to control this
  behavior.
* When the `optimize_for` file option is absent or set to a value _other than_
  `LITE_RUNTIME`, the file **may not** import any file whose `optimize_for` option
  is set to `LITE_RUNTIME`. Put another way, non-lite files may not import lite files.
* If the file options indicate a value for the `field_presence` feature, it must not
  be set to `LEGACY_REQUIRED`. This is not allowed as a default value for the file.
* The `java_multiple_files` file option may not be used in files that use edition
  2024 or later. Use the [`(pb.java).nest_in_file_class`](#java-nest-in-file-class)
  feature instead.

Additional rules for options on other kinds of elements are described in later
sections.


## Messages

The core of the Protobuf IDL is defining messages, which are heterogeneous
composite data types.
```ebnf
MessageDecl = [ SymbolVisibility ] message MessageName l_brace { MessageElement } r_brace .

MessageName    = identifier .
MessageElement = MessageFieldDecl |
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

```txt title="Examples"
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

// Edition 2024: explicit visibility
export message PublicApi {
  string id = 1;
}

local message InternalHelper {
  int32 code = 1;
}
```

:::info

Files using proto3 or Editions syntax are not allowed to include _GroupDecl_ elements.

Files using proto3 syntax are not allowed to include _ExtensionRangeDecl_ elements.

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
the field's "label"), its type, its name, and its tag number. The cardinality may be
omitted.
```ebnf
MessageFieldDecl = FieldDeclWithCardinality |
                   MessageFieldDeclTypeName FieldName equals FieldNumber
                       [ CompactOptions ] semicolon .

FieldDeclWithCardinality = FieldCardinality FieldDeclTypeName FieldName
                           equals FieldNumber [ CompactOptions ] semicolon .

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
(despite it being optional in the grammar above).

In a file using the proto3 syntax, fields are not allowed to use the `required`
cardinality, are not allowed to include an option named `default`, and are not
allowed to refer to closed enum types. A closed enum type is one that is defined
in a file that uses proto2 syntax or one defined in a file that uses Editions
syntax and whose [`enum_type` feature](#enum-type) has a value of `CLOSED`.

In a file using Editions syntax, fields are allowed to use neither the
`required` _nor_ `optional` keywords. If the field's [`field_presence` feature](#field-presence)
has a value of `IMPLICIT`, it may not include an option named `default` and is
not allowed to refer to a closed enum type.

:::

Fields in a message are identified both by name and by number. The number, also
called the "tag", is used in the binary format, for a more compact on-the-wire
representation. This also means a field can be renamed without impacting on-the-wire
compatibility.

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
typically optimized for smaller field numbers. Also, smaller values are more efficiently
encoded and decoded: field numbers 1 to 15 can be encoded in a single byte. So it is
recommended to always start numbering fields at 1 and to use smaller values for more
commonly used fields when possible.

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

| Scalar type names                    | Encoding                                                                                                             |
|--------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| `int32`, `int64`, `uint32`, `uint64` | [Variable length encoding, least significant group first](https://protobuf.dev/programming-guides/encoding/#varints) |
| `sint32`, `sint64`                   | [Variable length encoding, zig-zag order](https://protobuf.dev/programming-guides/encoding/#signed-ints)             |
| `fixed32`, `sfixed32`                | Fixed length encoding, 4 bytes (32 bits)                                                                             |
| `fixed64`, `sfixed64`                | Fixed length encoding, 8 bytes (64 bits)                                                                             |

:::info

In a file using the proto3 syntax, a field's type may _not_ refer to a closed enum.
A closed enum type is one that is defined in a file that uses proto2 syntax or one
defined in a file that uses Editions syntax and whose [`enum_type` feature](#enum-type)
has a value of `CLOSED`.

Similarly, in a file using Editions syntax, if the field's [`field_presence` feature](#field-presence)
has a value of `IMPLICIT`, it may not refer to a closed enum type.

These restrictions are because semantics around [default values](#field-presence-and-default-values)
for closed enums (which could be a non-zero value) are not compatible with the
semantics of optional fields with implicit presence.

:::

#### Cardinality and Field Presence

Cardinality determines the number of values a field may have. Map fields and
fields with `repeated` cardinality can have zero or more values, and are represented
in generated code using a map (for the former) or a list or an array (for the latter).
Other fields can have only a single value.

In files that use proto2 or proto3 syntax, "field presence" is derived from the
cardinality. In files that use the Editions syntax, presence is configured via the
[`field_presence` feature](#field-presence).

Field presence indicates whether the field's presence or absence can be detected.
* If a field's presence is required, it may never be absent.
* If the field has explicit presence, its presence can always be detected.
* If the field has implicit presence, its presence cannot be detected if the value
  of the field is the default or zero value. Whether the field is present is
  _implied by_ whether it has a default or zero value.

The following table shows how field presence is derived from the field's cardinality:

| Cardinality | Number of values          | Field Presence |
|-------------|---------------------------|----------------|
| `optional`  | 0 (absent) or 1 (present) | Explicit       |
| `required`  | 1                         | Required       |
| `repeated`  | 0 or more                 | Implicit †     |
| map *       | 0 or more                 | Implicit †     |
| _omitted_   | 0 (absent) or 1 (present) | _see below_    |

__*__ [Map fields](#maps) behave like fields with `repeated` cardinality.
The main difference is that fields with `repeated` cardinality permit duplicates
and preserve element order. But map fields do not permit entries that have
duplicate keys and do not preserve element order.

__†__ Implicit presence for repeated and map fields means that it is not
possible to explicitly distinguish between a value that is absent and
one that is empty. If the field has no entries, it is absent; presence
is implied by the field having at least one entry.

When the cardinality is omitted, the field presence depends on the context
in which the field is defined:

| File Syntax *            | Context of Field Without Cardinality    | Field Presence                        |
|--------------------------|-----------------------------------------|---------------------------------------|
| proto2, proto3, Editions | Inside a [oneof](#oneofs)               | Explicit                              |
| proto3, Editions         | Inside an [`extend` block](#extensions) | Explicit                              |
| proto3                   | Normal field with message type †        | Explicit                              |
| proto3                   | Normal field with non-message type †    | Implicit                              |
| Editions                 | Normal field †                          | _depends on `field_presence` feature_ |

__*__ Files that use proto2 syntax require cardinality for all fields except those
in a oneof, which is why proto2 only appears once in the table.

__†__ A normal field is one that is in neither a oneof nor an `extend` block.

As seen above, fields in a oneof and extensions always have explicit presence.
In proto3 sources, message fields always have explicit presence, too.

In files that use Editions syntax, field presence is defined by the [`field_presence` feature](#field-presence).
If the field's options do not specify that feature, then it inherits a value, either
from an ancestor element (such as a file-wide default) or from the default value for
the specific edition that the file uses. See [_Feature Resolution_](#feature-resolution)
for more details. Note that normal fields _whose type is a message_ never have implicit
presence. If such a field inherits a feature value of implicit field presence, the field
actually has explicit presence.

When the field's presence is required, the containing message is considered invalid
if the field is not present.

:::caution

Use of required field presence (via the `required` cardinality in files that use
proto2 syntax or the `LEGACY_REQUIRED` feature value in files that use Editions
syntax) is considered hazardous and is strongly discouraged.

When a field is required, runtime libraries do not even allow de-serializing a
message if the field is missing. This makes it difficult in practice to change a
required field to be optional in the future (or vice versa), because it becomes
likely for consumers of the message, working with a different version of the
schema, to refuse to de-serialize it. This is why it is not supported in proto3
syntax. Editions syntax supports this, but only for backwards-compatibility with
proto2 syntax, which is why it contains "legacy" in the name.

If you want to enforce that a field must be present, instead define the field
as not required (using the `optional` cardinality in a proto2 source file or by
omitting the cardinality in other files) and then use application-level validation
logic to verify that it's present. This is the same way that other custom
validation rules would be enforced.

:::

#### Field Presence and Default Values

When a field has explicit presence, its presence is preserved in the face of
serialization. In other words, if the field is explicitly set, then when the
containing message is serialized, a consumer of the message that deserializes
it will be able to tell that the field was explicitly set.

When a field has implicit presence, it is not possible to distinguish at runtime
between the case where the field's value was never set and where the field's value
was explicitly set to its default value.

Every field has a default value. When the value of a field is examined, if the
field is not present, its default value is observed. The default value for a field
is the zero value for its type, unless customized, _except_ for enums that are closed.
(A closed enum is one that is defined in a file with proto2 syntax or one that is
configured to be closed via the [`enum_type` feature](#enum-type) in Editions syntax.)
For closed enums, the default value is the first value declared inside the enum (which
might not be the number zero).

The default can only be customized for fields with explicit presence and non-message
types.

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

__*__ In proto3 syntax (and for open enums in edition syntax), the first value
in an enum _must_ have a numeric value of zero. So, in proto3, the default value
of an enum field is always the one with a value of zero.

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
or map value to mean the message is malformed.

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

Groups can only be used in files that use the proto2 syntax.

:::

Groups are like a shorthand mechanism in proto2 for defining both a nested message
and a field of that message type, in a single declaration. The message definition is
inlined into the group field declaration.
```ebnf
GroupDecl = FieldCardinality group FieldName equals FieldNumber
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

The field uses the number and options declared prior to the opening brace; the message
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
are encoded in the binary format using a _delimited_ encoding, which is different
than other fields whose type is a message.

In Editions syntax, the delimited encoding can be configured using the
[`message_encoding` feature](#message-encoding). So a proto2 group can be
represented in Editions syntax by explicitly creating the field and nested
message like in the example above and using the message encoding feature to
enable the delimited encoding (aka "group encoding").

The nested message derived from the group behaves in all other respects as a
normal nested message and can even be used as the type for other fields:
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
Note that these other fields that refer to the message this way will use
normal message encoding, not the delimited encoding that the group field uses.

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
   fields' default JSON names. This check includes fields with custom JSON names, but
   using their default, rather than custom, JSON name. This step ignores custom JSON
   names because the JSON format for [field masks](https://protobuf.dev/reference/protobuf/google.protobuf/#json-encoding-field-masks)
   does not consider custom JSON names and thus requires default JSON names to be unique.
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

In files that use Editions syntax, if the [`json_format` feature](#json-format) is set
to `LEGACY_BEST_EFFORT`, the compiler should treat the message as if it were using the
proto2 syntax, and not issue an error if the fields have conflicts in their default
JSON names.

:::

#### Option Validation {#field-option-validation}

In addition to the rules described above, some of which relate to field options, the
following rules should also be validated by the compiler:

1. The `packed` option may not be used in files that use the Editions syntax. In
   files that use proto2 or proto3 syntax, this option can only be used on repeated
   fields with numeric types. Numeric types include all ten integer types, both floating
   point types, `bool`, and enum types. (See [_Field Types_](#field-types).)
2. In edition 2023, the `ctype` option may only be used on fields whose type is
   `string` or `bytes`. Furthermore, the `CORD` value may not be used on extension fields.
   It can be used on repeated fields, but not map fields. (In proto2 and proto3 syntax,
   these checks are not performed.) In edition 2024 and later, the `ctype` option is not
   allowed; fields must instead use the [`(pb.cpp).string_type` custom feature](#c-string-type).
3. The `lazy` and `unverified_lazy` options may only be used on fields whose type is a
   message. This includes map fields, which are represented as a repeated field of map
   entry messages. They may _not_ be used with group fields in proto2 syntax and also
   may not be used with fields that use delimited message encoding in Editions syntax.
   (See [_Message Encoding_](#message-encoding).)
4. The `js_type` option may only be used on fields that have one of the five 64-bit
   integer types. It can be used with repeated fields. (See [_Field Types_](#field-types).)
5. The `weak` field option may not be used in files that use edition 2024 or later.

In files that use Editions syntax, there are further rules for feature usage:
1. Fields defined in a oneof, extension fields, and repeated fields may not use the
   [`field_presence` feature](#field-presence).
2. Fields whose type is a message may not set the [`field_presence` feature](#field-presence)
   to `IMPLICIT`.
3. Only repeated fields (which includes maps) may use the [`repeated_field_encoding` feature](#repeated-field-encoding).
   This feature may not be set to `PACKED` unless the field's type is a numeric type.
   Numeric types include all ten integer types, both floating point types, `bool`, and
   enum types. (See [_Field Types_](#field-types).)
4. The [`utf8_validation` feature](#utf8-validation) may only be used on fields whose
   type is `string`. It can be used on repeated fields. It can be used on map fields
   only if their key or value type is `string` (or both).
5. The [`message_encoding` feature](#message-encoding) may only be used on fields
   whose type is a message. It may _not_ be used on map fields (even though these are
   represented as a repeated field of map entry messages).

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

Files using proto3 or Editions syntax are not allowed to include _OneofGroupDecl_ elements.

:::

A oneof must contain at least one field or group. Fields in a oneof always omit
the cardinality (`required`, `optional`, or `repeated`) and are always optional.
```ebnf
OneofFieldDecl = OneofFieldDeclTypeName FieldName equals FieldNumber
                 [ CompactOptions ] semicolon .
```

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

#### Extension Declarations

Extension declarations are a mechanism for reserving an extension number, to prevent two
extensions from unintentionally re-using the same number. An extension number can only
be verified to be unique among the files that a compiler is provided. So if there were
two independent projects whose Protobuf files are compiled separately that both define
an extension for the same message and use the same number, the compiler couldn't report
an error because it never sees both extensions in the same set of files.

One possible way avoid conflicts of extension numbers would be to arrange for a global,
monolithic compilation -- a single operation that compiles _every_ file that could be
relevant and that could contain extensions. Depending on how project sources are laid
out, this is often infeasible.

Another possible solution is a custom reservation system, where developers can claim
extension numbers and some other system (other than the Protobuf compiler) enforces the
claims, by examining all of the extension numbers used in the output of a compiler and
comparing that to the database of reservations.

Extension declarations are another mechanism, that can be enforced by the Protobuf
compiler itself. Extension declarations are defined _inside_ the extended message,
via options on an extension range. Each declaration indicates the extension field
number as well as the full name and type of the extension field. When the compiler
encounters an extension, and the extended message contains these declarations, the
compiler reports an error if the extension's name and type don't match what's in
the extension declaration. The downside to this mechanism is that it means that all
users that can _define_ an extension must also be able to make (or propose) changes
to the definition of the message being extended. Due to organization boundaries
and/or source repository layout, this might not be feasible. And this mechanism does
does make it harder to change the extension later (like change its name or type).

The declaration enforcement is enabled via an option named [`verification`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L205-L216).
If it is set to `DECLARATION` _or_ it is not specified but declarations are present,
then declaration enforcement is enabled.

Individual declarations are added via an option named [`declaration`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L200).
Each declaration has the following fields:
* `number`: The extension number whose usage is being declared. It is an error if this
  field is absent.
* `full_name`: The fully-qualified name of the extension, which must include a
  leading dot (`.`). This must be a valid fully-qualified name, which is a dot-separated
  sequence of identifiers, without any whitespace.
* `type`: The type of the extension. If the type is a builtin type, this should be the
  name that is used to identity the type in source, for example `string`, `bytes`, `int64`,
  etc. If the type is a message or an enum, this must be the fully-qualified name of the
  type and must include a leading dot (`.`). If this value starts with a dot, it may be a
  valid fully-qualified name. Otherwise, it must the name of one of the fifteen
  pre-declared scalar types. (See [_Field Types_](#field-types).)
* `repeated`: Must be set to true only if the extension is a repeated field.
* `reserved`: This is used to reserve a number and prevent its use. This is typically
  done for deleted extensions, to prevent later re-use of the number. If this value is
  true, `full_name` and `type` must not be set. Conversely, if this value is true,
  `full_name` and `type` must be present.

Unverified ranges may not have any declarations. So it is an error for the `verification`
field to be explicitly set to `UNVERIFIED` and to also have one or more declarations.

When declaration enforcement is enabled, all extensions for the extended message and
in the extension range _must_ match a declaration. The extension must exactly match all
four properties: `number`, `full_name`, `type`, and `repeated`.

No two declarations in the same extended message can specify the same number.
No two declarations across all observed extended messages may specify the same
full name. An extension is _uniquely_ identified by its full name, and a single
extension cannot extend more than one message. So it is not possible for the
same extension full name to be valid from more than one extended message.

Finally, an extension range that includes declarations in its options may only
reference a single span of numbers. This is a quirk in the reference implementation
but also a quirk for runtime checks that declarations are valid, due to the way
that extension range options are actually represented in a descriptor. So the
following is _not_ valid:
```protobuf
message Test {
  // highlight-start
  extensions 100 to 200, 300 to 500 [
  // highlight-end
    declaration = {
      number: 100
      full_name: ".foo.bar.baz"
      type: "string"
    }
  ];
}
```
The above results in an error message like so:
```
extension declaration has number outside the range: 100 not in [300,500]
```
The fix is to break the ranges up into two statements, each with a single span:
```protobuf
message Test {
  // highlight-start
  extensions 100 to 200 [
  // highlight-end
    declaration = {
      number: 100
      full_name: ".foo.bar.baz"
      type: "string"
    }
  ];
  // highlight-start
  extensions 300 to 500;
  // highlight-end
}
```

#### Extension Declaration Examples

The following example allows arbitrary extensions for numbers 100 to 200 because
verification has not been explicitly enabled and there are no declarations.
```protobuf
message Test {
  extensions 100 to 200;
}
```

The following example will not permit an extension with number 100 (because it
has been marked as reserved) nor will it permit any extensions with numbers 102
to 200, because there are no declarations that an extension could match.
```protobuf
message Test {
  extensions 100 to 200 [
    declaration = {
      number: 100
      reserved: true
    },
    declaration = {
      number: 101
      full_name: ".foo.bar.baz"
      type: "string"
    }
  ];
}
```

The following example is similar to the one above except it allows arbitrary
extensions for numbers 102 to 200 because they are in a separate range that is
not verified.
```protobuf
message Test {
  extensions 100 to 102 [
    declaration = {
      number: 100
      reserved: true
    },
    declaration = {
      number: 101
      full_name: ".foo.bar.baz"
      type: "string"
    }
  ];
  extensions 102 to 200;
}
```

### Reserved Names and Numbers

Messages can reserve field names and numbers to prevent them from being used.
This is typically to prevent old tag numbers and names from being recycled.
```ebnf
MessageReservedDecl = reserved ( TagRanges | NameStrings | Names ) semicolon .

NameStrings = StringLiteral { comma StringLiteral } .
Names = identifier { comma identifier } .
```

```txt title="Examples"
reserved 100;
reserved 10 to 10000;
reserved 10 to 20, 50 to 100, 20000 to max;
reserved "foo";
reserved "foo", "bar", "baz";
reserved abc, xyz;
```

:::info

Files using the proto2 or proto3 syntax are not allowed to include _Names_ elements.
They must instead use _NameStrings_ elements. (In other words, they must use string
literals instead of identifiers.)

Conversely, files using that use Editions syntax are not allowed to include _NameStrings_
elements. They must instead use _Names_ elements.

:::

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
1. The message must be in a file that uses the proto2 or Editions syntax. Files that use
   proto3 syntax are not allowed to define messages that use the message set wire format.
2. The message must _not_ define any normal fields (no map fields or groups either).
3. The message _must_ define at least one extension range.
4. Extensions of such messages must be optional (no repeated extensions allowed).
5. Extensions of such messages must have a message type (no scalar extensions allowed).


## Enums

Enums represent an enumerated type, where values must be one of the defined
enum values.
```ebnf
EnumDecl = [ SymbolVisibility ] enum EnumName l_brace { EnumElement } r_brace .

EnumName    = identifier .
EnumElement = OptionDecl |
              EnumValueDecl |
              EnumReservedDecl |
              EmptyDecl .
```

```txt title="Examples"
enum JobState {
  PENDING = 0;
  QUEUED = 1;
  STARTED = 2;
  FINISHED = 3;
  FAILED = 4;
}

// Edition 2024: explicit visibility
export enum Status {
  STATUS_UNSPECIFIED = 0;
  OK = 1;
  ERROR = 2;
}

local enum InternalCode {
  INTERNAL_CODE_UNSPECIFIED = 0;
  RETRY = 1;
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

Enums must contain at least one enum value. To enable a predictive parser implementation
and avoid ambiguity, an enum value's name cannot be `"option"` or `"reserved"`.
```ebnf
EnumValueDecl = EnumValueName equals EnumValueNumber [ CompactOptions ] semicolon .

EnumValueName   = identifier  - ( option | reserved ) .
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

In files using the Editions syntax, all open enums must use a numeric value of
zero for the first enum value defined. An open enum is one whose [`enum_type` feature](#enum-type)
has a value of `OPEN`.

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

In files that use Editions syntax, if the [`json_format` feature](#json-format) is set
to `LEGACY_BEST_EFFORT`, the compiler should treat the message as if it were using the
proto2 syntax, and not issue an error if the values have such naming conflicts.

:::

### Reserved Names and Numbers {#enum-reserved-names-and-numbers}

Like messages, enums can also reserve names and numbers, typically to prevent
recycling names and numbers from old enum values.
```ebnf
EnumReservedDecl = reserved ( EnumValueRanges | NameStrings | Names ) semicolon .

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
reserved FOO, BAR;
```

:::info

Files using the proto2 or proto3 syntax are not allowed to include _Names_ elements.
They must instead use _NameStrings_ elements. (In other words, they must use string
literals instead of identifiers.)

Conversely, files using that use Editions syntax are not allowed to include _NameStrings_
elements. They must instead use _Names_ elements.

:::

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
is also possible to define "extension fields", also known simply as
"extensions". Extensions can only be declared for an _extendable message_,
which is one that declares at least one [extension range](#extension-ranges).

Extensions may be declared in both proto2 and proto3 syntax
levels, but an extendable message can only be defined in a file with
proto2 syntax.
```ebnf
ExtensionDecl = extend ExtendedMessage l_brace { ExtensionElement } r_brace .

ExtendedMessage  = TypeName .
ExtensionElement = ExtensionFieldDecl |
                   GroupDecl .

ExtensionFieldDecl = FieldDeclWithCardinality |
                     ExtensionFieldDeclTypeName FieldName equals FieldNumber
                         [ CompactOptions ] semicolon .
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

Files using proto3 or Editions syntax are not allowed to include _GroupDecl_ elements.

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

Though the _FieldDeclWithCardinality_ and _GroupDecl_ productions are re-used here,
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

Field options on extensions are subject to the same rules as other fields. See
[_Option Validation_](#field-option-validation). Furthermore, extensions defined in a
file that has an `optimize_for` file option set to `LITE_RUNTIME` are not allowed if
the extended message is defined in a file where the `optimize_for` file option is not
set or is set to a value _other than_ `LITE_RUNTIME`. Put another way, a non-lite message
cannot be extended with lite extensions.

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

MessageType = l_paren [ stream ] MethodDeclTypeName r_paren .
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


## Features in Editions 2023 and 2024

This section describes the available feature fields in editions 2023 and 2024. As
future editions are released, this section will be expanded to include new fields
from those editions.

This section will generally _not_ include custom features -- ones that are specific to
a particular language runtime or code generation plugin. The exceptions to this are
the language-specific features that were introduced alongside editions 2023 and 2024
because they are needed to migrate files with proto2 or proto3 syntax to editions
or to support new edition 2024 functionality.

### Field Presence

```protobuf title="Definition"
optional FieldPresence field_presence = 1 [
  targets = TARGET_TYPE_FIELD,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "EXPLICIT" },
  edition_defaults = { edition: EDITION_PROTO3, value: "IMPLICIT" },
  edition_defaults = { edition: EDITION_2023, value: "EXPLICIT" }
];

enum FieldPresence {
  FIELD_PRESENCE_UNKNOWN = 0;
  EXPLICIT = 1;
  IMPLICIT = 2;
  LEGACY_REQUIRED = 3;
}
```

_Applies to_: Fields (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2023";

message Test {
  // highlight-start
  string name = 1 [features.field_presence = IMPLICIT];
  // highlight-end
}
```

In Editions syntax, this is used to configure a field as required, optional with
implicit presence, or optional with explicit presence. The default value is `EXPLICIT`,
which means non-repeated fields are optional with explicit presence. If the default
is changed via a file option to `IMPLICIT` then it matches proto3 semantics:
non-repeated fields are optional with implicit presence.

It is an error to use the `field_presence` feature on a repeated or map field, an
extension field, or a field inside a oneof. Note that repeated and map fields always
have implicit presence (they are present when there is at least one element).
Non-repeated extension fields and fields in a oneof are always optional with
explicit presence.

It is also an error to set the `field_presence` feature to `IMPLICIT` for a field
whose type is a message. Message fields, if not required, always have explicit
presence, even if a file option is used to set a file-wide default of implicit
presence.

### Repeated Field Encoding

```protobuf title="Definition"
optional RepeatedFieldEncoding repeated_field_encoding = 3 [
  targets = TARGET_TYPE_FIELD,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "EXPANDED" },
  edition_defaults = { edition: EDITION_PROTO3, value: "PACKED" }
];

enum RepeatedFieldEncoding {
  REPEATED_FIELD_ENCODING_UNKNOWN = 0;
  PACKED = 1;
  EXPANDED = 2;
}
```

_Applies to_: Fields (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2023";

message Test {
  // highlight-start
  repeated uint64 flags = 1 [features.repeated_field_encoding = EXPANDED];
  // highlight-end
}
```

In Editions syntax, this is used to configure a repeated numeric field to use the
packed encoding format or not. The default value is `PACKED`, which means such fields
use the compact "packed" wire format. If the default is changed via a file option to
`EXPANDED` then it matches default proto2 semantics: repeated fields use a less compact
wire format.

This replaces the `packed` field option, which may only be used in files that use
proto2 or proto3 syntax. Files that use Editions syntax must use this feature instead.

It is an error to use the `repeated_field_encoding` feature on a non-repeated field
or a repeated field whose type cannot use the compact encoding. Only primitive
numeric fields (which includes bools and enums) can use the compact encoding. Fields
whose type is a message, group, string, or bytes may not use this feature. This also
means that map fields may not use this feature (under the hood, they are represented
as a repeated message field, where each message element is an entry in the map).

### Message Encoding

```protobuf title="Definition"
optional MessageEncoding message_encoding = 5 [
  targets = TARGET_TYPE_FIELD,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "LENGTH_PREFIXED" }
];

enum MessageEncoding {
  MESSAGE_ENCODING_UNKNOWN = 0;
  LENGTH_PREFIXED = 1;
  DELIMITED = 2;
}
```

_Applies to_: Fields (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2023";

message Test {
  // highlight-start
  Other other = 1 [features.message_encoding = DELIMITED];
  // highlight-end
  message Other {}
}
```

In Editions syntax, this can be used to activate "group encoding" for a message field.
The default value is `LENGTH_PREFIXED`, which is also how message fields in proto2 and
proto3 sources are serialized. But when set to `DELIMITED`, messages are serialized
in the same fashion as groups in proto2 sources.

Note that the two encodings are **not** compatible: one cannot change the message
encoding for a field from one value to another without potentially breaking consumers
of the message (at least for now). The advantage of using `DELIMITED` is that it is
more efficient when marshalling messages to bytes.

It is an error to use the `message_encoding` feature on a map field or a field whose
type is not a message. Though maps are represented as a repeated field of messages,
they always use length-prefixed encoding, even if a file option is used to set a
file-wide default of delimited encoding. Similarly, in map fields where the value is
a message, that message value of the map entry will use length-prefixed encoding, not
delimited encoding.

### UTF8 Validation

```protobuf title="Definition"
optional Utf8Validation utf8_validation = 4 [
  targets = TARGET_TYPE_FIELD,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "NONE" },
  edition_defaults = { edition: EDITION_PROTO3, value: "VERIFY" }
];

enum Utf8Validation {
  UTF8_VALIDATION_UNKNOWN = 0;
  VERIFY = 2;
  NONE = 3;
  reserved 1;
}
```

_Applies to_: Fields (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2023";

message Test {
  // highlight-start
  repeated string not_utf8 = 1 [features.utf8_validation = NONE];
  // highlight-end
}
```

In Editions syntax, this can be used to activate runtime verification that string
values are valid UTF8-encoded sequences. The default value is `VERIFY`. If the
default is changed via a file option to `NONE` then it matches proto2 semantics:
string contents are not checked and could contain invalid byte sequences.

It is an error to use the `utf8_validation` feature on a field whose type is not a
string. The feature may be used on map fields only if the map's key or value type is
a string.

### Enum Type

```protobuf title="Definition"
optional EnumType enum_type = 2 [
  targets = TARGET_TYPE_ENUM,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "CLOSED" },
  edition_defaults = { edition: EDITION_PROTO3, value: "OPEN" }
];

enum EnumType {
  ENUM_TYPE_UNKNOWN = 0;
  OPEN = 1;
  CLOSED = 2;
}
```

_Applies to_: Enums (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2023";

enum Test {
  // highlight-start
  option features.enum_type = CLOSED;
  // highlight-end
  VALUE = 1;
}
```

In Editions syntax, this can be used to configure whether an enum is open or closed.
An open enum accepts numeric values other than those configured in the schema. A closed
enum will effectively ignore such an unrecognized numeric value. With a closed enum,
if such a value is encountered during de-serialization, the field will remain unset
and the value will be stored as an unrecognized field.

An open enum _must_ have a value with the number zero as its first value.

The default value is `OPEN`. If the default is changed via a file option to `CLOSED`
then it matches proto2 semantics, where enums are always closed.

A field that is optional with implicit presence may not have a closed enum as
its type.

### JSON Format

```protobuf title="Definition"
optional JsonFormat json_format = 6 [
  targets = TARGET_TYPE_MESSAGE,
  targets = TARGET_TYPE_ENUM,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "LEGACY_BEST_EFFORT" },
  edition_defaults = { edition: EDITION_PROTO3, value: "ALLOW" }
];

enum JsonFormat {
  JSON_FORMAT_UNKNOWN = 0;
  ALLOW = 1;
  LEGACY_BEST_EFFORT = 2;
}
```

_Applies to_: Messages and Enums (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2023";

message Test {
  // highlight-start
  option features.json_format = LEGACY_BEST_EFFORT;
  // highlight-end
  string _str = 1;
  uint32 Str = 2;
}
```

In Editions syntax, this can be used to configure whether an enum or message must
support the JSON format. The default value is `ALLOW`. If the default is changed via
a file option to `LEGACY_BEST_EFFORT` then it matches proto2 semantics, where the
JSON format was best effort since the proto2 syntax was created before the JSON format
was defined.

Most runtimes and plugins never look at this feature. It is primarily used by the
compiler itself to decide whether JSON-name-related conflicts are an error or a
warning. (Also see [JSON Name Conflicts](#json-name-conflicts).)

### Default Symbol Visibility

```protobuf title="Definition"
message VisibilityFeature {
  enum DefaultSymbolVisibility {
    DEFAULT_SYMBOL_VISIBILITY_UNKNOWN = 0;
    EXPORT_ALL = 1;
    EXPORT_TOP_LEVEL = 2;
    LOCAL_ALL = 3;
    STRICT = 4;
  }
  reserved 1 to max;
}

optional VisibilityFeature.DefaultSymbolVisibility default_symbol_visibility = 8 [
  retention = RETENTION_SOURCE,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2024
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "EXPORT_ALL" },
  edition_defaults = { edition: EDITION_2024, value: "EXPORT_TOP_LEVEL" }
];
```

_Applies to_: Files

```protobuf title="Example"
edition = "2024";

// highlight-start
option features.default_symbol_visibility = LOCAL_ALL;
// highlight-end

export message PublicApi {
  string id = 1;
}

// This message is local and not visible to importers.
message InternalHelper {
  int32 code = 1;
}
```

In Editions syntax, this controls whether messages and enums defined in a file are
exported (visible to files that import this file) by default. This feature has
`RETENTION_SOURCE`, meaning it is not included in the compiled descriptor.

The possible values are:
* `EXPORT_ALL` (pre-2024 default): All messages and enums are exported, regardless
  of nesting.
* `EXPORT_TOP_LEVEL` (2024 default): Top-level messages and enums are exported.
  Nested messages and enums are local (not visible to importers) by default.
* `LOCAL_ALL`: All messages and enums are local by default, whether top-level or
  nested.
* `STRICT`: All messages and enums are local by default, and nested types cannot
  be overridden to be exported.

Individual messages and enums can override the file-level default by using the
`export` or `local` keyword before the `message` or `enum` keyword, except in
the `STRICT` mode where nested types cannot be exported.

### Enforce Naming Style

```protobuf title="Definition"
optional EnforceNamingStyle enforce_naming_style = 7 [
  retention = RETENTION_SOURCE,
  targets = TARGET_TYPE_FILE,
  targets = TARGET_TYPE_EXTENSION_RANGE,
  targets = TARGET_TYPE_MESSAGE,
  targets = TARGET_TYPE_FIELD,
  targets = TARGET_TYPE_ONEOF,
  targets = TARGET_TYPE_ENUM,
  targets = TARGET_TYPE_ENUM_ENTRY,
  targets = TARGET_TYPE_SERVICE,
  targets = TARGET_TYPE_METHOD,
  feature_support = {
    edition_introduced: EDITION_2024
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "STYLE_LEGACY" },
  edition_defaults = { edition: EDITION_2024, value: "STYLE2024" }
];

enum EnforceNamingStyle {
  ENFORCE_NAMING_STYLE_UNKNOWN = 0;
  STYLE2024 = 1;
  STYLE_LEGACY = 2;
}
```

_Applies to_: Files, Messages, Fields, Oneofs, Enums, Enum Values, Extension Ranges, Services, Methods

```protobuf title="Example"
edition = "2024";

// highlight-start
option features.enforce_naming_style = STYLE_LEGACY;
// highlight-end

// With STYLE_LEGACY, non-conforming names are allowed.
message myMessage {
  int32 MyField = 1;
}
```

In Editions syntax, this enforces adherence to the Protobuf style guide for naming
conventions. This feature has `RETENTION_SOURCE`, meaning it is not included in the
compiled descriptor.

The possible values are:
* `STYLE2024` (2024 default): Enforces naming rules from the Protobuf style guide.
  The required conventions for each element type are:

  | Element      | Required Style                  | Example                 |
  |--------------|-------------------------------- |-------------------------|
  | Packages     | lower_snake_case, dot-delimited | `my_company.my_project` |
  | Messages     | TitleCase                       | `MyMessage`             |
  | Fields       | lower_snake_case                | `my_field`              |
  | Oneofs       | lower_snake_case                | `my_oneof`              |
  | Enums        | TitleCase                       | `MyEnum`                |
  | Enum values  | UPPER_SNAKE_CASE                | `MY_ENUM_VALUE`         |
  | Services     | TitleCase                       | `MyService`             |
  | Methods      | TitleCase                       | `MyMethod`              |

  TitleCase requires the name to start with an uppercase letter and contain only
  alphanumeric characters (no underscores). The enforcement is permissive: names
  like `ALLCAPS` or single-letter names like `M` are accepted.

  In addition to the per-element casing rules, `STYLE2024` enforces the following
  rules for underscore usage in identifiers that use `lower_snake_case` or
  `UPPER_SNAKE_CASE`:
  - Identifiers must not start or end with an underscore.
  - Underscores must be followed by a letter, not a digit or another underscore.
    For example, `bar_1` is invalid; use `bar_v1` or `bar1` instead.

* `STYLE_LEGACY` (pre-2024 default): No naming style enforcement. This preserves
  pre-2024 behavior where any valid identifier was accepted without style checks.

### C++: Legacy Closed Enum

```protobuf title="Definition"
optional bool legacy_closed_enum = 1 [
  targets = TARGET_TYPE_FIELD,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
    edition_deprecated: EDITION_2023
    deprecation_warning: "The legacy closed enum treatment in C++ is "
                         "deprecated and is scheduled to be removed in "
                         "edition 2025.  Mark enum type on the enum "
                         "definitions themselves rather than on fields."
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "true" },
  edition_defaults = { edition: EDITION_PROTO3, value: "false" }
];
```

_Applies to_: Fields (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2023";
import "google/protobuf/cpp_features.proto";

message Test {
  // highlight-start
  Enum en = 1 [features.(pb.cpp).legacy_closed_enum = true];
  // highlight-end
}
enum Enum {
  ZERO = 0;
}
```

This custom feature is defined in the well-known import `"google/protobuf/cpp_features.proto"`
as a field inside the `(pb.cpp)` extension.

In Editions syntax, this is used to configure a field that refers to an open enum
to behave during de-serialization as if the enum were closed. This only impacts the
C++ runtime. This is purely for backwards-compatibility, to mimic legacy behavior
that would occur when a message defined in a proto2 file had a field whose type was
an enum from a proto3 file. In that case, though the enum is open (since it is defined
in a proto3 file), the field would behave as if the enum were closed.

### C++: String Type

```protobuf title="Definition"
optional StringType string_type = 2 [
  targets = TARGET_TYPE_FIELD,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "STRING" },
  edition_defaults = { edition: EDITION_2024, value: "VIEW" }
];

enum StringType {
  STRING_TYPE_UNKNOWN = 0;
  VIEW = 1;
  CORD = 2;
  STRING = 3;
}
```

_Applies to_: Fields (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2023";
import "google/protobuf/cpp_features.proto";

message Test {
  // highlight-start
  string name = 1 [features.(pb.cpp).string_type = VIEW];
  // highlight-end
}
```

This custom feature is defined in the well-known import `"google/protobuf/cpp_features.proto"`
as a field inside the `(pb.cpp)` extension.

In Editions syntax, this can be used to configure the type used to represent
a string or bytes field. This only impacts C++ generated code. This replaces the
`ctype` field option. In edition 2023, a field can use _either_ this feature or
the `ctype` field option. In edition 2024 and later, the `ctype` field option is
not allowed; only this feature is used to control C++ code generation.

Note that this enum does _not_ have a value for `STRING_PIECE`, which was one of
the possible values for the `ctype` option. This was only implemented inside of
Google and never implemented in the open-source release of the C++ Protobuf
runtime. So sources should not be using this value. But if it were used, it
should be changed to `STRING` when such a field is migrated to Editions syntax
and to use this feature.

### C++: Enum Name Uses String View

```protobuf title="Definition"
optional bool enum_name_uses_string_view = 3 [
  retention = RETENTION_RUNTIME,
  targets = TARGET_TYPE_ENUM,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2024
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "false" },
  edition_defaults = { edition: EDITION_2024, value: "true" }
];
```

_Applies to_: Enums (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2024";
import "google/protobuf/cpp_features.proto";

// highlight-start
option features.(pb.cpp).enum_name_uses_string_view = false;
// highlight-end

enum State {
  STATE_UNSPECIFIED = 0;
  RUNNING = 1;
}
```

This custom feature is defined in the well-known import `"google/protobuf/cpp_features.proto"`
as a field inside the `(pb.cpp)` extension.

In Editions syntax, this controls whether generated C++ enum helper functions
(such as `_Name()`) return `absl::string_view` (when `true`) or `std::string`
(when `false`). The default changes to `true` in edition 2024.

### Java: Legacy Closed Enum

```protobuf title="Definition"
optional bool legacy_closed_enum = 1 [
  targets = TARGET_TYPE_FIELD,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
    edition_deprecated: EDITION_2023
    deprecation_warning: "The legacy closed enum treatment in Java is "
                         "deprecated and is scheduled to be removed in "
                         "edition 2025.  Mark enum type on the enum "
                         "definitions themselves rather than on fields."
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "true" },
  edition_defaults = { edition: EDITION_PROTO3, value: "false" }
];
```

_Applies to_: Fields (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2023";
import "google/protobuf/java_features.proto";

message Test {
  // highlight-start
  Enum en = 1 [features.(pb.java).legacy_closed_enum = true];
  // highlight-end
}
enum Enum {
  ZERO = 0;
}
```
This custom feature is defined in the well-known import `"google/protobuf/java_features.proto"`
as a field inside the `(pb.java)` extension.

In Editions syntax, this is used to configure a field that refers to an open enum
to behave during de-serialization as if the enum were closed. This only impacts the
Java runtime. This is purely for backwards-compatibility, to mimic legacy behavior
that would occur when a message defined in a proto2 file had a field whose type was
an enum from a proto3 file. In that case, though the enum is open (since it is defined
in a proto3 file), the field would behave as if the enum were closed.

### Java: UTF8 Validation

```protobuf title="Definition"
optional Utf8Validation utf8_validation = 2 [
  targets = TARGET_TYPE_FIELD,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
    edition_deprecated: EDITION_2024
    deprecation_warning: "The Java-specific utf8 validation feature is "
                         "deprecated and is scheduled to be removed in "
                         "edition 2025.  Utf8 validation behavior should "
                         "use the global cross-language utf8_validation "
                         "feature."
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "DEFAULT" }
];

enum Utf8Validation {
  UTF8_VALIDATION_UNKNOWN = 0;
  // Respect the UTF8 validation behavior specified by the global
  // utf8_validation feature.
  DEFAULT = 1;
  // Verifies UTF8 validity, overriding the global utf8_validation
  // feature. This represents the legacy java_string_check_utf8
  // file option.
  VERIFY = 2;
}
```

_Applies to_: Fields (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2023";
import "google/protobuf/cpp_features.proto";
option features.utf8_validation = NONE;

message Test {
  // highlight-start
  string name = 1 [features.(pb.java).utf8_validation = VERIFY];
  // highlight-end
}
```

This custom feature is defined in the well-known import `"google/protobuf/java_features.proto"`
as a field inside the `(pb.java)` extension.

In Editions syntax, this can be used to configure whether a string field has its
contents verified at runtime to be valid UTF8. This only impacts the Java runtime.
This can be used to mimic the legacy behavior of a proto2 file that had its
`java_string_check_utf8` file option set to true. In such a file, all string fields
have a [`utf8_validation` feature](#utf8-validation) set to `NONE` (by virtue of
it being a proto2 file) but the Java runtime will check for valid UTF8 encoding
anyway.

This feature is deprecated as of edition 2024. Users should use the global
[`utf8_validation` feature](#utf8-validation) instead.

### Java: Large Enum

```protobuf title="Definition"
optional bool large_enum = 3 [
  retention = RETENTION_RUNTIME,
  targets = TARGET_TYPE_ENUM,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2024
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "false" }
];
```

_Applies to_: Enums (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2024";
import "google/protobuf/java_features.proto";

// highlight-start
enum LargeState {
  option features.(pb.java).large_enum = true;
  // highlight-end
  LARGE_STATE_UNSPECIFIED = 0;
  // ... many values ...
}
```

This custom feature is defined in the well-known import `"google/protobuf/java_features.proto"`
as a field inside the `(pb.java)` extension.

In Editions syntax, this allows creation of Java enums that exceed the standard Java
language limits for enum constants. The default value is `false`. When enabled,
the generated Java code uses an alternative representation that avoids the JVM
constant limit for enum types. Note that switch statements are not supported on
enum types that have this feature enabled.

### Java: Nest in File Class {#java-nest-in-file-class}

```protobuf title="Definition"
message NestInFileClassFeature {
  enum NestInFileClass {
    NEST_IN_FILE_CLASS_UNKNOWN = 0;
    NO = 1;
    YES = 2;
    LEGACY = 3 [feature_support = {
      edition_introduced: EDITION_2024
      edition_removed: EDITION_2024
    }];
  }
  reserved 1 to max;
}

optional NestInFileClassFeature.NestInFileClass nest_in_file_class = 5 [
  retention = RETENTION_RUNTIME,
  targets = TARGET_TYPE_MESSAGE,
  targets = TARGET_TYPE_ENUM,
  targets = TARGET_TYPE_SERVICE,
  feature_support = {
    edition_introduced: EDITION_2024
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "LEGACY" },
  edition_defaults = { edition: EDITION_2024, value: "NO" }
];
```

_Applies to_: Messages, Enums, and Services

```protobuf title="Example"
edition = "2024";
import "google/protobuf/java_features.proto";

// highlight-start
message MyMessage {
  option features.(pb.java).nest_in_file_class = YES;
  // highlight-end
  string name = 1;
}
```

This custom feature is defined in the well-known import `"google/protobuf/java_features.proto"`
as a field inside the `(pb.java)` extension.

In Editions syntax, this controls whether generated top-level messages, enums, and
services are nested inside the file-level outer Java class. This replaces the
`java_multiple_files` file option (which is banned in edition 2024 and later).

The possible values are:
* `NO` (2024 default): Top-level types are generated as separate class files, not
  nested inside the file class. This is equivalent to `java_multiple_files = true`.
* `YES`: Top-level types are nested inside the file-level outer Java class. This
  is equivalent to `java_multiple_files = false`.
* `LEGACY`: Falls back to the behavior determined by the `java_multiple_files` file
  option. This value is only available for migration purposes and is removed in
  edition 2024 (it exists solely for the `EDITION_LEGACY` default).

In addition to this feature, the default naming convention for the outer Java class
changes in edition 2024. In earlier editions, the outer class name is derived from
the file name in PascalCase (e.g., `bar_baz.proto` produces `BarBaz`), with
`OuterClass` appended if the name conflicts with a top-level type. In edition 2024,
the outer class name appends `Proto` by default (e.g., `bar_baz.proto` produces
`BarBazProto`). The `java_outer_classname` file option can still be used to override
this default in any edition.

### Go: Legacy UnmarshalJSON Enum

```protobuf title="Definition"
optional bool legacy_unmarshal_json_enum = 1 [
  targets = TARGET_TYPE_ENUM,
  feature_support = {
    edition_introduced: EDITION_2023
    edition_deprecated: EDITION_2023
    deprecation_warning: "The legacy UnmarshalJSON API is deprecated and "
                         "will be removed in a future edition."
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "true" },
  edition_defaults = { edition: EDITION_PROTO3, value: "false" }
];
```

_Applies to_: Enums

```protobuf title="Example"
edition = "2023";
import "google/protobuf/go_features.proto";

enum Test {
  // highlight-start
  option features.(pb.go).legacy_unmarshal_json_enum = true;
  // highlight-end
  VALUE = 0;
}
```

This custom feature is **NOT** defined in a well-known import. It is defined in an
import named `"google/protobuf/go_features.proto"` as a field inside the `(pb.go)`
extension. The authoritative source for this file's content is the repo at
https://github.com/protocolbuffers/protobuf-go.

In Editions syntax, this can be used to configure whether a generated Go
type representing an enum would include an `UnmarshalJSON` method. This only
impacts Go generated code. This can be used to mimic the legacy behavior of a
proto2 file, in which enum types had such a method generated.

### Go: API Level

```protobuf title="Definition"
optional APILevel api_level = 2 [
  retention = RETENTION_RUNTIME,
  targets = TARGET_TYPE_MESSAGE,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2023
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "API_LEVEL_UNSPECIFIED" },
  edition_defaults = { edition: EDITION_2024, value: "API_OPAQUE" }
];

enum APILevel {
  API_LEVEL_UNSPECIFIED = 0;
  API_OPEN = 1;
  API_HYBRID = 2;
  API_OPAQUE = 3;
}
```

_Applies to_: Messages (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2024";
import "google/protobuf/go_features.proto";

// highlight-start
message Test {
  option features.(pb.go).api_level = API_HYBRID;
  // highlight-end
  string name = 1;
}
```

This custom feature is **NOT** defined in a well-known import. It is defined in an
import named `"google/protobuf/go_features.proto"` as a field inside the `(pb.go)`
extension. The authoritative source for this file's content is the repo at
https://github.com/protocolbuffers/protobuf-go.

In Editions syntax, this selects the Go protobuf API level for generated message
types. The default changes from `API_LEVEL_UNSPECIFIED` (which behaves like
`API_OPEN`) to `API_OPAQUE` in edition 2024.

The possible values are:
* `API_OPEN`: Generated structs have exported fields that can be accessed directly.
  This is the traditional Go protobuf API.
* `API_HYBRID`: Generated structs have both exported fields and accessor methods.
  This provides a migration path between open and opaque APIs.
* `API_OPAQUE`: Generated struct fields are unexported and hidden. All access goes
  through getter and setter methods. This is the default in edition 2024.

### Go: Strip Enum Prefix

```protobuf title="Definition"
optional StripEnumPrefix strip_enum_prefix = 3 [
  retention = RETENTION_RUNTIME,
  targets = TARGET_TYPE_ENUM,
  targets = TARGET_TYPE_ENUM_ENTRY,
  targets = TARGET_TYPE_FILE,
  feature_support = {
    edition_introduced: EDITION_2024
  },
  edition_defaults = { edition: EDITION_LEGACY, value: "STRIP_ENUM_PREFIX_KEEP" }
];

enum StripEnumPrefix {
  STRIP_ENUM_PREFIX_UNSPECIFIED = 0;
  STRIP_ENUM_PREFIX_KEEP = 1;
  STRIP_ENUM_PREFIX_GENERATE_BOTH = 2;
  STRIP_ENUM_PREFIX_STRIP = 3;
}
```

_Applies to_: Enums and Enum Values (can also be specified as a file option, to provide file-wide default)

```protobuf title="Example"
edition = "2024";
import "google/protobuf/go_features.proto";

// highlight-start
enum State {
  option features.(pb.go).strip_enum_prefix = STRIP_ENUM_PREFIX_STRIP;
  // highlight-end
  STATE_UNSPECIFIED = 0;
  STATE_RUNNING = 1;
  STATE_STOPPED = 2;
}
// Generated Go constants: State_UNSPECIFIED, State_RUNNING, State_STOPPED
// (with prefix stripped: Unspecified, Running, Stopped)
```

This custom feature is **NOT** defined in a well-known import. It is defined in an
import named `"google/protobuf/go_features.proto"` as a field inside the `(pb.go)`
extension. The authoritative source for this file's content is the repo at
https://github.com/protocolbuffers/protobuf-go.

In Editions syntax, this controls whether the Go code generator strips repetitive
enum name prefixes from generated enum value constants.

The possible values are:
* `STRIP_ENUM_PREFIX_KEEP` (default): Preserves the full enum value names as-is
  in the generated Go constants.
* `STRIP_ENUM_PREFIX_GENERATE_BOTH`: Generates both the full prefixed names and
  shorter unprefixed names, allowing a gradual migration.
* `STRIP_ENUM_PREFIX_STRIP`: Removes the enum type name prefix from generated
  Go constant names.
