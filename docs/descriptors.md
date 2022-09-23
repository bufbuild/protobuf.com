---
title: Compilation and Descriptors
sidebar_position: 20
---

This document describes the sequence of steps employed by a compiler for the
Protobuf language. The job of a compiler is to process Protobuf IDL sources and
generate source code in a specific target language. The final code generation
step is not discussed here, but everything leading up to it is.

A core concept in compilation is a set of descriptors. Descriptors are the commonly used
"language model" for Protocol Buffers. They are used as an intermediate artifact to
support code generation, and they are also used in runtime libraries to implement support
for reflection and dynamic types.


## Compilation Process

A Protobuf compiler implementation will generally have the following phases. The first two steps are
described in detail in the _[Language Specification](./language-spec.md)_.

1. **Lexical Analysis:**
   This step breaks up the bytes in a source file into a stream of lexical elements
   called tokens.

2. **Syntactic Analysis:**
   This step processes the stream of tokens into an abstract syntax tree (AST).

3. **Producing a Descriptor:**
   The functional output of parsing a source file is a "file descriptor". It is
   itself a protobuf message that resembles an AST. In fact, this step can be combined
   with the syntactic analysis step above, such that the AST produced _is_ a file descriptor.
   However, a file descriptor is "lossy", meaning that it does not have enough
   information to perfectly recover the original source contents. Some tools, like
   formatters, will prefer to operate on a non-lossy AST. A non-lossy AST can also
   provide better error messages when interpreting options.

   The file descriptor is described by the message [`google.protobuf.FileDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L62),
   defined in `google/protobuf/descriptor.proto` included in the official [Protobuf distribution](https://github.com/protocolbuffers/protobuf#protocol-compiler-installation).

4. **Linking:**
   This stage verifies that all type references in the source file are valid. So
   when a field or RPC method refers to another message type, this step verifies that the
   referenced message type exists.

   More details can be found in the _[Relative References](./language-spec.md#relative-references)_
   section of the spec, for how identifiers in the source file get resolved into references to
   messages, enums, and extensions.

   The act of linking, in addition to validating all symbol references, produces a data
   structure for mapping a symbol to its definition. This allows efficient look-up of type
   definitions for the next step. This stage is also where symbol conflicts (two elements
   with the same fully-qualified name) are detected and reported, as a natural
   consequence of building this data structure.

5. **Interpreting Options:**
   Once linked, it is possible to interpret options. This is the most complicated step
   and generally relies on data structures computed during linking. This stage is
   described more fully in the _[language spec](./language-spec.md#resolving-option-names)_
   with some additional content [below](#options).

6. **Semantic Validation:**
   After the above steps are complete, the descriptor with interpreted options can be
   validated. Syntax errors, invalid type references, and type errors in option values
   are caught in the above steps. But there are other rules in the IDL which are most
   easily verified at this point, after options are interpreted.

7. **Computing Source Code Info:**
   Optionally, the file descriptor's "source code info" can be computed. This is a field
   of the descriptor that includes locations of the various elements in the original
   source file and also includes comments that were in the source file.

   This is described reasonably well in the comments for the
   [`google.protobuf.SourceCodeInfo`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L766)
   message. But more details can be found below in the _[Source Code Info](#source-code-info)_
   section, especially for aspects that are not well specified in those comments.

8. **Code Generation:**
   The final, optional step in a compilation process is to use the descriptors created in
   the above steps to generate code for a target language and runtime. This involves the
   invocation of compiler plugins. You can read more details about this process
   [here](https://docs.buf.build/reference/images#plugins)
   and [here](https://developers.google.com/protocol-buffers/docs/reference/other).


## Resolving Import Locations

The process of resolving import locations is not part of the language, but
is left to the parser/compiler. A typical approach, including the one used by
the `protoc` compiler, is to allow the user to provide search paths as
command-line flags. The import path is appended to each search path until
the named file is found. If an import file cannot be located, the source file
cannot be compiled.

The `buf` command-line tool (also called the "Buf CLI") provides a more
streamlined experience for providing search paths: users define a
[`buf.yaml`](https://docs.buf.build/configuration/v1/buf-yaml) configuration
file in their project (or "module" in Buf parlance). This file indicates the
root directory where the Protobuf sources reside. It can also indicate
[dependencies](https://docs.buf.build/configuration/v1/buf-yaml#deps): other
Buf modules that the current module uses. Source files can import local files
in the module, using a path relative to the module root (where `buf.yaml` resides).
And they can also import remote files that are located inside those other Buf modules,
using a path relative to the root of that remote module.

Some tools may not even care to resolve and load imports. For example, formatters
will usually operate one file at a time, without needing to
resolve symbol references or understand the relationships between files.

### Standard Imports

There are a handful of source files that are generally included as part of a Protobuf compiler.
These standard imports define the [well-known types](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf)
as well as the descriptor model (see next section).

The Protobuf distribution includes all the following files, as does the Buf CLI:

* [`google/protobuf/any.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/any.proto): Defines the `google.protobuf.Any` type.
* [`google/protobuf/api.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/api.proto): Defines types for describing RPC services, such as
  `google.protobuf.Api`. This is an alternate representation to the descriptor model.
* [`google/protobuf/compiler/plugin.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/compiler/plugin.proto): Defines types used to implement compiler plugins.
* [`google/protobuf/descriptor.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto): Defines the descriptor model, used for runtime
  reflection and by compiler plugins.
* [`google/protobuf/duration.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/duration.proto): Defines the `google.protobuf.Duration` type.
* [`google/protobuf/empty.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/empty.proto): Defines the `google.protobuf.Empty` type.
* [`google/protobuf/field_mask.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/field_mask.proto): Defines the `google.protobuf.FieldMask` type.
* [`google/protobuf/source_context.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/source_context.proto): Defines the `google.protobuf.SourceContext` type,
  which is used by both `google.protobuf.Api` and `google.protobuf.Type`.
* [`google/protobuf/struct.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/struct.proto): Defines the types used to model arbitrary JSON data as
  a Protocol Buffer, such as `google.protobuf.Value` and `google.protobuf.Struct`.
* [`google/protobuf/timestamp.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/timestamp.proto): Defines the `google.protobuf.Timestamp` type.
* [`google/protobuf/type.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/type.proto): Defines types for describing messages and enums, such as
  `google.protobuf.Type`. This is an alternate representation to the descriptor model.
* [`google/protobuf/wrappers.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/wrappers.proto): Defines message types which are wrappers around the
  various scalar types, such as `google.protobuf.Int64Value` and `google.protobuf.StringValue`.

These files can be imported without having to tell the compiler where to find them. For
example, with `protoc` these files can be imported even if they do not appear under any
of the search locations. When using the Buf CLI, these files can be imported without having
to declare any dependency and without needing copies of these files in your module.

#### Overriding Descriptor Protos

The descriptor model (in `google/protobuf/descriptor.proto`) is a special standard import
because not only can it be imported and referenced in user sources (like for defining
custom options), but it is also _linked_ into the compiler itself. That means that the
compiler includes a _snapshot_ of the descriptor protos that have been compiled into the
compiler's implementation language. So `protoc` links in generated C++ code for this
snapshot of the descriptors; the Buf CLI links in generated Go code.

Compilers may support _overriding_ the contents of this file. In other words, it would
be possible for the user to supply their own version of `google/protobuf/descriptor.proto`,
like to add new fields to descriptors or to options messages. Or the user might supply
a file that contains an alternate definition for one of the types, such as a
`google.protobuf.FieldOptions`.

The compilation proceeds as normal; but when interpreting options, if an options
message is overridden, that override definition is used when resolving option names
and type checking option values. (This is usually accomplished using a _dynamic message_
backed by a descriptor that is built from the override definition.) If a compiler
supports this, any fields that are present in the override definition but that are _not
present_ in the linked in snapshot are considered unknown fields. When the descriptor
is serialized, unknown fields may be encoded differently than known fields. (See
_[Encoding Options](#encoding-options)_ for more details.)

:::caution

Forking the descriptor sources this way is heavily discouraged. It is generally only
done by a user that uses a fork of the entire protobuf runtime and/or the compiler, too.

:::


## Descriptor Production

The sections below also describe aspects of descriptor production. All types referenced below
are in the `google.protobuf` package (so a reference to `DescriptorProto` is shorthand for the
`google.protobuf.DescriptorProto` message type).

They are all defined in the [`google/protobuf/descriptor.proto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto)
file that is included in the Protobuf distribution. This file contains comments as to how
the elements of the grammar map to various fields and structures in the descriptor. And for
many attributes of the descriptor, the way they correspond to elements in the grammar is
self-explanatory. The `descriptor.proto` file uses the proto2 syntax, which means that it
is possible to detect when a field is absent. So if an optional element in the grammar is
absent, the corresponding field in a descriptor will also be absent.

The content below refers to elements of the grammar using italics. For example, _EmptyDecl_
refers to the production of the same name found in the [description of the language syntax](./language-spec.md#declaration-types).

The examples below show both proto source code alongside the resulting descriptor protos.
The example descriptor protos are shown in [JSON form](https://developers.google.com/protocol-buffers/docs/proto3#json),
for readability.

### Type References

Type references are found in various fields in descriptors, all mapping to a
_TypeName_ production in the grammar. The value stored in the descriptors may initially
be a relative reference, as that may be what appears in the source file. But a properly
compiled file descriptor will undergo a link step, wherein all relative references are
resolved.

At the end of this process, all relative references in a descriptor should
be replaced with fully-qualified references, which include a leading dot (`.`).

### Descriptor Kinds

Each kind of named element in the language, other than packages, have a
corresponding kind of descriptor. Source files also have a kind of
descriptor that describes them.

Each kind of descriptor is represented by a proto message in `descriptor.proto`:

| Named element kind | Descriptor proto                                                                                                               |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------|
| File \*            | [`FileDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L62)       |
| Message            | [`DescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L94)           |
| Field, Extension   | [`FieldDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L138)     |
| Oneof              | [`OneofDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L241)     |
| Enum               | [`EnumDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L247)      |
| Enum Value         | [`EnumValueDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L276) |
| Service            | [`ServiceDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L284)   |
| Method             | [`MethodDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L292)    |

__*__ Despite the column heading, file is not a kind of named element. The file descriptor
resembles an AST for the file, modeling all the declarations therein. Each named
element declared in the file is represented by the other types of descriptor protos
and accessible via fields on the `FileDescriptorProto`.

### Options

When constructing a descriptor, each descriptor type has a field named `options`
(as does the `DescriptorProto.ExtensionRange` type). If any options are defined
for an element, this field will be present. The table below indicates the
concrete type of this field.

| Enclosing element                | Options type                                                                                                                |
|----------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| `FileDescriptorProto`            | [`FileOptions`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L341)           |
| `DescriptorProto`                | [`MessageOptions`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L466)        |
| `FieldDescriptorProto`           | [`FieldOptions`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L534)          |
| `OneofDescriptorProto`           | [`OneofOptions`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L638)          |
| `DescriptorProto.ExtensionRange` | [`ExtensionRangeOptions`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L128) |
| `EnumDescriptorProto`            | [`EnumOptions`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L646)           |
| `EnumValueDescriptorProto`       | [`EnumValueOptions`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L667)      |
| `ServiceDescriptorProto`         | [`ServiceOptions`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L681)        |
| `MethodDescriptorProto`          | [`MethodOptions`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L701)         |

Each of these concrete option types has a field named `uninterpreted_options` (with
field number 999). The compiler may use this field to store the options when they are
initially parsed. Later, when options are interpreted, this field will be cleared and
the interpreted options will be stored in other fields of the option type.

The structure of this field, whose type is [`UninterpretedOption`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L739),
closely mirrors the [_OptionDecl_](./language-spec.md#options) production. It has numerous fields for storing the
[value](./language-spec.md#option-values), only one of which can be set (though the definition in `descriptor.proto`
does not use a `oneof`):

| Production                     | Condition                                                | Field                |
|--------------------------------|----------------------------------------------------------|----------------------|
| _StringLiteral_                |                                                          | `string_value`       |
| _UnsignedNumLiteral_           | `int_literal` in the range [0, 2^64)                     | `positive_int_value` |
|                                | otherwise                                                | `double_value`       |
| _SignedNumLiteral_             | `int_literal` in the range [0, 2^64) preceded by `plus`  | `positive_int_value` |
|                                | `int_literal` in the range [0, 2^63] preceded by `minus` | `negative_int_value` |
|                                | otherwise                                                | `double_value`       |
| _identifier_                   |                                                          | `identifier_value`   |
| _MessageLiteralWithBraces_  \* |                                                          | `aggregate_value`    |

__*__ For message literals, the entire source text, excluding the enclosing braces
(`{` and `}`), is stored as a string. But all whitespace and comments are removed
and each token is separated by a single space (` `).

The following shows an example of how the `uninterpreted_option` can be populated
from a given source file. It also shows what the descriptor might look like after
interpreting options.
```protobuf title="example.proto"
import "foo/bar/options.proto"
option java_package = "foo.bar.baz";
option (foo.bar.baz).settings.(foo.bar.buzz).add = 256;
```
```json title="File descriptor before interpreting options"
{
    "name": "example.proto",
    "dependency": [
        "foo/bar/options.proto"
    ],
    "options": {
        "uninterpreted_option": [
            {
                "name": [
                    {
                        "name_part": "java_package"
                    }
                ],
                "string_value": "foo.bar.baz"
            },
            {
                "name": [
                    {
                        "name_part": "foo.bar.baz",
                        "is_extension": true,
                    },
                    {
                        "name_part": "settings",
                    },
                    {
                        "name_part": "foo.bar.buzz",
                        "is_extension": true,
                    },
                    {
                        "name_part": "add",
                    }
                ],
                "positive_int_val": "256"
            },
        ]
    }
}
```
```json title="File descriptor after interpreting options"
{
    "name": "example.proto",
    "dependency": [
        "foo/bar/options.proto"
    ],
    "options": {
        "java_package": "foo.bar.baz",
        "[foo.bar.baz]": {
            "settings": {
                "[foo.bar.buzz]": {
                    "add": 256
                }
            }
        }
    }
}
```

#### Encoding Options

One interesting implementation detail of `protoc` is the way it stores unknown
options in the resulting descriptor, in a manner that preserves the order of
options and their de-structuring. When serializing an options message, regular
known options are emitted first, in field number order. But unknown options (which
includes all custom options/extensions), each single option declaration is encoded
to bytes as if it were by itself. The resulting binary form relies heavily on the
fact that the binary encoding will merge data. So the bytes for each custom option
are unmarshalled, such that the bytes from a later option get merged into the
results from unmarshalling earlier ones. The result is that the two examples below
are encoded to bytes very differently, but the resulting options messages after
unmarshalling either are semantically equivalent.

```protobuf title="destructured.proto"
// This example de-structures the option across multiple declarations:
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
```protobuf title="single-option.proto"
// This example does not de-structure and instead includes the entire
// option value as a message literal. It is semantically identical to
// the above example.
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

To demonstrate this encoding, let's look at the _raw_ descriptor output for the
de-structured example above. The content below is the result of using
`protoc --decode_raw`, along with comments to annotate how this content
corresponds to the example above.
```protobuf title="de-structured method options"
4 {                           // MethodDescriptorProto, field `options`
  72295728 {                  //    MethodOptions, extension `google.api.http`
    8 {                       //        HttpRule, field `custom`
      1: "FETCH"              //            CustomHttpPattern, field `kind`
    }                         //
  }                           //
  72295728 {                  //    MethodOptions, extension `google.api.http`
    8 {                       //        HttpRule, field `custom`
      2: "/foo/bar/baz/{id}"  //            CustomHttpPattern, field `path`
    }                         //
  }                           //
  72295728 {                  //    MethodOptions, extension `google.api.http`
    11 {                      //        HttpRule, field `additional_bindings`
      2: "/foo/bar/baz/{id}"  //            HttpRule, field `get`
    }                         //
  }                           //
  72295728 {                  //    MethodOptions, extension `google.api.http`
    11 {                      //        HttpRule, field `additional_bindings`
      4: "/foo/bar/baz/"      //            HttpRule, field `post`
      7: "*"                  //            HttpRule, field `body`
    }                         //
  }                           //
}                             //
```
For contrast, below is the raw descriptor output for the latter example, that uses
a single option declaration instead of de-structuring:
```protobuf title="single method option"
4 {
  72295728 {
    8 {
      1: "FETCH"
      2: "/foo/bar/baz/{id}"
    }
    11 {
      2: "/foo/bar/baz/{id}"
    }
    11 {
      4: "/foo/bar/baz/"
      7: "*"
    }
  }
}
```

### File Descriptors

The [_File_](./language-spec.md#source-file-organization) production in the grammar
corresponds to a [`FileDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L62).

The [`name`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L63)
field is the only piece of data in a descriptor that does not come from the file contents.
Instead, it is defined by the parser, and it should be set to the path from which the file
contents are loaded. This field must not be an absolute path; it must be relative. (Also see
_[Resolving Import Locations](#resolving-import-locations)_.)

If a [_SyntaxDecl_](./language-spec.md#file-syntax-level) production is present and indicates
a value of "proto2", the resulting [`syntax`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L90)
field of the file descriptor will be left absent: "proto2" is the considered the default
value when the field is not present. A compiler may choose to issue a warning for files
that have no syntax declaration.

The [`package`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L64)
field is only present if the file includes a [_PackageDecl_](./language-spec.md#package-declaration)
production.

Import statements in the file, across all [_ImportDecl_](./language-spec.md#imports) productions, populate three
different fields:
* [`dependency`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L67):
  This field contains _all_ of the imported file names, in the order in
  which they appear in the source file.
* [`public_dependency`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L69):
  This field is a list of integer indexes. Each index refers to an element
  in the `dependency` field that used the `public` keyword.
* [`weak_dependency`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L72):
  This field is a list of integer indexes. Each index refers to an element
  in the `dependency` field that used the `weak` keyword.

The various named elements defined in [_FileElement_](./language-spec.md#source-file-organization)
productions correspond to a repeated field:

| Production      | Corresponding field of `FileDescriptorProto`                                                                      |
|-----------------|-------------------------------------------------------------------------------------------------------------------|
| _MessageDecl_   | [`message_type`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L75) |
| _EnumDecl_      | [`enum_type`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L76)    |
| _ExtensionDecl_ | [`extension`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L78)    |
| _ServiceDecl_   | [`service`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L77)      |

These lists have the elements in the order in which they appeared in the file.
So the first element of `message_type` is the first message declared in the file.

The [`source_code_info`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L86)
field can be populated via a post-process (after options are interpreted). See
_[Source Code Info](#source-code-info)_ for more details.

```protobuf title="example.proto"
syntax = "proto3";

package foo.bar;

import "another/file.proto";

message Foo {
    some.OtherMessage message = 1;
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "syntax": "proto3",
    "package": "foo.bar",
    "dependency": [
        "another/file.proto"
    ],
    "message_type": [
        {
            "name": "Foo",
            "field": [
                {
                    "name": "message",
                    "number": 1,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_MESSAGE",
                    "type_name": ".some.OtherMessage",
                    "json_name": "message"
                }
            ]
        }
    ]
}
```

### Message Descriptors

The [_MessageDecl_](./language-spec.md#messages) production corresponds to a [`DescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L94).

Like in a file descriptor, the various named elements defined in [_MessageElement_](./language-spec.md#messages)
productions correspond to a repeated field:

| Production        | Corresponding field of `DescriptorProto`                                                                                                                                                                                      |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| _FieldDecl_       | [`field`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L97)                                                                                                                    |
| _MapFieldDecl_ \* | [`field`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L97), [`nested_type`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L100) |
| _GroupDecl_  \*   | [`field`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L97), [`nested_type`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L100) |
| _OneofDecl_       | [`oneof_decl`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L111)                                                                                                              |
| _MessageDecl_     | [`nested_type`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L100)                                                                                                             |
| _EnumDecl_        | [`enum_type`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L101)                                                                                                               |
| _ExtensionDecl_   | [`extension`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L98)                                                                                                                |

__*__ Both _MapFieldDecl_ and _GroupDecl_ result in both a `FieldDescriptorProto` stored in
`field` and a `DescriptorProto` stored in `nested_type`. See [_Map Fields_](#map-fields)
and [_Groups_](#groups) for more details.

In addition to these elements, fields and groups defined inside of any oneofs are also
stored in the `DescriptorProto`'s set of fields and nested messages. See [_Oneof Descriptors_](#oneof-descriptors)
for more details.

```protobuf title="example.proto"
message Foo {
    option deprecated = true;

    optional string name = 1;
    optional uint64 id = 2;
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "message_type": [
        {
            "name": "Foo",
            "options": {
                "deprecated": true
            },
            "field": [
                {
                    "name": "name",
                    "number": 1,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_STRING",
                    "json_name": "name"
                },
                {
                    "name": "id",
                    "number": 2,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_UINT64"
                    "json_name": "id"
                }
            ]
        }
    ]
}
```

#### Extension Ranges

Within an [_ExtensionRangeDecl_](./language-spec.md#extension-ranges) production, all
_TagRange_ elements are accumulated into a list of [`DescriptorProto.ExtensionRange`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L103)
values and stored in the message's [`extension_range`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L109)
field.

In a `DescriptorProto.ExtensionRange`, the range end is "open", or exclusive. But the
end tag in the source file is _inclusive_. So the logic must _add one_ to the number in
the source file and then store that in the [`end`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L105)
field.

In a _TagRange_ production, if no end was specified (e.g. just a single number, not actually
a range) then the `DescriptorProto.ExtensionRange` is stored as a range where the start
and end are equal to the specified number. Since the range end is exclusive in the proto,
that means the range is stored as "number" for the start and "number+1" for the end.

The options, if any, apply to _all_ ranges in the declaration. An `ExtensionRangeOptions`
value is constructed from the options and then is copied to each `DescriptorProto.ExtensionRange`
that was constructed from the _ExtensionRangeDecl_ production.

```protobuf title="example.proto"
syntax = "proto2";

import "foo/bar/extension_range_options.proto";

message Foo {
    // highlight-start
    extensions 42, 100 to 200, 1000 to max [(foo.bar.ext) = true];
    // highlight-end
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "dependency": [
        "foo/bar/extension_range_options.proto"
    ],
    "message_type": [
        {
            "name": "Foo",
            // highlight-start
            "extension_range": [
                {
                    "start": 42,
                    "end": 43,
                    "options": {
                        "[foo.bar.ext]": true
                    }
                },
                {
                    "start": 100,
                    "end": 201,
                    "options": {
                        "[foo.bar.ext]": true
                    }
                },
                {
                    "start": 1000,
                    "end": 536870912,
                    "options": {
                        "[foo.bar.ext]": true
                    }
                }
            ]
            // highlight-end
        }
    ]
}
```

#### Reserved Ranges and Names

Within a [_MessageReservedDecl_](./language-spec.md#reserved-names-and-numbers) production,
all _TagRange_ elements are accumulated into a list of [`DescriptorProto.ReservedRange`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L118)
values and stored in the message's [`reserved_range`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L122)
field. All _Names_ are accumulated into a list of strings and stored in the message's
[`reserved_name`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L125)
field.

As with extension ranges, in a `DescriptorProto.ReservedRange`, the range end is exclusive,
but the end tag in the source file is inclusive. So the logic must _add one_ to the number in
the source file and then store that in the [`end`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L125)
field.

Also like extension ranges, if the _TagRange_ production did not include an end number, it
acts as if the start and end are the same as the single number specified. Since the range end
is exclusive in `DescriptorProto.ReservedRange`, that means the range is stored as "number"
for the start and "number+1" for the end.

```protobuf title="example.proto"
syntax = "proto2";

message Foo {
    // highlight-start
    reserved 1, 2, 5-8;
    reserved "foo", "bar", "baz";
    // highlight-end
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "message_type": [
        {
            "name": "Foo",
            // highlight-start
            "reserved_range": [
                {
                    "start": 1,
                    "end": 2,
                },
                {
                    "start": 2,
                    "end": 3,
                },
                {
                    "start": 5,
                    "end": 9,
                }
            ],
            "reserved_name": [
                "foo",
                "bar",
                "baz"
            ]
            // highlight-end
        }
    ]
}
```

### Field Descriptors

The [_FieldDecl_](./language-spec.md#fields) and [_OneofFieldDecl_](./language-spec.md#oneofs)
productions correspond to a [`FieldDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L138).
Additionally, [map fields](#map-fields) and [groups](#groups) also correspond to this type.

Both normal and extension fields use this type. For extensions (fields and groups
in an [_ExtensionDecl_](./language-spec.md#extensions) production), their [`extendee`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L196)
field is set to the name of the message indicated by the _TypeName_ part of the
enclosing _ExtensionDecl_. For normal field declarations, the `extendee` field is
absent.

The [`label`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L181)
field will always be present, even if the cardinality is omitted in the source file
When absent in source, the value is `LABEL_OPTIONAL`. (So this default will be set for
all _OneofFieldDecl_ productions, which never have an explicit cardinality in source.)

If the cardinality is not omitted in source and is `optional`, and the file containing
the field uses the proto3 syntax, the [`proto3_optional`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L237)
field will also be set. See [_Field Presence_](#field-presence) for more details on
representing proto3 optional fields in the descriptor.

If this field is enclosed in a `oneof` then the [`oneof_index`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L211)
field will be present. See [_Oneof Descriptors_](#oneof-descriptors) for more details on
representing oneofs.

There are two fields, [`default_value`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L207)
and [`json_name`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L217),
that are actually populated by options present in the field declaration. The spec refers
to these as ["pseudo-options"](./language-spec.md#pseudo-options) because they aren't
aren't actually fields on the `FieldOptions` proto. The pseudo-option `default` will
populate the `default_value` field on the descriptor. The pseudo-option `json_name`
populates the descriptor's field of the same name.

If a `json_name` pseudo-option is _not_ present on a normal field, the `json_name` field
of the descriptor will be set to the field's [default JSON name](./language-spec.md#default-json-names).
Extensions will not have a `json_name` value set.

```protobuf title="example.proto"
syntax = "proto2";

package foo.bar;

message Foo {
    // highlight-start
    optional string foo = 1 [json_name="FOO"];
    repeated int32 bar = 2;
    optional float baz = 3 [deprecated = true, default=3.14159];
    // highlight-end
    extensions 100 to 200;
}

// highlight-start
extend Foo {
    optional bytes buzz = 101;
}
// highlight-end
```
```json title="File descriptor"
{
    "name": "example.proto",
    "package": "foo.bar",
    "message_type": [
        {
            "name": "Foo",
            // highlight-start
            "field": [
                {
                    "name": "foo",
                    "number": 1,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_STRING",
                    "json_name": "FOO"
                },
                {
                    "name": "bar",
                    "number": 2,
                    "label": "LABEL_REPEATED",
                    "type": "TYPE_INT32",
                    "json_name": "bar"
                },
                {
                    "name": "baz",
                    "number": 3,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_FLOAT",
                    "options": {
                        "deprecated": true
                    },
                    "default_value": "3.14159",
                    "json_name": "baz"
                }
            ],
            // highlight-end
            "extension_range": [
                {
                    "start": 100,
                    "end": 201
                }
            ]
        }
    ],
    // highlight-start
    "extension": [
        {
            "name": "buzz",
            "number": 101,
            "label": "OPTIONAL_LABEL",
            "type": "TYPE_BYTES",
            "extendee": ".foo.bar.Foo"
        }
    ]
    // highlight-end
}
```

#### Encoding Default Values

As mentioned above, the [`default_value`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L207)
field on the `FieldDescriptorProto` is populated via a pseudo-option named `default`
(proto2 syntax only).

This `default_value` field's type is string. But the actual type of the value in source
depends on the type of the field on which the option is defined. So these values of
various types must be converted/encoded to a string. Only scalar, non-repeated fields
can have a default specified. Values are encoded as follows:

| Type                         | Encoding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Integer numeric types        | String representation in base 10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Floating-point numeric types | Minimal string representation to uniquely identify the value in base 10, using lower-case `e` for exponent if scientific notation is shorter.                                                                                                                                                                                                                                                                                                                                                           |
| `bool`                       | The string `true` or `false`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `string`                     | The value, unmodified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `bytes`                      | The value interpreted as if a UTF-8-encoded string, with certain bytes replaced with escape sequences. Quotes (both single `'` and double `"`) and backslashes (`\`) are escaped by prefixing with a backslash. Newlines (0x0A), carriage returns (0x0D), and tabs (0x09) use common escape sequences `\n`, `\r`, and `\t` respectively. All other characters outside the range [0x20, 0x7F) are replaced with a three-digit octal escape. For example, a DEL (0x7F) character is replaced with `\177`. |
| An enum type                 | The simple (unqualified) name of the enum value.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

#### Field Types

The [`type`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L190)
and [`type_name`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L197)
fields of `FieldDescriptorProto` are both set based on the _TypeName_ that is set in the
[_FieldDecl_](./language-spec.md#fields) production.

The `type` field indicates the kind. Each predefined scalar type has a corresponding entry
in the [`FieldDescriptorProto.Type`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L144)
enum. If the type name refers to an enum, the `type` is set to `TYPE_ENUM`. If the type
name refers to a message, the `type` is set to `TYPE_MESSAGE`.

The `type_name` field is only set when the type name references a message or enum
type. In these cases, it indicates the fully-qualified name (with leading dot `.`) of
the referenced type.

```protobuf title="example.proto"
syntax = "proto3";

import "google/protobuf/any.proto";
import "google/protobuf/wrappers.proto";

message Foo {
    // highlight-start
    google.protobuf.StringValue maybe_name = 1;
    repeated google.protobuf.Any extras = 2;
    bool is_new = 3;
    // highlight-end
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "syntax": "proto3",
    "dependency": [
        "google/protobuf/any.proto",
        "google/protobuf/wrappers.proto"
    ],
    "message_type": [
        {
            "name": "Foo",
            "field": [
                {
                    "name": "maybe_name",
                    "number": 1,
                    "label": "LABEL_OPTIONAL",
                    // highlight-start
                    "type": "TYPE_MESSAGE",
                    "type_name": ".google.protobuf.StringValue",
                    // highlight-end
                    "json_name": "maybeName"
                },
                {
                    "name": "extras",
                    "number": 2,
                    "label": "LABEL_REPEATED",
                    // highlight-start
                    "type": "TYPE_MESSAGE",
                    "type_name": ".google.protobuf.Any",
                    // highlight-end
                    "json_name": "extras"
                },
                {
                    "name": "is_new",
                    "number": 3,
                    "label": "LABEL_OPTIONAL",
                    // highlight-start
                    "type": "TYPE_BOOL",
                    // highlight-end
                    "json_name": "isNew"
                }
            ]
        }
    ]
}
```

#### Field Presence

:::info

The content below applies _only_ to files that use proto3 syntax.

:::

When a proto3 field explicitly indicates `optional`, the [`proto3_optional`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L237)
field will be set to true. Furthermore, a `OneofDescriptor` will be _synthesized_ that
contains only the one optional field. That means that both of these messages are _functionally_
the same:
```protobuf
// Explicit optional keyword:
message Foo {
    optional string bar = 1;
}

// Behaves as if:
message Foo {
    oneof _bar {
      string bar = 1;
    }
}
```

The name of the synthetic oneof is computed using the logic below.
* _candidate name_ = field's name
* If the _candidate name_ does not already start with an underscore (`_`), add it as a prefix:
  _candidate name_ = "\_" + _candidate name_
* While _candidate name_ conflicts with another element in the message:
   * Prefix the name with an `X`:
     _candidate name_ = "X" + _candidate name_

At the end of this logic, _candidate name_ is a distinct element name that won't conflict
with anything the user defined in the message. This is the name used for the synthetic
oneof.

The other elements that could conflict with the synthetic oneof's name are:
* Other fields in the message, including fields in other oneofs
* Other oneofs in the message, including synthetic oneofs already created
* Other messages defined inside the message
* Extensions defined inside the message
* Enums defined inside the message

```protobuf title="example.proto"
syntax = "proto3";

message Foo {
    // highlight-start
    optional string bar = 1;
    optional double baz = 2;
    // highlight-end
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "syntax": "proto3",
    "message_type": [
        {
            "name": "Foo",
            "field": [
                {
                    "name": "bar",
                    "number": 1,
                    "type": "TYPE_STRING",
                    "json_name": "bar",
                    // highlight-start
                    "label": "LABEL_OPTIONAL",
                    "proto3_optional": true,
                    "oneof_index": 0,
                    // highlight-end
            },
                {
                    "name": "baz",
                    "number": 2,
                    "type": "TYPE_DOUBLE",
                    "json_name": "baz"
                    // highlight-start
                    "label": "LABEL_OPTIONAL",
                    "proto3_optional": true,
                    "oneof_index": 1,
                    // highlight-end
            }
            ],
            "oneof_decl": [
                // highlight-start
                {
                    "name": "_bar",
                },
                {
                    "name": "_baz",
                }
                // highlight-end
            ]
        }
    ]
}
```

#### Map Fields

The [_MapFieldDecl_](./language-spec.md#maps) production results in both a
[`FieldDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L138)
_and_ a [`DescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L94).

The spec describes how map fields behave as if they were defined as a repeated
field whose type is a map entry message. The message has two fields: a key and a value. 
The spec includes an example that demonstrates exactly how the field is represented in
the descriptor: as a repeated field and a nested message. Here's that example again:
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

The synthetic message is stored in the enclosing message's `nested_type` list in the
order that the field appears in source. In other words, if there are nested messages
declared before the map field, they will be in the `nested_type` list before the
synthetic map entry message. If there are nested messages declared after the map
field, they appear in the `nested_type` list after the synthetic message.

```protobuf title="example.proto"
syntax = "proto3";

message Foo {
    string name = 1;
    // highlight-start
    map<uint32, Foo> children_by_id = 2;
    // highlight-end
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "syntax": "proto3",
    "message_type": [
        {
            "name": "Foo",
            "field": [
                {
                    "name": "name",
                    "number": 1,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_STRING",
                    "json_name": "name"
                },
                // highlight-start
                {
                    "name": "children_by_id",
                    "number": 2,
                    "label": "LABEL_REPEATED",
                    "type": "TYPE_MESSAGE",
                    "type_name": ".Foo.ChildrenByIdEntry",
                    "json_name": "childrenById"
                }
                // highlight-end
            ],
            "nested_type": [
                // highlight-start
                {
                    "name": "ChildrenByIdEntry",
                    "field": [
                        {
                            "name": "key",
                            "number": 1,
                            "label": "LABEL_OPTIONAL",
                            "type": "TYPE_UINT32",
                            "json_name": "key"
                        },
                        {
                            "name": "value",
                            "number": 2,
                            "label": "LABEL_OPTIONAL",
                            "type": "TYPE_MESSAGE",
                            "type_name": ".Foo",
                            "json_name": "value"
                        }
                    ],
                    "options": {
                        "map_entry": true
                    }
                }
                // highlight-end
            ]
        }
    ]
}
```

#### Groups

The [_GroupDecl_](./language-spec.md#groups) and [_OneofGroupDecl_](./language-spec.md#oneofs)
productions result in both a [`FieldDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L138)
_and_ a [`DescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L94).

The spec describes how groups behave as if they were defined as both a field and a
nested message. The spec includes an example that demonstrates exactly how the group
is represented in the descriptor: as both a field and a nested message. However, there
is one small exception: when the `group` keyword is used, the `type` of the field will
be `TYPE_GROUP` (not `TYPE_MESSAGE`). Here's that example again:
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
The associated message is stored in the enclosing message's `nested_type` list in the
order that the group appears in source. In other words, if there are nested messages
declared before the group, they will be in the `nested_type` list before the group's
associated message. If there are nested messages declared after the group, they appear
in the `nested_type` list after the group's associated message. The same goes
regarding the order of the associated field in the enclosing message's `field` list.

```protobuf title="example.proto"
syntax = "proto2";

message Foo {
    // highlight-start
    optional group Bar = 1 {
        optional uint32 id = 1;
        optional string name = 2;
    }
    // highlight-end
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "message_type": [
        {
            "name": "Foo",
            "field": [
                // highlight-start
                {
                    "name": "bar",
                    "number": 1,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_GROUP",
                    "type_name": ".Foo.Bar",
                    "json_name": "bar"
                }
                // highlight-end
            ],
            "nested_type": [
                // highlight-start
                {
                    "name": "Bar",
                    "field": [
                        {
                            "name": "id",
                            "number": 1,
                            "label": "LABEL_OPTIONAL",
                            "type": "TYPE_UINT32",
                            "json_name": "id"
                        },
                        {
                            "name": "name",
                            "number": 2,
                            "label": "LABEL_OPTIONAL",
                            "type": "TYPE_STRING",
                            "json_name": "name"
                        }
                    ]
                }
                // highlight-end
            ]
        }
    ]
}
```

### Oneof Descriptors

The [_OneofDecl_](./language-spec.md#oneofs) production corresponds to a [`OneofDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L241).

The child elements, in _OneofFieldDecl_ and _OneofGroupDecl_ productions, are actually stored
in the descriptor of the enclosing [message](#message-descriptors):

| Production           | Corresponding field of `DescriptorProto`                                                                                                                                                                                      |
|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| _OneofFieldDecl_     | [`field`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L97)                                                                                                                    |
| _OneofGroupDecl_  \* | [`field`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L97), [`nested_type`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L100) |

__*__ _OneofGroupDecl_ results in both a `FieldDescriptorProto` stored in
`field` and a `DescriptorProto`, stored in `nested_type`. See [_Groups_](#groups) for
more details.

The `OneofDescriptor` is mostly just a placeholder with a name. Its index in the
enclosing message's [`oneof_decl`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L116)
field. The relationship between the oneof and the fields declared inside it is the
[`oneof_index`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L211)
field of the enclosing `DescriptorProto`. This index, if present, indicates the
index into the `oneof_decl` list for the field's enclosing `OneofDescriptorProto`.
If the index is not present, the field was defined inside a oneof.

The elements in the `oneof_decl` list are in the order they are declared in source.
So the first oneof in a message will be the element at index zero of the list. All
the fields therein will indicate zero in their `oneof_index` field.

For more details about how the descriptors for enclosed fields are created, see
_[Field Descriptors](#field-descriptors)_.

```protobuf title="example.proto"
syntax = "proto2";

message Foo {
    // highlight-start
    oneof id {
        string email = 1;
        uint64 uid = 2;
        int64 ssn = 3;
        group FullName = 4 {
          optional string first_name = 1;
          optional string middle_initial = 2;
          optional string last_name = 3;
        }
        string phone = 5;
    }
    // highlight-end
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "message_type": [
        {
            "name": "Foo",
            "field": [
                // highlight-start
                {
                    "name": "email",
                    "number": 1,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_STRING",
                    "json_name": "email",
                    "oneof_index": 0
                },
                {
                    "name": "uid",
                    "number": 2,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_UINT64",
                    "json_name": "uid",
                    "oneof_index": 0
                },
                {
                    "name": "ssn",
                    "number": 3,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_INT64",
                    "json_name": "ssn",
                    "oneof_index": 0
                },
                {
                    "name": "fullname",
                    "number": 4,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_GROUP",
                    "type_name": ".Foo.FullName",
                    "json_name": "fullname",
                    "oneof_index": 0
                }
                {
                    "name": "phone",
                    "number": 5,
                    "label": "LABEL_OPTIONAL",
                    "type": "TYPE_STRING",
                    "json_name": "phone",
                    "oneof_index": 0
                },
                // highlight-end
            ],
            "nested_type": [
                // highlight-start
                {
                    "name": "FullName",
                    "field": [
                        {
                            "name": "first_name",
                            "number": 1,
                            "label": "LABEL_OPTIONAL",
                            "type": "TYPE_STRING",
                            "json_name": "firstName"
                        },
                        {
                            "name": "middle_initial",
                            "number": 2,
                            "label": "LABEL_OPTIONAL",
                            "type": "TYPE_STRING",
                            "json_name": "middleInitial"
                        },
                        {
                            "name": "last_name",
                            "number": 3,
                            "label": "LABEL_OPTIONAL",
                            "type": "TYPE_STRING",
                            "json_name": "lastName"
                        }
                    ]
                }
                // highlight-end
            ],
            "oneof_decl": [
                // highlight-start
                {
                    "name": "id"
                }
                // highlight-end
            ]
        }
    ]
}
```

### Enum Descriptors

The [_EnumDecl_](./language-spec.md#enums) production corresponds to an [`EnumDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L247).

The child elements, in [_EnumValueDecl_](./language-spec.md#enum-values) productions, are stored in the [`value`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L250)
field of the descriptor.

The _EnumValueDecl_ production corresponds to an [`EnumValueDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L276).

```protobuf title="example.proto"
enum Foo {
    option allow_alias = true;
    NULL = 0;
    ZED = 0 [deprecated = true];
    UNO = 1;
    DOS = 2;
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "enum_type": [
        {
            "name": "Foo",
            "options": {
                "allow_alias": true
            },
            "value": [
                {
                    "name": "NULL",
                    "number": 0
                },
                {
                    "name": "ZED",
                    "number": 0,
                    "options": {
                        "deprecated": true
                    }
                },
                {
                    "name": "UNO",
                    "number": 1
                },
                {
                    "name": "DOS",
                    "number": 2
                }
            ]
        }
    ]
}
```

#### Reserved Ranges and Names {#enum-reserved-ranges-and-names}

Within an [_EnumReservedDecl_](./language-spec.md#enum-reserved-names-and-numbers) production,
all _EnumValueRange_ elements are accumulated into a list of [`EnumDescriptorProto.EnumReservedRange`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L260)
values and stored in the enum's [`reserved_range`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L268)
field. All _Names_ are accumulated into a list of strings and stored in the enum's
[`reserved_name`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L272)
field.

Unlike message reserved ranges, in an `EnumDescriptorProto.EnumReservedRange`, the range
is closed, or inclusive of both start and end. So the number stored in the `start` and
`end` fields will exactly match the range numbers as they appear in source.

In an _EnumValueRange_ production, if no end was specified (e.g. just a single number,
not actually a range) then the `EnumDescriptorProto.EnumReservedRange` is stored as a
range where the start and end are equal to the specified number.

```protobuf title="example.proto"
enum Stat {
    UNKNOWN = 0;
    PENDING = 1;
    RUNNING = 2;
    FAILED = 6;
    COMPLETE = 7;

    // highlight-start
    reserved 3 to 5, 8, 100 to max;
    reserved "QUEUED", "IN_PROGRESS", "CANCELLED";
    // highlight-end
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    "enum_type": [
        {
            "name": "Stat",
            "value": [
                {
                    "name": "UNKNOWN",
                    "number": 0
                },
                {
                    "name": "PENDING",
                    "number": 1
                },
                {
                    "name": "RUNNING",
                    "number": 2
                },
                {
                    "name": "FAILED",
                    "number": 6
                },
                {
                    "name": "COMPLETE",
                    "number": 7
                }
            ],
            // highlight-start
            "reserved_range": [
                {
                    "start": 3,
                    "end": 5
                },
                {
                    "start": 8,
                    "end": 8
                },
                {
                    "start": 100,
                    "end": 2147483647
                }
            ],
            "reserved_name": [
                "QUEUED",
                "IN_PROGRESS",
                "CANCELLED"
            ]
            // highlight-end
        }
    ]
}
```

### Service Descriptors

The [_ServiceDecl_](./language-spec.md#services) production corresponds to a [`ServiceDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L284).

The child elements, in [_MethodDecl_](./language-spec.md#methods) productions, are stored in the [`method`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L286)
field of the descriptor.

The _MethodDecl_ production corresponds to a [`MethodDescriptorProto`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L292).

If the method declaration includes a body (inside of `{` and `}` braces), then the
[`options`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L305)
field will be present, _even if the body is empty and no options are actually defined_.
If the declaration does not include a body and just terminates with a semicolon (`;`)
then the `options` field will be absent.

The [`input_type`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L302)
is the fully-qualified name in the [_InputType_](./language-spec.md#methods) production,
with leading dot (`.`). If the `stream` keyword was present on the input type, then the
[`client_streaming`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L308)
field will be set to true.

Similarly, the [`output_type`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L303)
is the fully-qualified name in the [_OutputType_](./language-spec.md#methods) production,
with leading dot (`.`). If the `stream` keyword was present on the output type, then the
[`server_streaming`](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto#L310)
field will be set to true.

```protobuf title="example.proto"
package foo.bar;

import "custom/service/options.proto";

message Foo {}
message Empty {}

// highlight-start
service FooService {
    option (custom.service.foo) = "abcdefg";

    rpc Unary(Foo) returns (Empty);

    rpc ClientStream(stream Foo) returns (Empty) {
    }

    rpc ServerStream(Empty) returns (stream Foo);

    rpc BidiStream(stream Foo) returns (stream Foo) {
        option deprecated = true;
    }
}
// highlight-end
```
```json title="File descriptor"
{
    "name": "example.proto",
    "package": "foo.bar",
    "dependency": [
        "custom/service/options.proto"
    ],
    "message_type": [
        {
            "name": "Foo",
        },
        {
            "name": "Empty",
        }
    ],
    // highlight-start
    "service": [
        {
            "name": "FooService",
            "options": {
                "[custom.service.foo]": "abcdefg"
            },
            "method": [
                {
                    "name": "Unary",
                    "input_type": ".foo.bar.Foo",
                    "output_type": ".foo.bar.Empty"
                },
                {
                    "name": "ClientStream",
                    "input_type": ".foo.bar.Foo",
                    "output_type": ".foo.bar.Empty",
                    "client_streaming": true,
                    "options": {
                    }
                },
                {
                    "name": "ServerStream",
                    "input_type": ".foo.bar.Empty",
                    "output_type": ".foo.bar.Foo",
                    "server_streaming": true
                },
                {
                    "name": "ClientStream",
                    "input_type": ".foo.bar.Foo",
                    "output_type": ".foo.bar.Foo",
                    "client_streaming": true,
                    "server_streaming": true,
                    "options": {
                        "deprecated": true
                    }
                }
            ]
        }
    ]
    // highlight-end
}
```


## Source Code Info

A file descriptor can optionally include source code info, which contains details about
locations of elements in the file as well as comments. In the reference implementation,
`protoc`, one must pass a flag `--include_source_info` or else the resulting descriptors
will not include this information.

The documentation comments for the [`SourceCodeInfo`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L766)
message are reasonably thorough and clear. Before reading the content below, you should
familiarize yourself with those comments first, particularly [those for the `location`
field](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L767-L809)
of `SourceCodeInfo` and [for the `path` field](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L812-L834)
of `SourceCodeInfo.Location`.

The sections below attempt to describe nuance in computing source code info that is
missing or unclear in those source comments.

### Position Book-Keeping

When keeping track of line and column numbers for the location spans, the reference
implementation in `protoc` does the following:
* Start line and column at zero
* If the file begins with a UTF byte order mark, skip past it and ignore it.
* As each UTF-8 character in the file is read, the position of that character is at
  the current values for the line and column.
* If an invalid UTF-8 character is encountered, treat each individual byte as its
  own character (with a codepoint potentially greater than 127).
* Before proceeding to the next character, adjust the line and column values:

  | Last character         | Modification                 |
  |------------------------|------------------------------|
  | Newline (`\n`)         | `line += 1`; `column = 0`    |
  | Tab (`\t`)             | `column += 8 - (column % 8)` |
  | _Anything else_        | `column += 1`                |

As can be seen from the table above, `protoc` uses a tab-stop size of 8. All
characters other than tab or newline (including all other whitespace and control
characters) are treated as if they were normal printable characters.

### Handling Comments

#### Trailing Comments for Block Elements

The doc comments [for the `leading_comments` field](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L844-L890)
of `SourceCodeInfo.Location` describe how comments are attributed to elements
as either detached, leading, or trailing comments. But one key thing is missing,
both from the description and the examples: how trailing comments for _block_
elements are handled.

What it fails to describe is that the trailing comment for a block comment is
_not_ one that trails the closing brace (`}`), after the end of the element
declaration. Instead, it is a comment that trails the opening brace (`{`),
before any of the declarations in the element's body.
```protobuf
syntax = "proto3";

// This, as expected, is a leading comment for Foo.
message Foo {
  // This is the TRAILING comment for Foo. (It is NOT
  // a detached comment for baz.)

  // leading comment for baz
  string baz = 1;
  // trailing comment for baz
}
// This is NOT a trailing comment. It's also not considered
// a detached comment for Bar. It is discarded.

// This IS a detached comment for Bar.

// A leading comment for Bar.
message Bar {
}
```

#### Algorithm for Categorizing Comments

The [doc comments](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L844-L890)
in the proto source do have good examples to demonstrate how to categorize
comments -- whether they are trailing comments, leading comments, or detached
comments. But the text doesn't specify a process or precise rules for accomplishing
this.

So this section describes a technique that a parser can use for this. This is
a general technique that works at the level of the AST, even before a descriptor
is produced. This technique can also be used to categorize comments that are not
included in a descriptor. In particular, the doc comments state that comments in
the source are only retained for locations that "represent a complete declaration".
But this technique can also be used to categorize (and retain) comments that may
appear within a declaration.

For each AST node, we also store an array of comments. This array has the complete
text of the comment, including any enclosing `/*` and `*/` sequences or leading `//`
sequence. This array is populated during lexical analysis: when scanning for the
next token, we accumulate all [_comment_](./language-spec.md#whitespace-and-comments)
productions encountered. Instead of ignoring them, we store them as an array on
the next token (which will be a leaf node in the AST).

In addition to the list of leading comments, each AST node also has a trailing
comment. This will initially be empty.

With this shape, computing the detached, leading, and trailing comments for any
node in the tree is trivial, even if it is a non-leaf node. Detached and leading
comments are those associated with the right-most leaf descendant. Trailing
comments are those associated with the left-most leaf descendant. (For leaf
nodes, these leaf descendants are the same node as the leaf itself.) In the array
of leading comments, if the last element ends on the same line as the token or
the previous line, it is a leading comment (attached). Otherwise it is detached.
Any other comments in the array are also detached.

```protobuf
// This is a leading comment for the "option" keyword token. But it's
// also a leading comment for the entire option declaration.
option java_package = "foo.bar.baz";
// This is a trailing comment for the ";" puncutation token. But it's
// also a trailing comment for the entire option declaration.
```

The lexer maintains several pieces of state. For example, it must track its current
place in the input, since it scans for tokens from beginning to end. If computing
source code info, it must also track the current line and column (even if not
computing source code info, this is useful for good error messages, so they can
indicate the exact location in the input where an error occurred). One extra
piece of state it should track is the previous token identified. This will be
a sentinel null value until after the lexer is first invoked and the first token
is identified.

When the lexer reaches the end of the source file, it will synthesize an EOF token.
The array of comments for this token will include any trailing comments in the file,
that appear after the last lexical element. This is mainly so that the process below
can be executed for this EOF token, and potentially associate one of these trailing
comments with the previous token.

When a new token is identified, the lexer performs the following steps:
1. _Transform the array of comments into an array of groups._ A block comment is always
   in a group by itself. Adjacent line comments (those that appear sequentially, with
   no blank lines in between) get combined into a group, with newlines (`\n`)
   separating them. However, a line comment that is on the same line as the previous
   token is automatically considered in a group by itself, even if there is another
   line comment on the next line. This last point is for cases like this:
   ```protobuf
   string name = 1; // trailing comment for name
   // leading comment for id
   uint64 id = 2;
   ```
   In the above case, even though the two line comments are on adjacent lines, we
   don't want to collapse them into a single group.

   Given the rules for grouping above, let's look at a more involved example:
   ```protobuf title="example.proto" showLineNumbers
   previousToken // this comment
   // won't get merged into a
   // group with these two lines
   /* block comments */ /* are always their own groups */ // line comments
   // can usually get joined into
   // groups with adjacent lines

      // empty lines separate groups
   // indentation does not impact grouping
   /* a single block
    * comment can span lines
    */
   currentToken
   ```
   The above is represented initially as an array of comments:
   ```json title="comments array"
   [
     { "start_line": 1,  "end_line": 1,  "comment": "// this comment" },
     { "start_line": 2,  "end_line": 2,  "comment": "// won't get merged into a" },
     { "start_line": 3,  "end_line": 3,  "comment": "// group with these two lines" },
     { "start_line": 4,  "end_line": 4,  "comment": "/* block comments */" },
     { "start_line": 4,  "end_line": 4,  "comment": "/* are always their own groups */" },
     { "start_line": 4,  "end_line": 4,  "comment": "// line comments" },
     { "start_line": 5,  "end_line": 5,  "comment": "// can usually get joined into" },
     { "start_line": 6,  "end_line": 6,  "comment": "// groups with adjacent lines" },
     { "start_line": 8,  "end_line": 8,  "comment": "// empty lines separate groups" },
     { "start_line": 9,  "end_line": 9,  "comment": "// indentation does not impact grouping" },
     { "start_line": 10, "end_line": 12, "comment": "/* a single block\n * comment can span lines\n */" }
   ]
   ```
   It then gets converted into the following array of groups:
   ```json title="comment groups"
   [
     { "start_line": 1,  "end_line": 1,  "comment": "// this comment" },
     { "start_line": 2,  "end_line": 3,  "comment": "// won't get merged into a\n// group with these two lines" },
     { "start_line": 4,  "end_line": 4,  "comment": "/* block comments */" },
     { "start_line": 4,  "end_line": 4,  "comment": "/* are always their own groups */" },
     { "start_line": 4,  "end_line": 6,  "comment": "// line comments\n// can usually get joined into\n// groups with adjacent lines" },
     { "start_line": 8,  "end_line": 9,  "comment": "// empty lines separate groups\n// indentation does not impact grouping" },
     { "start_line": 10, "end_line": 12, "comment": "/* a single block\n * comment can span lines\n */" }
   ]
   ```

2. _Store the transformed array_. Overwrite the array of comments for the token
   with the newly computed array of groups.

3. _Discard comments if they cannot be attributed_. If both the previous and current
   token are on the same line, it is ambiguous to which token any comments between
   should be attributed. So they are attributed to neither and ignored.

   Similarly, if there is one comment between the tokens which starts on the same
   line as the previous token and ends on the same line as the current token, it is
   unclear to which token it should be attributed, so it is ignored.

4. _Optionally donate the first comment to the previous token_. If this is the first
   token identified by the lexer, thre is no previous token, so this step is skipped.
   The first comment in the array should be attributed as a trailing comment for the
   previous token if all the following criteria are met:

   * The first comment starts on the same line as the previous token or the line
     immediately after it. In other words, the start line of the first comment minus
     the line of the previous token is less than or equal to one.
   * Any of the following is true:
     * The comment array for the current token has more than one element.
     * The first comment starts on the same line as the previous token.
     * There is at least one empty line between the first comment and the current token.
       In other words, the line of the current token minus the end line of the first
       comment is greater than one.
     * The new token is a [punctuation or operator token](./language-spec.md#punctuation-and-operators)
       that closes a scope or grouping: one of `)`, `]`, or `}`.

   "Donating" the comment means removing it from the current token's array of
   comments and storing it as the trailing comment for the previous token.

   The last criteria above allows a leading comment for punctuation to be donated.
   An example will help illustrate why:
   ```protobuf
   message Foo {
     /* Foo is a funny name */
   }
   ```

   When the above is scanned by the lexer, it will see a single block comment as a
   leading comment on the [_r_brace_](./language-spec.md#punctuation-and-operators)
   token (`}`). We instead want to attribute the comment as a trailing comment on the
   _l_brace_ token (`{`) so it can be considered a trailing comment for the message
   `Foo`. (See [above](#trailing-comments-for-block-elements) for why.)

At the end of this process, the lexer's "previous token" can be updated to be the
current token, for use in this process when the subsequent token is found.

When source code info is later produced for the file, the comment punctuation (like
enclosing `/*` and `*/` or leading `//`) must be removed, as described in the
[doc comments](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L844-L890).

### Imports {#source-code-info-for-imports}

Source code info for imports is mostly straight-forward: the locations will include
paths that point to elements in the `FileDescriptorProto`'s `dependency` field. But
less obvious is how public and weak imports are handled.

For these kinds of imports, a location is created with a path that points to an
element in the `public_dependency` or `weak_dependency` field. The span for this
location points at the actual `public` or `weak` keyword in the import declaration.

```protobuf title="example.proto" showLineNumbers
import public "foo.proto";
import weak "google/protobuf/descriptor.proto";
```
```json title="File descriptor"
{
    "name": "example.proto",
    "dependency": ["foo.proto", "google/protobuf/descriptor.proto"],
    "source_code_info": {
        "location": [
            {
                "path": [], // entire file
                "span": [0, 0, 1, 47]
            },
            {
                "path": [
                    3,  // FileDescriptorProto, field `dependency`
                    0   //   Index (first import)
                ],
                "span": [0, 0, 26]
            },
            {
                "path": [
                    10,  // FileDescriptorProto, field `public_dependency`
                    0   //   Index (first public import)
                ],
                "span": [0, 7, 13]
            },
            {
                "path": [
                    3,  // FileDescriptorProto, field `dependency`
                    1   //   Index (second import)
                ],
                "span": [1, 0, 47]
            },
            {
                "path": [
                    11,  // FileDescriptorProto, field `weak_dependency`
                    0   //   Index (first weak import)
                ],
                "span": [1, 7, 11]
            }
        ]
    }
}
```

### Extension Blocks {#source-code-info-for-extension-blocks}

Sometimes, there will be multiple locations in the source code info that all have
the same path. One of the cases when this happens is when a scope contains multiple
blocks that define extension fields. (The other is when an element has multiple
option declarations; read more about that [below](#source-code-info-for-options).)

In this case, each block is assigned a location whose path indicates the `extension`
field of `FileDescriptorProto` or `DescriptorProto` (depending on whether the block is
top-level or inside a message, respectively). For example, all blocks of top-level
extensions have the same path: `[7]` (seven is the number for the `extension` field in
`FileDescriptorProto`).

Any comments for the block are associated with this location. If one wanted to
ascertain which individual extensions were declared inside a block, one must examine
the spans of the extensions and compare to spans of the blocks. The span for an
extension will be wholly enclosed within the span of its block.

```protobuf title="example.proto" showLineNumbers
syntax = "proto3";

import "google/protobuf/descriptor.proto";

// Here's a leading comment for FileOptions
extend google.protobuf.FileOptions {
    string file_foo = 1001;
    string file_bar = 1002;
    string file_baz = 1003;
}

extend google.protobuf.FieldOptions {
    // Here's a trailing comment for FieldOptions

    string field_ext1 = 1001;
    string field_ext2 = 1002;
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    // other content elided
    "source_code_info": {
        "location": [
            // First block:
            // highlight-start
            {
                // whole block
                "path": [
                    7       // FileDescriptorProto, field `extension`
                ],
                "span": [5, 0, 9, 1],
                "leading_comments": " Here's a leading comment for FileOptions\n"
            },
            {
                "path": [
                    7,      // FileDescriptorProto, field `extension`
                    0       //   Index (first extension in the file)
                ],
                "span": [6, 4, 27]
            },
            {
                "path": [
                    7,      // FileDescriptorProto, field `extension`
                    1       //   Index (second extension in the file)
                ],
                "span": [7, 4, 27]
            },
            {
                "path": [
                    7,      // FileDescriptorProto, field `extension`
                    2       //   Index (third extension in the file)
                ],
                "span": [8, 4, 27]
            },
            // other locations with more field details elided
            // highlight-end
            // Second block:
            // highlight-start
            {
                // whole block
                "path": [
                    7       // FileDescriptorProto, field `extension`
                ],
                "span": [11, 0, 16, 1],
                "trailing_comments": " Here's a trailing comment for FieldOptions\n"
            },
            {
                "path": [
                    7,      // FileDescriptorProto, field `extension`
                    3       //   Index (fourth extension in the file)
                ],
                "span": [14, 4, 29]
            },
            {
                "path": [
                    7,      // FileDescriptorProto, field `extension`
                    4       //   Index (fifth & final extension in the file)
                ],
                "span": [15, 4, 29]
            }
            // highlight-end
            // other locations elided
        ]
    ]
}
```

### Extension Ranges {#source-code-info-for-extension-ranges}

Another case where there will be multiple locations in the source code info that all
have the same path is when a message includes multiple [_ExtensionRangeDecl_](./language-spec.md#extension-ranges)
declarations (proto2 syntax only).

The corresponding field, [`extension_range`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L109)
is repeated. But, unlike with fields and nested messages, a single element in this
repeated field does not correspond to a single declaration in the source file. A
single declaration can indicate multiple ranges. So a path to the field, but no
particular index, will be used for locations that represent a full declaration (and
will include comments). And then additional paths will be used for the various ranges
therein.

Since the options, if any, apply to all ranges in the declaration, there will be
separate locations for each range, with paths that indicate the relevant index in the
`extension_range` field. The spans for each range will be the same, since the same
options apply to each range.

Within a single range, if the source indicated a single tag instead of start and end
tags (for example `101` instead of `101 to 200`), there will still be a location whose
path corresponds to the [`end`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L105)
field, and its span will point to this single value.

```protobuf title="example.proto" showLineNumbers
syntax = "proto2";
import "google/protobuf/descriptor.proto";
extend google.protobuf.ExtensionRangeOptions {
  optional string category = 1234;
}
message Foo {
  // highlight-start
  // this range is for options related to Kafka messages
  extensions 100 to 200, 300 to 1000, 1003 [(category) = "kafka"];
  // this range is for options related to Zookeeper data
  extensions 201 to 299 [(category) = "zookeeper"];
  // highlight-end
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    // other content elided
    "source_code_info": {
        "location": [
            // First declaration:
            // highlight-start
            {
                // whole block
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5        // DescriptorProto, field `extension_range`
                ],
                "span": [7, 2, 66],
                "leading_comments": " this range is for options related to Kafka messages\n"
            },
            {
                // first single range
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    0        //   Index
                ],
                "span": [7, 13, 23]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    0,       //   Index
                    1        // DescriptorProto.ExtensionRange, field `start`
                ],
                "span": [7, 13, 16]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    0,       //   Index
                    2        // DescriptorProto.ExtensionRange, field `end`
                ],
                "span": [7, 20, 23]
            },
            {
                // second single range
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    1        //   Index
                ],
                "span": [7, 25, 36]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    1,       //   Index
                    1        // DescriptorProto.ExtensionRange, field `start`
                ],
                "span": [7, 25, 28]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    1,       //   Index
                    2        // DescriptorProto.ExtensionRange, field `end`
                ],
                "span": [7, 32, 36]
            },
            {
                // third single range (no explicit range end)
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    2        //   Index
                ],
                "span": [7, 38, 42]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    2,       //   Index
                    1        // DescriptorProto.ExtensionRange, field `start`
                ],
                "span": [7, 38, 42]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    2,       //   Index
                    2        // DescriptorProto.ExtensionRange, field `end`
                ],
                "span": [7, 38, 42] // same span as `start`
            },
            {
                // options for the first single range
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    0,       //   Index
                    3,       // DescriptorProto.ExtensionRange, field `options`
                ],
                "span": [7, 43, 65]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    0,       //   Index
                    3,       // DescriptorProto.ExtensionRange, field `options`
                    1234,    // ExtensionRangeOptions, extension `(category)`
                ],
                "span": [7, 44, 64]
            },
            {
                // options for the second single range (identical to previous range)
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    1,       //   Index
                    3,       // DescriptorProto.ExtensionRange, field `options`
                ],
                "span": [7, 43, 65]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    1,       //   Index
                    3,       // DescriptorProto.ExtensionRange, field `options`
                    1234,    // ExtensionRangeOptions, extension `(category)`
                ],
                "span": [7, 44, 64]
            },
            {
                // options for the third single range (identical to previous ranges)
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    2,       //   Index
                    3,       // DescriptorProto.ExtensionRange, field `options`
                ],
                "span": [7, 43, 65]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    2,       //   Index
                    3,       // DescriptorProto.ExtensionRange, field `options`
                    1234,    // ExtensionRangeOptions, extension `(category)`
                ],
                "span": [7, 44, 64]
            },
            // highlight-end
            // Second declaration:
            // highlight-start
            {
                // whole block
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5        // DescriptorProto, field `extension_range`
                ],
                "span": [9, 2, 51],
                "leading_comments": " this range is for options related to Zookeeper data\n"
            },
            {
                // first single range in declaration, but fourth overall
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    3        //   Index
                ],
                "span": [9, 13, 23]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    3,       //   Index
                    1        // DescriptorProto.ExtensionRange, field `start`
                ],
                "span": [9, 13, 16]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    3,       //   Index
                    2        // DescriptorProto.ExtensionRange, field `end`
                ],
                "span": [9, 20, 23]
            },
            {
                // options for the first single range
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    3,       //   Index
                    3,       // DescriptorProto.ExtensionRange, field `options`
                ],
                "span": [9, 24, 50]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    5,       // DescriptorProto, field `extension_range`
                    0,       //   Index
                    3,       // DescriptorProto.ExtensionRange, field `options`
                    1234,    // ExtensionRangeOptions, extension `(category)`
                ],
                "span": [9, 25, 49]
            }
            // highlight-end
            // other locations elided
        ]
    }
}
```

### Reserved Ranges and Names {#source-code-info-for-reserved-ranges-and-names}

Another case where there will be multiple locations in the source code info that all
have the same path is when a message  includes multiple [_MessageReservedDecl_](./language-spec.md#reserved-names-and-numbers)
declarations or an enum includes multiple [_EnumReservedDecl_](./language-spec.md#enum-reserved-names-and-numbers)
declarations.

Like extension ranges above, these declarations correspond to repeated fields in the
message and enum descriptors (named `reserved_range` and `reserved_name`). But a
single declaration can correspond to multiple elements in these repeated fields. So
a location will be created for each complete declaration, with a path that indicates
the relevant field, and it will include comments. Then additional locations will be
created for each individual range therein.

Also like extension ranges, if the source for a single range does not include an
end number (for example `11` instead of `11 to 13`), the span corresponding to the
range end will point to that single value in the source.

```protobuf title="example.proto" showLineNumbers
syntax = "proto3";
message Foo {
  // highlight-start
  // comment for message reserved ranges
  reserved 1, 5000 to max;
  // comment for message reserved names
  reserved "bar", "baz", "buzz";
  // highlight-end
}
enum Bar {
  BAZ = 0;
  // highlight-start
  // comment for enum reserved ranges
  reserved 1 to 5;
  // comment for enum reserved names
  reserved "BUZZ";
  // highlight-end
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    // other content elided
    "source_code_info": {
        "location": [
            // Message, first declaration:
            // highlight-start
            {
                // whole block
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    9        // DescriptorProto, field `reserved_range`
                ],
                "span": [3, 2, 26],
                "leading_comments": " comment for message reserved ranges\n"
            },
            {
                // first single range (no explicit range end)
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    9,       // DescriptorProto, field `reserved_range`
                    0        //   Index
                ],
                "span": [3, 11, 12]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    9,       // DescriptorProto, field `reserved_range`
                    0,       //   Index
                    1        // DescriptorProto.ReservedRange, field `start`
                ],
                "span": [3, 11, 12]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    9,       // DescriptorProto, field `reserved_range`
                    0,       //   Index
                    2        // DescriptorProto.ReservedRange, field `end`
                ],
                "span": [3, 11, 12]
            },
            {
                // second single range
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    9,       // DescriptorProto, field `reserved_range`
                    1        //   Index
                ],
                "span": [3, 14, 25]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    9,       // DescriptorProto, field `reserved_range`
                    1,       //   Index
                    1        // DescriptorProto.ReservedRange, field `start`
                ],
                "span": [3, 14, 18]
            },
            {
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    9,       // DescriptorProto, field `reserved_range`
                    1,       //   Index
                    2        // DescriptorProto.ReservedRange, field `end`
                ],
                "span": [3, 22, 25]
            },
            // highlight-end
            // Message, second declaration:
            // highlight-start
            {
                // whole block
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    10       // DescriptorProto, field `reserved_name`
                ],
                "span": [5, 2, 32],
                "leading_comments": " comment for message reserved names\n"
            },
            {
                // first element
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    10,      // DescriptorProto, field `reserved_name`
                    0        //   Index
                ],
                "span": [5, 11, 16]
            },
            {
                // second element
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    10,      // DescriptorProto, field `reserved_name`
                    1        //   Index
                ],
                "span": [5, 18, 23]
            },
            {
                // third element
                "path": [
                    4,       // FileDescriptorProto, field `message_type`
                    0,       //   Index (first message in the file)
                    10,      // DescriptorProto, field `reserved_name`
                    2        //   Index
                ],
                "span": [5, 25, 31]
            },
            // highlight-end
            // Enum, first declaration:
            // highlight-start
            {
                // whole block
                "path": [
                    5,       // FileDescriptorProto, field `emum_type`
                    0,       //   Index (first enum in the file)
                    4        // EnumDescriptorProto, field `reserved_range`
                ],
                "span": [10, 2, 18],
                "leading_comments": " comment for enum reserved ranges\n"
            },
            {
                // sole single range
                "path": [
                    5,       // FileDescriptorProto, field `emum_type`
                    0,       //   Index (first enum in the file)
                    4        // EnumDescriptorProto, field `reserved_range`
                    0        //   Index
                ],
                "span": [10, 11, 17]
            },
            {
                "path": [
                    5,       // FileDescriptorProto, field `emum_type`
                    0,       //   Index (first enum in the file)
                    4        // EnumDescriptorProto, field `reserved_range`
                    0,       //   Index
                    1        // EnumDescriptorProto.ReservedRange, field `start`
                ],
                "span": [10, 11, 12]
            },
            {
                "path": [
                    5,       // FileDescriptorProto, field `emum_type`
                    0,       //   Index (first enum in the file)
                    4        // EnumDescriptorProto, field `reserved_range`
                    0,       //   Index
                    2        // EnumDescriptorProto.ReservedRange, field `end`
                ],
                "span": [10, 16, 17]
            },
            // highlight-end
            // Enum, second declaration:
            // highlight-start
            {
                // whole block
                "path": [
                    5,       // FileDescriptorProto, field `emum_type`
                    0,       //   Index (first enum in the file)
                    5        // EnumDescriptorProto, field `reserved_name`
                ],
                "span": [12, 2, 18],
                "leading_comments": " comment for enum reserved names\n"
            },
            {
                // sole element
                "path": [
                    5,       // FileDescriptorProto, field `emum_type`
                    0,       //   Index (first enum in the file)
                    5        // EnumDescriptorProto, field `reserved_name`
                    0        //   Index
                ],
                "span": [12, 11, 17]
            }
            // highlight-end
            // other locations elided
        ]
    }
}
```

### Options {#source-code-info-for-options}

A source code info location is created for each option declaration. The path for that
location indicates the path to the field specified by the option name. This path
includes all components of the option name, resolved to field numbers. The span for
that location will be the entire option declaration (starting with the `option`
keyword and ending with the semicolon `;`).

A field declaration has two _pseudo_-options: values that are declared as if they
were options, but are not fields inside of a `FieldOptions` message.
1. `default`: When a `default` option is present (proto2 syntax only), the path for
   the corresponding location will indicate the [`default_value`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L202)
   field of `FieldDescriptorProto`.
2. `json_name`: When a `json_name` option is present, the path for the corresponding
   location will indicate the [`json_name`](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto#L212)
   field of `FieldDescriptorProto`.

The source code info will also contain one or more locations whose path indicates
the `options` field itself. This will be a prefix of the path that corresponds to
a particular field specified by an option name.

When the compact syntax is used for options (for fields, enum values, and extension
ranges), the span for this path indicates the entire set of options, including the
enclosing brackets (`[` and `]`).

For non-compact option declarations, the span for the path indicates the entire
declaration, from the `option` keyword to the trailing semicolon (`;`). If an
element has multiple options, there will be a separate location for each option,
but each with the same path.

Here's an example file and below are the corresponding source code info entries:
```protobuf title="example.proto" showLineNumbers
syntax = "proto3";

import "google/api/annotation.proto";

message Foo {
    repeated uint32 bar = 1 [
        // highlight-start
        json_name = "BAR",
        packed = false
        // highlight-end
    ];
}

service ExampleService {
    rpc Baz(Foo) returns (Foo) {
        // highlight-start
        option (google.api.http).post = "/foo/bar/baz/";
        option (google.api.http).body = "*";
        // highlight-end
    }
}
```
```json title="File descriptor"
{
    "name": "example.proto",
    // other content elided
    "source_code_info": {
        "location": [
            // Field options:
            // highlight-start
            {
                // (path for `options` field; span encompasses all compact options)
                "path": [
                    4,      // FileDescriptorProto, field `message_type`
                    0,      //   Index (first message in the file)
                    2,      // DescriptorProto, field `field`
                    0,      //   Index (first field in message)
                    8       // FieldDescriptorProto, field `options`
                ],
                "span": [5, 28, 8, 5]
            },
            {
                "path": [
                    4,      // FileDescriptorProto, field `message_type`
                    0,      //   Index (first message in the file)
                    2,      // DescriptorProto, field `field`
                    0,      //   Index (first field in message)
                    10      // FieldDescriptorProto, field `json_name`
                ],
                "span": [6, 8, 25]
            },
            {
                "path": [
                    4,      // FileDescriptorProto, field `message_type`
                    0,      //   Index (first message in the file)
                    2,      // DescriptorProto, field `field`
                    0,      //   Index (first field in message)
                    8,      // FieldDescriptorProto, field `options`
                    2       // FieldOptions, field `packed`
                ],
                "span": [7, 8, 22]
            },
            // highlight-end
            // Method options:
            // highlight-start
            {
                // (path for `options` field; repeated for each option)
                "path": [
                    6,          // FileDescriptorProto, field `service`
                    0,          //   Index (first service in the file)
                    2,          // ServiceDescriptorProto, field `method`
                    0,          //   Index (first method in service)
                    4           // MethodDescriptorProto, field `options`
                ],
                "span": [13, 8, 56]
            },
            {
                "path": [
                    6,          // FileDescriptorProto, field `service`
                    0,          //   Index (first service in the file)
                    2,          // ServiceDescriptorProto, field `method`
                    0,          //   Index (first method in service)
                    4,          // MethodDescriptorProto, field `options`
                    72295728,   // MethodOptions, extension `google.api.http`
                    4           // HttpRule, field `post`
                ],
                "span": [13, 8, 56]
            },
            {
                // (path for `options` field; here it is again)
                "path": [
                    6,          // FileDescriptorProto, field `service`
                    0,          //   Index (first service in the file)
                    2,          // ServiceDescriptorProto, field `method`
                    0,          //   Index (first method in service)
                    4,          // MethodDescriptorProto, field `options`
                ],
                "span": [14, 8, 44]
            },
            {
                "path": [
                    6,          // FileDescriptorProto, field `service`
                    0,          //   Index (first service in the file)
                    2,          // ServiceDescriptorProto, field `method`
                    0,          //   Index (first method in service)
                    4,          // MethodDescriptorProto, field `options`
                    72295728,   // MethodOptions, extension `google.api.http`
                    7           // HttpRule, field `body`
                ],
                "span": [14, 8, 44]
            }
            // highlight-end
            // other locations elided
        ]
    }
}
```
