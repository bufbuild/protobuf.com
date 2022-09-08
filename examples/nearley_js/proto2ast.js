#! /usr/bin/env node

const process = require('process');
const parser = require('./parser.js');

async function read(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}

(async () => {
    const input = await read(process.stdin);

    let p = parser.newParser();

    p.feed(input);

    if (p.results.length === 0) {
        throw new Error("unexpected EOF");
    }

    if (p.results.length > 1) {
        console.log("Internal error! Grammar is ambiguous: " + p.results.length + " possible ASTs identified!");
    }

    let ast = JSON.stringify(p.results[0], null, 4);
    process.stdout.write(ast + '\n');
})();
