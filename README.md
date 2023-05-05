# Protocol Buffers Language Details

This repo contains the sources for the [protobuf.com](https://protobuf.com) site.
A key piece of content here is the [language specification](./docs/language-spec.md),
with details on the grammar of the Protobuf IDL.

The repo also contains some simple examples, in the form of configuration for
parser generators, in the [`examples` directory](./examples).

In addition to the language spec and grammar, other information can be found here that
relates to the Protobuf language, some of which aims to fill other gaps in Google's
[official documentation for Protocol Buffers](https://protobuf.dev/).

- [Compilation and Descriptors](./docs/descriptors.md):
  This document describes details of producing descriptor protos from a source
  file. Many of these details are described in the [source for the descriptor protos](https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.proto).
  But, like other official documentation, it is lacking in some areas. In particular,
  there are many aspects of descriptor production that are non-obvious and that are
  either unspecified or under-specified in the comments in the source file itself.

If any errors or omissions are identified in the language spec herein, please file an
issue and consider opening a pull request to fix it. With community participation, this
can serve as the authoritative source for the language specification.

## Docusaurus

This is a [Docusaurus](https://docusaurus.io/) site. So the Markdown files have some
content that is specific to the Docusaurus dialect, such as titles and highlighting
on code blocks and admonitions/call-outs. So some aspects of the content here will not
render well on GitHub (which does not support this dialect).

To view the site properly rendered to HTML, execute `make run` from a shell prompt in
the root directory of the repo.
