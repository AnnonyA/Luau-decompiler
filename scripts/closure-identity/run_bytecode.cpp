#include "lua.h"
#include "lualib.h"
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
int main(int argc, char** argv) {
    if (argc < 2) { std::cerr << "usage: run_bytecode file.luac [string-argument ...]\n"; return 2; }
    std::ifstream in(argv[1], std::ios::binary);
    if (!in) { std::cerr << "cannot read bytecode\n"; return 2; }
    std::string bc((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    lua_State* L = luaL_newstate();
    luaL_openlibs(L);
    luaL_sandbox(L);
    luaL_sandboxthread(L);
    if (luau_load(L, "=identity-evidence", bc.data(), bc.size(), 0)) {
        std::cerr << "load: " << lua_tostring(L, -1) << '\n'; lua_close(L); return 3;
    }
    for (int i=2; i<argc; ++i) lua_pushstring(L, argv[i]);
    int status=lua_pcall(L, argc-2, 0, 0);
    if (status) std::cerr << "runtime: " << lua_tostring(L, -1) << '\n';
    lua_close(L);
    return status ? 4 : 0;
}
