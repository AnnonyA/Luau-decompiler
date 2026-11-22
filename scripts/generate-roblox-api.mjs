import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {parse} from 'yaml';

// Creator Docs is a build input only. Reading blobs by object ID also works
// with a sparse or dirty working tree and preserves the pinned source bytes.
const revision = 'a23352b27af917e55e165e4d42583580700d1fbf';
const engine = 'content/en-us/reference/engine';
const checkout = process.argv[2];
if (!checkout || process.argv.slice(3).some(arg => arg !== '--check')) {
  throw Error('Usage: node scripts/generate-roblox-api.mjs <creator-docs checkout> [--check]');
}
function git(args, input) {
  return execFileSync('git', ['-C', checkout, ...args], {input, maxBuffer: 128 * 1024 * 1024});
}
const listing = git(['ls-tree', '-r', revision, '--', ...['classes','datatypes','enums'].map(s => engine+'/'+s)]).toString();
const files = listing.trimEnd().split('\n').map(line => /^(?:\d+) blob ([a-f0-9]+)\t.*\/(classes|datatypes|enums)\/([^/]+)\.yaml$/.exec(line)).filter(Boolean);
const input = files.map(match => match[1]).join('\n') + '\n';
const blobs = git(['cat-file','--batch'], input);
let offset = 0;
const docs = {classes:new Map(), datatypes:new Map(), enums:new Map()};
for (const [,hash,kind,name] of files) {
  const headerEnd = blobs.indexOf(10, offset);
  const [id, type, size] = blobs.toString('ascii', offset, headerEnd).split(' ');
  if (hash !== id || type !== 'blob') throw Error('Unexpected object for ' + name);
  const dataEnd = headerEnd + 1 + Number(size);
  const doc = parse(blobs.toString('utf8', headerEnd + 1, dataEnd));
  if (doc.name !== name) throw Error('Unexpected document name for ' + name + ': ' + doc.name);
  docs[kind].set(name,doc);
  offset = dataEnd + 1;
}

const primitive = new Map([
  ['bool','boolean'], ['boolean','boolean'], ['string','string'], ['ContentId','string'],
  ['int','number'], ['int32','number'], ['int64','number'], ['float','number'],
  ['double','number'], ['number','number'], ['Instances','{Instance}'],
]);
function normalize(type, nullableClass = false) {
  if (typeof type !== 'string') return null;
  if (type.endsWith('?')) {
    const base = normalize(type.slice(0,-1));
    return base ? base + '?' : null;
  }
  if (primitive.has(type)) return primitive.get(type);
  if (type.startsWith('Enum.')) {
    return docs.enums.has(type.slice(5)) ? type : null;
  }
  // Bare class names and enum names are ambiguous in a few declarations.
  if (docs.enums.has(type) && (docs.classes.has(type) || docs.datatypes.has(type))) return null;
  if (docs.classes.has(type)) return type + (nullableClass ? '?' : '');
  if (docs.datatypes.has(type)) return type;
  if (docs.enums.has(type)) return 'Enum.' + type;
  return null;
}

function readable(member) {
  const security = member.security?.read ?? member.security;
  return (!security || security === 'None') &&
    !member.tags?.some(tag => ['Hidden','NotScriptable','WriteOnly'].includes(tag));
}
function memberName(owner, raw) {
  const prefix = raw.slice(0,owner.length+1);
  if (prefix !== owner + '.' && prefix !== owner + ':') throw Error('Unexpected member ' + raw + ' on ' + owner);
  return raw.slice(owner.length+1);
}
function add(entry, group, name, value) {
  (entry[group] ??= Object.create(null))[name] = value;
}
function append(entry, group, name, signature) {
  const groupMap = entry[group] ??= Object.create(null);
  const overloads = groupMap[name] ??= [];
  if (!overloads.some(previous => JSON.stringify(previous) === JSON.stringify(signature))) overloads.push(signature);
}
function variable(type) {
  return type === 'Tuple' || type === '...' || type?.startsWith('...') || type === 'Array<any>...';
}
function methodSignature(parameters, result) {
  let min = 0;
  for (let i=0; i<parameters.length; i++) {
    const p = parameters[i];
    if (variable(p.type) || p.name === '...') return [min,null,result];
    if (p.default == null && !p.type?.endsWith('?')) min = i + 1;
  }
  return [min,parameters.length,result];
}
function eventSignature(member) {
  const slots = [];
  for (const p of member.parameters ?? []) {
    if (variable(p.type) || p.name === '...') break;
    const nullable = member.name === 'Instance.AncestryChanged' && p.name === 'parent' ||
      member.name === 'Humanoid.Seated' && p.name === 'currentSeatPart' ||
      member.name === 'GuiBase2d.SelectionChanged' && ['previousSelection','newSelection'].includes(p.name) ||
      member.name === 'ObjectValue.Changed' || member.name === 'ObjectValue.changed';
    slots.push(normalize(p.type,nullable));
  }
  return slots;
}
// These members document nil in their descriptions while their structured
// return/property type (or implicit constructor result) omits it.
const nullableMembers = new Set([
  'DateTime.fromIsoDate',
  'FloatCurveKey.LeftTangent', 'FloatCurveKey.RightTangent',
  'RotationCurveKey.LeftTangent', 'RotationCurveKey.RightTangent',
  'ValueCurveKey.LeftTangent', 'ValueCurveKey.RightTangent',
  'ContextActionService:GetCurrentLocalToolIcon', 'PhysicsService:GetCollisionGroupId',
]);
function applyDocumentedNullability(member, result) {
  return result && nullableMembers.has(member.name) && !result.endsWith('?') ? result + '?' : result;
}
function describe(doc, kind) {
  const entry = {};
  if (doc.inherits?.length > 1) throw Error('Multiple bases on ' + doc.name);
  if (doc.inherits?.[0]) entry.base = doc.inherits[0];
  if (kind === 'classes' && readable(doc)) {
    if (doc.tags.includes('Service')) entry.service = true;
    else if (!doc.tags.includes('NotCreatable')) entry.creatable = true;
  }
  const constants = new Set((doc.constants ?? []).map(m => m.name));
  for (const group of ['properties','constants','methods','constructors','functions','events','callbacks']) {
    for (const member of doc[group] ?? []) {
      const name = memberName(doc.name,member.name);
      if (!readable(member)) {
        (entry.blocked ??= []).push(name);
        continue;
      }
      if (group === 'properties' || group === 'constants') {
        const property = group === 'constants' || constants.has(member.name) ? 'staticProperties' : 'properties';
        add(entry,property,name,applyDocumentedNullability(member,normalize(member.type,kind === 'classes')));
      } else if (group === 'events' || group === 'callbacks') {
        add(entry,group,name,eventSignature(member));
      } else {
        const callable = group === 'constructors' || group === 'functions' ? 'staticMethods' : 'methods';
        // The Creator Hub explicitly guarantees a freshly created Tween on success.
        const nullableClass = kind === 'classes' && member.name !== 'TweenService:Create';
        const result = group === 'constructors' ? doc.name :
          member.returns?.length === 1 ? normalize(member.returns[0].type,nullableClass) : null;
        append(entry,callable,name,methodSignature(member.parameters ?? [], applyDocumentedNullability(member,result)));
      }
    }
  }
  return entry;
}
const classes = [...docs.classes].map(([name,doc]) => [name,describe(doc,'classes')]);
const datatypes = [...docs.datatypes].map(([name,doc]) => [name,describe(doc,'datatypes')]);
const enums = [...docs.enums].map(([name,doc]) => [name,(doc.items ?? []).map(item => item.name)]);
const ts = `// Generated from Roblox Creator Docs at ${revision}. See docs/references/roblox-callback-types.md.
// Regenerate with scripts/generate-roblox-api.mjs.
type ValueTypes = Readonly<Record<string, string | null>>;
type ParameterTypes = Readonly<Record<string, readonly (string | null)[]>>;
type Overloads = Readonly<Record<string, readonly (readonly [min: number, max: number | null, result: string | null])[]>>;
export interface RobloxApiClass {
  base?: string;
  service?: boolean;
  creatable?: boolean;
  blocked?: readonly string[];
  properties?: ValueTypes;
  staticProperties?: ValueTypes;
  methods?: Overloads;
  staticMethods?: Overloads;
  events?: ParameterTypes;
  callbacks?: ParameterTypes;
}
`;
function declaration(name, type, entries) {
  const lines = entries.map(([key,val]) => '  '+JSON.stringify(key)+': '+JSON.stringify(val)+',');
  return '\nexport const '+name+': Readonly<Record<string, '+type+'>> = {\n'+lines.join('\n')+'\n};\n';
}
const content = ts + declaration('robloxClasses','RobloxApiClass',classes) +
  declaration('robloxDatatypes','RobloxApiClass',datatypes) +
  declaration('robloxEnums','readonly string[]',enums);
const target = new URL('../src/reconstruct/roblox-api.generated.ts',import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target,'utf8').replace(/\r\n/g,'\n') !== content) throw Error('Generated API catalog is stale');
} else writeFileSync(target,content);
console.log(`${classes.length} classes, ${datatypes.length} datatypes, ${enums.length} enums`);
