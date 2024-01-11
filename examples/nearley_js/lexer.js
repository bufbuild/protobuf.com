const moo = require('moo');

exports.lexer = moo.compile({
    // discarded input
    whitespace: {
        match: /[ \n\r\t\f\v]+/,
        lineBreaks: true,
    },
    line_comment: /\/\/.*$/,
    block_comment: {
        match: /\/\*[^]*?\*\//,
        lineBreaks: true,
    },

    byte_order_mark: '\ufeff',

    // tokens
    identifier: {
        match: /[_A-Za-z][_A-Za-z0-9]*/,
        type: moo.keywords({
            sometimes_identifier: [
                "group", "message", "enum", "oneof", "reserved", "extensions",
                "extend", "option", "optional", "required", "repeated", "stream"
            ]
        })
    },
    numeric_literal: {
        match: /\.?[0-9](?:[.0-9a-dA-Df-zF-Z]|[eE][+-]?)*/,
        type: txt => {
            if (txt.match(/^0(?:[0-7]*|[xX][0-9a-zA-z]+)|[1-9][0-9]*$/)) {
                return 'int_literal';
            } else if (txt.match(/^(?:[0-9]+\.[0-9]*(?:[eE][+-]?[0-9]+)?|[0-9]+[eE][+-]?[0-9]+|\.[0-9]+(?:[eE][+-]?[0-9]+)?)$/)) {
                return 'float_literal';
            } else {
                // not used in grammar so will trigger parse failure
                return 'invalid numeric literal';
            }
        },
    },
    string_literal: /'(?:[^\n\\']|\\(?:[abfnrtv\\"'?]|x[A-Fa-f0-9]{2}|u[A-Fa-f0-9]{4}|U[A-Fa-f0-9]{8}|[0-7]{1,3}))*'|"(?:[^\n\\"]|\\(?:[abfnrtv\\"'?]|x[A-Fa-f0-9]{2}|u[A-Fa-f0-9]{4}|U[A-Fa-f0-9]{8}|[0-7]{1,3}))*"/,
    sym: /[;,./:=\-(){}\[\]<>]/
})