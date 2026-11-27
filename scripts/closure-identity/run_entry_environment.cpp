#include "lua.h"
#include "lualib.h"
#include <fstream>
#include <sstream>
#include <iostream>
#include <cstdlib>
static void chk(lua_State* L,int rc){if(rc){std::cerr<<lua_tostring(L,-1)<<"\n";std::exit(2);}}
int main(int argc,char**argv){
if(argc!=2)return 1;
std::ifstream input(argv[1],std::ios::binary);std::ostringstream b;b<<input.rdbuf();std::string bytes=b.str();
lua_State*L=luaL_newstate();luaL_openlibs(L);chk(L,luau_load(L,argv[1],bytes.data(),bytes.size(),0));
const int f=lua_ref(L,-1);lua_getfenv(L,-1);const int envA=lua_ref(L,-1);lua_pop(L,2);
lua_newtable(L);const int envB=lua_ref(L,-1);lua_pop(L,1);
for(int e:{envA,envB,envA}){lua_getref(L,f);lua_getref(L,e);if(!lua_setfenv(L,-2))return 3;chk(L,lua_pcall(L,0,1,0));std::cout<<(lua_toboolean(L,-1)?"true":"false")<<"\n";lua_pop(L,1);}
lua_close(L);
}
