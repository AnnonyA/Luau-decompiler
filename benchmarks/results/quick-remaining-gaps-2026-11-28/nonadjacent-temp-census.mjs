// Diagnostic AST projections only. This does not modify a repository engine.
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';

const [distArg, recordsArg, outArg] = process.argv.slice(2);
if (!outArg) throw Error('Usage: node nonadjacent-temp-census.mjs dist records out');
const dist = resolve(distArg), records = resolve(recordsArg), out = resolve(outArg);
await mkdir(out);
const load = path => import(pathToFileURL(join(dist, path)));
const {decompile} = await load('decompile.js');
const {analyzeBindings} = await load('analysis/Bindings.js');
const {normalizeControlFlow} = await load('decode/NormalizeControlFlow.js');
const {reconstructFunction} = await load('reconstruct/Reconstructor.js');
const {printLuau} = await load('print/LuauPrinter.js');
const tempCode = (await readFile(join(dist, 'ast/TempFolding.js'), 'utf8')).replace(
  /from\s+"([^"]+)"/g, (_, path) => 'from ' + JSON.stringify(pathToFileURL(resolve(dist, 'ast', path)).href));
// Reuse the baseline's exact ordering/list-tail/replacement implementation.
const {locate, weight, replaceInStatement} = await import('data:text/javascript;base64,' +
  Buffer.from(tempCode + '\nexport {locate, weight, replaceInStatement};\n').toString('base64'));
const modes = ['primitive_inert_stores', 'inert_stores_unknown_results', 'optimistic_other_local_stores'];
const arithmetic = new Set(['+', '-', '*', '/', '//', '%', '^']);
const ordered = new Set(['<', '<=', '>', '>=']);
const unparen = node => node?.kind === 'paren' ? unparen(node.expression) : node;
const producerKey = definition => definition && [definition.prototypeId, definition.pc, definition.register].join(':');
const tree = (node, action) => {
  if (!node || typeof node !== 'object') return;
  action(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => tree(child, action));
    else tree(value, action);
  }
};

function project(original, mode, protectedKeys) {
  const ast = structuredClone(original), events = [];
  for (let round = 0; round < 8; round++) {
    const {bindings} = analyzeBindings(ast.body);
    const references = new Map(), declarations = new Map(), statements = new Map(), blocks = [];
    for (const binding of bindings) {
      for (const reference of [...binding.reads, ...binding.writes]) {
        if (references.has(reference.node) && references.get(reference.node) !== binding) references.set(reference.node, null);
        else references.set(reference.node, binding);
      }
      if (declarations.has(binding.declaration)) declarations.set(binding.declaration, null);
      else declarations.set(binding.declaration, binding);
    }
    tree(ast.body, node => {
      if (node.kind !== 'block') return;
      blocks.push(node);
      for (const statement of node.statements) {
        if (statements.has(statement) && statements.get(statement) !== node) statements.set(statement, null);
        else statements.set(statement, node);
      }
    });
    const primitive = (input, seen = new Set()) => {
      const value = unparen(input);
      if (!value || seen.size > 64) return;
      if (value.kind === 'literal') {
        const type = value.value === null ? 'nil' : typeof value.value;
        return ['nil', 'number', 'string', 'boolean'].includes(type) ? type : undefined;
      }
      if (value.kind === 'identifier') {
        const binding = references.get(value);
        if (!binding || binding.writes.length || seen.has(binding)) return;
        if (binding.declaration.kind === 'numeric-for') return 'number';
        if (binding.declaration.kind !== 'local') return;
        const initializer = binding.declaration.values[binding.declarationIndex ?? -1];
        return initializer && primitive(initializer, new Set(seen).add(binding));
      }
      if (value.kind === 'unary') {
        if (value.op === 'not' && inert(value.argument)) return 'boolean';
        const operand = primitive(value.argument, seen);
        if (value.op === '-' && operand === 'number' || value.op === '#' && operand === 'string') return 'number';
        return;
      }
      if (value.kind === 'binary') {
        const left = primitive(value.left, seen), right = primitive(value.right, seen);
        if (arithmetic.has(value.op) && left === 'number' && right === 'number') return 'number';
        if (ordered.has(value.op) && left && left === right && ['number', 'string'].includes(left)) return 'boolean';
        if (['==', '~='].includes(value.op) && left && right) return 'boolean';
        if (['and', 'or'].includes(value.op) && left && left === right) return left;
        return;
      }
      if (value.kind === 'if-expr') {
        if (![value.test, ...value.branches.map(branch => branch.test)].every(inert)) return;
        const types = [value.consequent, value.alternate, ...value.branches.map(branch => branch.value)]
          .map(child => primitive(child, seen));
        return types[0] && types.every(type => type === types[0]) ? types[0] : undefined;
      }
    };
    const inert = input => {
      const value = unparen(input);
      if (!value) return false;
      if (value.kind === 'literal') return ['nil', 'number', 'string', 'boolean'].includes(value.value === null ? 'nil' : typeof value.value);
      if (value.kind === 'identifier') return !!references.get(value);
      if (value.kind === 'unary' && value.op === 'not') return inert(value.argument);
      if (value.kind === 'binary' && ['and', 'or'].includes(value.op)) return inert(value.left) && inert(value.right);
      return primitive(value) !== undefined;
    };
    const stableIdentifier = node => {
      const binding = references.get(node);
      return !!binding && !(binding.captured && binding.writes.length > 0);
    };
    const isGlobal = node => !references.has(node);
    let changes = 0;
    for (const body of blocks) {
      const removed = new Set(), replacements = new Map();
      for (let index = body.statements.length - 1; index >= 0; index--) {
        const declaration = body.statements[index], binding = declarations.get(declaration);
        if (declaration.kind !== 'local' || declaration.names.length !== 1 || declaration.values.length !== 1 ||
            !binding || binding.captured || binding.writes.length || binding.reads.length !== 1 || binding.name === '_' ||
            !declaration.definition || declaration.definition.debugName !== undefined || protectedKeys.has(producerKey(declaration.definition))) continue;
        const read = binding.reads[0], consumer = read.statement;
        if (statements.get(consumer) !== body || removed.has(consumer) || replacements.has(declaration)) continue;
        const position = body.statements.indexOf(consumer);
        if (position < index + 2) continue; // The existing pass owns adjacent pairs.
        const value = declaration.values[0];
        const dependencies = new Set(), names = new Set();
        let allocation = false, unresolved = false;
        tree(value, node => {
          if (node.kind === 'function-expr' || node.kind === 'table' || node.kind === 'vararg') allocation = true;
          if (node.kind === 'identifier') {
            names.add(node.name);
            const owner = references.get(node);
            if (!owner) unresolved = true;
            else dependencies.add(owner);
          }
        });
        if (allocation) continue;
        const valueType = primitive(value);
        if (mode === 'primitive_inert_stores' && !valueType) continue;
        // Even the optimistic cohorts retain known lexical inputs and scope.
        if (unresolved) continue;
        let safeGap = true;
        const gap = body.statements.slice(index + 1, position).filter(statement => !removed.has(statement));
        for (const statement of gap) {
          if (statement.kind !== 'local' && statement.kind !== 'assign') {safeGap = false; break;}
          if (replacements.has(statement)) {safeGap = false; break;}
          let targets;
          if (statement.kind === 'local') {
            targets = bindings.filter(item => item.declaration === statement);
            if (statement.names.some(name => names.has(name))) {safeGap = false; break;}
          } else {
            targets = statement.targets.map(target => target.kind === 'identifier' ? references.get(target) : undefined);
          }
          if (!targets.length || targets.some(target => !target || target.captured || dependencies.has(target))) {safeGap = false; break;}
          if (mode !== 'optimistic_other_local_stores' && !statement.values.every(inert)) {safeGap = false; break;}
        }
        if (!safeGap) continue;
        const actualConsumer = replacements.get(consumer) ?? consumer;
        const site = locate(actualConsumer, read.node, stableIdentifier, isGlobal);
        if (!site?.ordered) continue;
        if (weight(value) > 3 && site.weight - 1 + weight(value) > 40) continue;
        const pack = ['call', 'method-call', 'vararg'].includes(value.kind);
        const replacement = pack && site.tail ? {kind: 'paren', expression: value} : value;
        replacements.set(consumer, replaceInStatement(actualConsumer, read.node, replacement));
        removed.add(declaration);
        events.push({name: binding.name, definition: declaration.definition, initializer: value.kind,
          primitiveType: valueType ?? null, gap: gap.map(statement => statement.kind),
          consumer: consumer.kind, round, scalarAdjusted: pack && site.tail});
      }
      if (removed.size) {
        body.statements = body.statements.filter(statement => !removed.has(statement))
          .map(statement => replacements.get(statement) ?? statement);
        changes += removed.size;
      }
    }
    if (!changes) break;
  }
  return {ast, events};
}

const scorerPath = resolve('quality-research/harness/target/release/quality-score');
const scorer = spawn(scorerPath, [], {stdio: ['pipe', 'pipe', 'pipe']});
let stderr = '';
scorer.stderr.on('data', data => stderr += data);
const scores = createInterface({input: scorer.stdout})[Symbol.asyncIterator]();
const score = async request => {
  scorer.stdin.write(JSON.stringify(request) + '\n');
  const line = await scores.next();
  if (line.done) throw Error('Scorer ended unexpectedly: ' + stderr);
  return JSON.parse(line.value);
};
const paths = [];
for (const name of await readdir(join(records, 'generated'))) {
  for (const file of await readdir(join(records, 'generated', name))) {
    if (file.endsWith('.json')) paths.push(join(records, 'generated', name, file));
  }
}
const rows = [];
try {
  for (const path of paths.sort()) {
    const record = JSON.parse(await readFile(path, 'utf8'));
    const bytes = await readFile(record.bytecodePath);
    const result = decompile(bytes, {});
    if (!result.ok) throw Error(record.id + ': ' + result.error);
    const printed = printLuau(result.ast);
    if (printed !== result.source.replace(/^--!optimize 2\n/, '')) throw Error('Printer baseline diverged');
    const baseline = await score({id: record.id, original: record.source, output: result.source, debugNames: record.profile.includes('g2')});
    if (baseline.quality.similarity !== record.quality.similarity) throw Error('Cached score mismatch: ' + record.id);
    const module = normalizeControlFlow(result.module);
    const reconstructed = reconstructFunction(module, module.prototypes[module.mainProtoId]);
    const protectedKeys = new Set();
    tree(reconstructed.body, node => {
      if (node.kind !== 'local' || !node.definition) return;
      const known = reconstructed.declaredLocalsByPrototype.get(node.definition.prototypeId);
      if (node.definition.debugName !== undefined || node.names.some(name => known?.has(name)))
        protectedKeys.add(producerKey(node.definition));
    });
    const projections = {};
    for (const mode of modes) {
      const projection = project(result.ast, mode, protectedKeys);
      if (!projection.events.length) {
        projections[mode] = {events: [], quality: baseline.quality, delta: 0};
        continue;
      }
      const output = printLuau(projection.ast);
      const measured = await score({id: record.id + '/' + mode, original: record.source, output, debugNames: record.profile.includes('g2')});
      projections[mode] = {events: projection.events, output, quality: measured.quality,
        delta: 100 * (measured.quality.similarity - baseline.quality.similarity)};
    }
    const row = {id: record.id, source: record.source, baselineOutput: result.source, baselineQuality: baseline.quality,
      bytecodePath: record.bytecodePath, bytecodeSha256: createHash('sha256').update(bytes).digest('hex'), projections};
    rows.push(row);
    await writeFile(join(out, record.name + '-' + record.profile + '.json'), JSON.stringify(row) + '\n', {flag: 'wx'});
    if (rows.length % 50 === 0) console.log(JSON.stringify({completed: rows.length, total: paths.length}));
  }
} finally {
  scorer.stdin.end();
}
await new Promise((done, reject) => scorer.on('exit', code => code === 0 ? done() : reject(Error('Scorer exit ' + code))));
const summary = {type: 'Read-only non-adjacent temporary AST sensitivity; not a runtime or safety certification.',
  engineDist: dist, records, corpusProfiles: 882, projectedGeneratedProfiles: rows.length,
  options: {}, query: '', benchmarkChanged: false, scorerChanged: false, behaviorVerified: false,
  modes: Object.fromEntries(modes.map(mode => {
    const affected = rows.filter(row => row.projections[mode].events.length);
    const delta = rows.reduce((sum, row) => sum + row.projections[mode].delta, 0);
    return [mode, {movedDeclarations: affected.reduce((sum, row) => sum + row.projections[mode].events.length, 0),
      affectedProfiles: affected.length, projectedGlobalDeltaPoints: delta / 882,
      projectedGeneratedDeltaPoints: delta / rows.length,
      better: rows.filter(row => row.projections[mode].delta > 0).length,
      equal: rows.filter(row => row.projections[mode].delta === 0).length,
      worse: rows.filter(row => row.projections[mode].delta < 0).length,
      largestChanges: affected.map(row => ({id: row.id, moved: row.projections[mode].events.length,
        delta: row.projections[mode].delta})).sort((a, b) => b.delta - a.delta).slice(0, 20)}];
  }))};
await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(summary, null, 2));
