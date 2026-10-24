local function run(n) local a={} for _,v in ipairs({4,3,2,1}) do repeat a[#a+1]=v v-=1 until v==0 end return table.concat(a,",") end
for i=0,6 do print(i,run(i)) end
