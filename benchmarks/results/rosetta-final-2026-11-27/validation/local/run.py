from pathlib import Path
import subprocess, os, time, json, concurrent.futures, threading, hashlib, datetime,re
cwd=Path('/workspace/scratch/eb5e4be57451/measurements/integrated-11-validation-engine')
out=Path('/workspace/scratch/eb5e4be57451/measurements/integrated-11-validation')
node=Path('/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node')
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=cwd,text=True).strip()
assert revision=='ff0275ea025f150d73aa29e10f3f2b7b0111907a'
summary={'revision':revision,'tree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=cwd,text=True).strip(),'initialStatus':subprocess.check_output(['git','status','--short'],cwd=cwd,text=True),'nodeVersion':subprocess.check_output([str(node),'--version'],text=True).strip(),'dependencyLockSha256':hashlib.sha256((cwd/'package-lock.json').read_bytes()).hexdigest(),'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'gates':[],'notRun':[{'gate':'demo-browser','reason':'Known unavailable local dependency: /usr/bin/chromium launcher exists but /usr/lib/chromium/chromium is missing. Prior frozen10 attempt returned npm1/browser127. Per root, did not repeat or install a browser; exact-head remote CI remains required.'},{'gate':'Node20 local rerun','reason':'Per root, Node20 is covered by required exact-head remote CI.'},{'gate':'Official pinned Luau and public-corpus CI','reason':'Delegated to exact-head remote CI; local reference pin differs and is not substituted.'}]}
lock=threading.Lock()
def save(): (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
def run(key,cmd):
    env=os.environ.copy();env['PATH']=str(node.parent)+os.pathsep+env['PATH'];name='node22-'+key;start=time.monotonic()
    with (out/(name+'.log')).open('w') as log:
        log.write('revision: '+revision+'\nnode: '+summary['nodeVersion']+'\ncommand: '+repr(cmd)+'\n\n');log.flush()
        process=subprocess.run(cmd,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT)
    item={'gate':key,'command':cmd,'exitCode':process.returncode,'seconds':round(time.monotonic()-start,3),'log':name+'.log'}
    text=(out/(name+'.log')).read_text()
    if key=='unit':
      match=re.search(r'Tests\s+(\d+) passed',text)
      if match:item['testsPassed']=int(match.group(1))
      match=re.search(r'Test Files\s+(\d+) passed',text)
      if match:item['testFilesPassed']=int(match.group(1))
    if key in ['bench-test','demo-test']:
      for field,pattern in [('testsPassed','pass'),('testsFailed','fail'),('testsSkipped','skipped')]:
        match=re.search(r'^# '+pattern+r' (\d+)$',text,re.M)
        if match:item[field]=int(match.group(1))
    with lock:summary['gates'].append(item);save()
    print(json.dumps(item),flush=True)
    return process.returncode
save()
if run('build',['npm','run','build'])==0:
    run('build-demo',['npm','run','build:demo'])
    commands=[('typecheck',['npm','run','typecheck']),('unit',['npm','test','--','--maxWorkers=2']),('bench-test',['npm','run','bench:test']),('bench-smoke',['npm','run','bench:compare','--','--output',str(out/'node22-baseline.json')]),('demo-test',['npm','run','demo:test'])]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda task:run(*task),commands))
summary['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();summary['finalStatus']=subprocess.check_output(['git','status','--short'],cwd=cwd,text=True);summary['allExecutedGatesPassed']=all(x['exitCode']==0 for x in summary['gates']);save()
print('VALIDATION_DONE '+str(summary['allExecutedGatesPassed']),flush=True)
