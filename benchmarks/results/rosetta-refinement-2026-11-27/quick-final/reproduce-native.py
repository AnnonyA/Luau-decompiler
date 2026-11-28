from pathlib import Path
import concurrent.futures,hashlib,json,subprocess
R=Path('/workspace/scratch/eb5e4be57451')
ENGINE=R/'measurements/quick-final-2323323-engine'
OUT=R/'measurements/quick-final-2323323-native'
OUT.mkdir(exist_ok=False)
NODE='/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'
PINS={'9d':(R/'reference-luau-ci/build/release/luau-compile',R/'quality-research/v2-call-boundary-probe/run-bytecode-9d'), 'c875':(R/'reference-luau/build/release/luau-compile',R/'quality-research/v2-call-boundary-probe/run-bytecode-c875')}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
rows=[]
for group in ['ref-alias-promotion','shared-guards','template-field-order']:
 folder=ENGINE/'tests/fixtures'/group
 m=json.loads((folder/'manifest.json').read_text())
 if group=='shared-guards':
  for x in m['entries']:
   assert sha(folder/x['source'])==x['sourceSha256']
   rows.append({'group':group,'file':folder/x['bytecode'],'pin':'9d' if x['compilerRevision'].startswith('9d') else 'c875','profile':x['profile'],'expected':x['sha256']})
 else:
  for x in m['sources']:assert sha(folder/x['path'])==x['sha256']
  rows.extend({'group':group,'file':folder/x['path'],'pin':x['pin'],'profile':x['profile'],'expected':x['sha256']} for x in m['inputs'])
for row in rows:assert sha(row['file'])==row['expected']

def run(row):
 folder=OUT/row['group']/row['file'].stem
 folder.mkdir(parents=True)
 compiler,host=PINS[row['pin']]
 commands=[]
 def execute(command,name):
  command=list(map(str,command));p=subprocess.run(command,capture_output=True,timeout=30)
  (folder/(name+'.stdout')).write_bytes(p.stdout);(folder/(name+'.stderr')).write_bytes(p.stderr)
  commands.append({'command':command,'exitCode':p.returncode,'stdout':name+'.stdout','stderr':name+'.stderr'})
  return p
 original=execute([host,row['file']],'original')
 recovered=execute([NODE,ENGINE/'dist/cli.js','decompile',row['file']],'decompile')
 (folder/'output.luau').write_bytes(recovered.stdout)
 compiled=execute([compiler,'--binary','-O'+row['profile'][1],'-g'+row['profile'][3],folder/'output.luau'],'compile')
 (folder/'output.luauc').write_bytes(compiled.stdout)
 actual=execute([host,folder/'output.luauc'],'actual')
 (folder/'commands.json').write_text(json.dumps(commands,indent=2)+'\n')
 result={**{k:str(v) if isinstance(v,Path) else v for k,v in row.items()},'original':{'exitCode':original.returncode,'stdout':original.stdout.decode(),'stderr':original.stderr.decode()},'actual':{'exitCode':actual.returncode,'stdout':actual.stdout.decode(),'stderr':actual.stderr.decode()},'decompileExitCode':recovered.returncode,'compileExitCode':compiled.returncode,'outputSourceSha256':sha(folder/'output.luau'),'outputBytecodeSha256':sha(folder/'output.luauc')}
 result['match']=original.returncode==recovered.returncode==compiled.returncode==actual.returncode==0 and original.stdout==actual.stdout and original.stderr==actual.stderr
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,rows))
summary={'revision':'232332339cf07211e791a6a67bd395a2031b20a5','node':'v22.23.5','total':len(results),'pass':sum(x['match'] for x in results),'groups':{g:{'total':sum(x['group']==g for x in results),'pass':sum(x['group']==g and x['match'] for x in results)} for g in sorted(set(x['group'] for x in results))},'distinctPinInputHashes':len(set((x['pin'],x['expected']) for x in results)),'note':'Profile checks of the three integrated changes. The original rejected-state source is intentionally present in both the OR and REF archives; these are not 96 distinct sources. Original bytes and sources verified against sealed manifests.','pins':{pin:{'compilerSha256':sha(paths[0]),'hostSha256':sha(paths[1])} for pin,paths in PINS.items()},'results':results}
(OUT/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='results'}))
raise SystemExit(0 if summary['pass']==summary['total'] else 1)
