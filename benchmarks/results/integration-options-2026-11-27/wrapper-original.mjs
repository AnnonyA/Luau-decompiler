import {readFileSync} from 'node:fs';
import {decompile, parseQueryOptions} from '../similarity-local-scopes/dist/decompile.js';
import {formatDecompiledSource} from '../similarity-local-scopes/dist/print/SourcePresentation.js';
const flavors={
 default:'',
 nofold:'fold_single_use_temps=false',
 plain:'fold_single_use_temps=false&if_expressions=false&early_return=false&early_continue=false&type_annotations=off&unfold_module_tables=false&recover_inlined_functions=false&runtime_context=false',
 compact:'generated_names=compact&type_annotations=off',
};
const flavor=process.argv[2];if(!(flavor in flavors))throw Error('unknown audit flavor');
const result=decompile(readFileSync(process.argv[3]),parseQueryOptions(new URLSearchParams(flavors[flavor])));
if(!result.ok)throw Error(result.error);
process.stdout.write(formatDecompiledSource(result,new Date(0)));
if(result.diagnostics.some(d=>d.severity==='error'))process.exitCode=1;
