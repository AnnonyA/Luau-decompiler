from pathlib import Path
import concurrent.futures,hashlib,json,shutil,subprocess
work=Path('/workspace/scratch/1c4124dc88e4/closure-name-review');root=work.parent;refs=Path('/workspace/scratch/eb5e4be57451')
node='/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node';candidate=work/'no-table-engine-dist'
shutil.copytree(root/'engine-regions/dist',candidate)
pins={'9d':refs/'reference-luau-ci','c875':refs/'reference-luau'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
(work/'no-table-engine-snapshot.json').write_text(json.dumps({str(p.relative_to(candidate)):sha(p) for p in sorted(candidate.rglob('*.js'))},indent=2)+'\n')
first=json.loads((work/'summary.json').read_text())
def check(row):
    pin,profile=row['pin'],row['profile'];old=work/(pin+'-'+profile);folder=work/'no-table'/(pin+'-'+profile);folder.mkdir(parents=True)
    compiler=pins[pin]/'build/release/luau-compile';host=work/('run-bytecode-'+pin)
    commands=[]
    def run(command,name):
        command=list(map(str,command));p=subprocess.run(command,capture_output=True,timeout=30)
        (folder/(name+'.stdout')).write_bytes(p.stdout);(folder/(name+'.stderr')).write_bytes(p.stderr)
        commands.append({'command':command,'exitCode':p.returncode,'stdout':name+'.stdout','stderr':name+'.stderr'})
        return p
    bytecode=old/'original.luauc';assert sha(bytecode)==row['originalBytecodeSha256']
    original=run([host,bytecode],'original')
    decompiled=run([node,candidate/'cli.js','decompile',bytecode],'decompile')
    source=folder/'candidate.luau';source.write_bytes(decompiled.stdout)
    compiled=run([compiler,'--binary','-O'+profile[1],'-g'+profile[3],source],'compile')
    output=folder/'candidate.luauc';output.write_bytes(compiled.stdout)
    actual=run([host,output],'actual')
    (folder/'commands.json').write_text(json.dumps(commands,indent=2)+'\n')
    return {'pin':pin,'profile':profile,'originalValid':original.returncode==0,'match':original.returncode==decompiled.returncode==compiled.returncode==actual.returncode==0 and original.stdout==actual.stdout and original.stderr==actual.stderr,'codes':[original.returncode,decompiled.returncode,compiled.returncode,actual.returncode],'originalStdout':original.stdout.decode(),'candidateStdout':actual.stdout.decode(),'originalBytecodeSha256':sha(bytecode),'candidateSourceSha256':sha(source)}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(check,first['rows']))
summary={'kind':'same-originals-after-removal-of-table-wrapper','rows':rows,'originalValid':sum(row['originalValid'] for row in rows),'matches':sum(row['match'] for row in rows),'note':'Original O0 fixture assertion assumes cached identity and fails natively; first inputs preserved, these profiles are not passes.'}
(work/'no-table-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
