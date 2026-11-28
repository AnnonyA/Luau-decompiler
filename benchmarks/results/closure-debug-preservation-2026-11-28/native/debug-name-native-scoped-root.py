from pathlib import Path
import concurrent.futures,hashlib,json,subprocess,shutil
ROOT=Path('/workspace/scratch/1c4124dc88e4');OLD=Path('/workspace/scratch/eb5e4be57451');ENGINE=ROOT/'engine-regions';OUT=ROOT/'debug-name-native-scoped-root';FIXTURES=ROOT/'Luau-decompiler/tests/fixtures/named-table-closures'
OUT.mkdir(exist_ok=False);shutil.copytree(ENGINE/'dist',OUT/'engine-dist')
(OUT/'engine-dist/package.json').write_text('{"type":"module"}')
NODE='/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'
PINS={'9d':(OLD/'reference-luau-ci/build/release/luau-compile',OLD/'quality-research/v2-call-boundary-probe/run-bytecode-9d'),'c875':(OLD/'reference-luau/build/release/luau-compile',OLD/'quality-research/v2-call-boundary-probe/run-bytecode-c875')}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((FIXTURES/'manifest.json').read_text())
for s in m['sources']:assert sha(FIXTURES/s['path'])==s['sha256']
for i in m['inputs']:assert sha(FIXTURES/i['path'])==i['sha256']
def run(i):
 folder=OUT/Path(i['path']).stem;folder.mkdir();compiler,vm=PINS[i['pin']];commands=[]
 def exe(args,label):
  args=list(map(str,args));p=subprocess.run(args,capture_output=True,timeout=30)
  (folder/(label+'.stdout')).write_bytes(p.stdout);(folder/(label+'.stderr')).write_bytes(p.stderr);commands.append({'args':args,'exit':p.returncode});return p
 orig=exe([vm,FIXTURES/i['path']],'original');dec=exe([NODE,OUT/'engine-dist/cli.js','decompile',FIXTURES/i['path']],'decompile');(folder/'candidate.luau').write_bytes(dec.stdout)
 comp=exe([compiler,'--binary','-O'+i['profile'][1],'-g'+i['profile'][3],folder/'candidate.luau'],'compile');(folder/'candidate.luauc').write_bytes(comp.stdout);actual=exe([vm,folder/'candidate.luauc'],'candidate')
 (folder/'commands.json').write_text(json.dumps(commands,indent=2)+'\n')
 return {'input':i['path'],'sha256':i['sha256'],'pass':orig.returncode==dec.returncode==comp.returncode==actual.returncode==0 and orig.stdout==actual.stdout and orig.stderr==actual.stderr,'original':{'exit':orig.returncode,'stdout':orig.stdout.decode(),'stderr':orig.stderr.decode()},'candidate':{'exit':actual.returncode,'stdout':actual.stdout.decode(),'stderr':actual.stderr.decode()}}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,m['inputs']))
summary={'total':len(results),'pass':sum(x['pass'] for x in results),'node':subprocess.check_output([NODE,'--version'],text=True).strip(),'results':results};(OUT/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='results'}))
