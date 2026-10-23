local function run(flag)
 local get
 do local t=7;get=function() return t end;t=8 end
 local t={v=2}
 if flag then t={v=3} end
 print(get(),t.v)
end
run(true);run(false)