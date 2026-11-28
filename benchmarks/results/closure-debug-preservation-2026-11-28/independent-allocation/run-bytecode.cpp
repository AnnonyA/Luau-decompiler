#include "lua.h"
#include "lualib.h"
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>

// Stop collection after loading, before execution. gcinfo remains the
// standard official builtin; this only isolates allocation from GC timing.
int main(int argc, char** argv) {
    if (argc != 2) return 2;
    std::ifstream input(argv[1], std::ios::binary);
    if (!input) return 2;
    std::string bytecode((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
    lua_State* L = luaL_newstate();
    luaL_openlibs(L);
    luaL_sandbox(L);
    luaL_sandboxthread(L);
    if (luau_load(L, "=closure-name-review", bytecode.data(), bytecode.size(), 0)) {
        std::cerr << "load: " << lua_tostring(L, -1) << '\n';
        lua_close(L); return 3;
    }
    lua_gc(L, LUA_GCSTOP, 0);
    int status = lua_pcall(L, 0, 0, 0);
    if (status) std::cerr << "runtime: " << lua_tostring(L, -1) << '\n';
    lua_close(L);
    return status ? 4 : 0;
}
