from pathlib import Path
import concurrent.futures,hashlib,json,shutil,subprocess
work=Path('/workspace/scratch/1c4124dc88e4/closure-name-review')
root=work.parent; refs=Path('/workspace/scratch/eb5e4be57451')
node='/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'
candidate=work/'first-engine-dist'
shutil.copytree(root/'engine-regions/dist',candidate)
baseline=root/'measurements/baseline-replay/engine-dist'
pins={'9d':refs/'reference-luau-ci','c875':refs/'reference-luau'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
snapshot={str(p.relative_to(candidate)):sha(p) for p in sorted(candidate.rglob('*.js'))}
(work/'first-engine-snapshot.json').write_text(json.dumps(snapshot,indent=2)+'\n')
hosts={}
receipts={}
for pin,path in pins.items():
    build=path/'build/release';host=work/('run-bytecode-'+pin)
    command=['c++','-O2','-std=c++17','-I',str(path/'VM/include'),str(work/'run-bytecode.cpp'),str(build/'libluauvm.a'),str(build/'libluaucommon.a'),'-o',str(host)]
    subprocess.run(command,check=True,capture_output=True,timeout=60)
    hosts[pin]=host
    receipts[pin]={'revision':subprocess.check_output(['git','-C',str(path),'rev-parse','HEAD'],text=True).strip(),'compilerSha256':sha(build/'luau-compile'),'hostSha256':sha(host),'hostBuild':command}
def check(entry):
    pin,profile=entry;folder=work/(pin+'-'+profile);folder.mkdir()
    compiler=pins[pin]/'build/release/luau-compile';commands=[]
    def run(command,name):
        command=list(map(str,command));p=subprocess.run(command,capture_output=True,timeout=30)
        (folder/(name+'.stdout')).write_bytes(p.stdout);(folder/(name+'.stderr')).write_bytes(p.stderr)
        commands.append({'command':command,'exitCode':p.returncode,'stdout':name+'.stdout','stderr':name+'.stderr'})
        return p
    args=['--binary','-O'+profile[1],'-g'+profile[3]]
    original_compile=run([compiler,*args,work/'allocation.luau'],'original-compile')
    original_bc=folder/'original.luauc';original_bc.write_bytes(original_compile.stdout)
    original=run([hosts[pin],original_bc],'original')
    variants={}
    for label,dist in [('baseline',baseline),('candidate',candidate)]:
        decompiled=run([node,dist/'cli.js','decompile',original_bc],label+'-decompile')
        source=folder/(label+'.luau');source.write_bytes(decompiled.stdout)
        compiled=run([compiler,*args,source],label+'-compile')
        bc=folder/(label+'.luauc');bc.write_bytes(compiled.stdout)
        actual=run([hosts[pin],bc],label+'-actual')
        variants[label]={'match':original_compile.returncode==original.returncode==decompiled.returncode==compiled.returncode==actual.returncode==0 and actual.stdout==original.stdout and actual.stderr==original.stderr,'stdout':actual.stdout.decode(),'codes':[decompiled.returncode,compiled.returncode,actual.returncode],'sourceSha256':sha(source)}
    (folder/'commands.json').write_text(json.dumps(commands,indent=2)+'\n')
    return {'pin':pin,'profile':profile,'originalBytecodeSha256':sha(original_bc),'originalStdout':original.stdout.decode(),'variants':variants}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    rows=list(pool.map(check,[(pin,f'O{o}g{g}') for pin in pins for o in range(3) for g in [1,2]]))
summary={'kind':'independent-closure-name-allocation-review','sourceSha256':sha(work/'allocation.luau'),'hostSourceSha256':sha(work/'run-bytecode.cpp'),'pins':receipts,'rows':rows}
(work/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
