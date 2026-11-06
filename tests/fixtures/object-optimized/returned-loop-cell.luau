local function seek(n)
 local x=0
 local function read() return x end
 for i=1,3 do
  x=i
  if i==n then return read end
 end
 x=9
 return read
end
for n=0,4 do local f=seek(n) print(n,f()) end