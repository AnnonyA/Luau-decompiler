// Run from the repository root. See README.md for the two build revisions.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';

const [dist, compiler, runtime, output] = process.argv.slice(2);
assert.ok(dist && compiler && runtime && output, 'Expected DIST LUAU_COMPILE LUAU REPORT.json.gz');
const load = file => import(pathToFileURL(resolve(dist, file)).href);
const {decompile} = await load('decompile.js');
const {decodeBytecode} = await load('decode/Decoder.js');
const {reconstructFunction} = await load('reconstruct/Reconstructor.js');
const fixture = 'tests/fixtures/rewrites/sibling-function-names';
const source = fixture + '.luau';
const inputs = JSON.parse(readFileSync('tests/fixtures/rewrites/inputs.json', 'utf8'))['sibling-function-names.luau'];
const styles = {default: {}, compact: {generatedNames: 'compact'},
    camelCase: {nameCasing: 'camelCase'}, snake_case: {nameCasing: 'snake_case'}, PascalCase: {nameCasing: 'PascalCase'}};
const hash = data => createHash('sha256').update(data).digest('hex');
function run(tool, args) {
    const result = spawnSync(tool, args, {timeout: 30000});
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr.toString());
    assert.equal(result.stderr.length, 0, result.stderr.toString());
    return result.stdout;
}
const trace = (file, flags, input) => run(runtime, [...flags, file, '-a', ...input]).toString().replaceAll('\r\n', '\n');
const report = {sourceSha256: hash(readFileSync(source)), compilerSha256: hash(readFileSync(compiler)),
    runtimeSha256: hash(readFileSync(runtime)), inputs, styles, levels: []};
const temp = mkdtempSync(join(tmpdir(), 'function-name-evidence-'));
let matches = 0;
let comparisons = 0;
try {
    for (const level of [0, 1, 2]) {
        const flags = ['-O' + level, '-g1'];
        const binary = run(compiler, ['--binary', ...flags, source]);
        assert.deepEqual(binary, readFileSync(fixture + '-O' + level + '.luauc'));
        const {module} = decodeBytecode(binary, {opcodeEncoding: 'official'});
        const rawAst = reconstructFunction(module, module.prototypes[module.mainProtoId]).body;
        const original = inputs.map(input => trace(source, flags, input));
        const profile = {level, bytecodeSha256: hash(binary), rawAst,
            officialDisassembly: run(compiler, ['--text', ...flags, source]).toString().replaceAll('\r\n', '\n'),
            original, generated: {}};
        for (const [style, options] of Object.entries(styles)) {
            const result = decompile(binary, {opcodeEncoding: 'official', ...options});
            assert.ok(result.ok, result.error);
            assert.deepEqual(result.validation, []);
            const file = join(temp, style + '.luau');
            writeFileSync(file, result.source);
            run(compiler, ['--only-parse', ...flags, file]);
            const traces = inputs.map(input => trace(file, flags, input));
            const outcomes = traces.map((text, index) => text === original[index] ? 'MATCH' : 'MISMATCH');
            profile.generated[style] = {source: result.source, sourceSha256: hash(result.source), finalAst: result.ast,
                parsed: true, traces, outcomes};
            matches += outcomes.filter(outcome => outcome === 'MATCH').length;
            comparisons += outcomes.length;
        }
        report.levels.push(profile);
    }
    report.summary = {matches, comparisons};
    const compressed = gzipSync(JSON.stringify(report), {level: 9});
    writeFileSync(output, compressed);
    console.log(JSON.stringify({matches, comparisons, sha256: hash(compressed)}));
} finally {
    rmSync(temp, {recursive: true, force: true});
}
