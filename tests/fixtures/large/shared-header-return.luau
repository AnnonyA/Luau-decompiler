local function run(n) local x=0 for _,v in ipairs({3,4,5}) do while v>0 do if v==n then return x end x+=v v-=1 end x+=10 end return x end
for i=0,6 do print(i,run(i)) end
