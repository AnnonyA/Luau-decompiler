#include "lua.h"
#include "lualib.h"
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>

// The fixture can replace the string receiver's actual method without
// changing any decompiler source or its observation protocol.
static int replaceFormat(lua_State* L) {
    luaL_checktype(L, 1, LUA_TFUNCTION);
    lua_getglobal(L, "string");
    int readonly = lua_getreadonly(L, -1);
    lua_setreadonly(L, -1, 0);
    lua_pushvalue(L, 1);
    lua_setfield(L, -2, "format");
    lua_setreadonly(L, -1, readonly);
    return 0;
}

int main(int argc, char** argv) {
    if (argc != 2) return 2;
    std::ifstream input(argv[1], std::ios::binary);
    if (!input) return 2;
    std::string bytecode((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
    lua_State* L = luaL_newstate();
    luaL_openlibs(L);
    lua_pushcfunction(L, replaceFormat, "replace_format");
    lua_setglobal(L, "replace_format");
    luaL_sandbox(L);
    luaL_sandboxthread(L);
    if (luau_load(L, "=format-interpolation", bytecode.data(), bytecode.size(), 0)) {
        std::cerr << "load: " << lua_tostring(L, -1) << '\n';
        lua_close(L); return 3;
    }
    int status = lua_pcall(L, 0, 0, 0);
    if (status) std::cerr << "runtime: " << lua_tostring(L, -1) << '\n';
    lua_close(L);
    return status ? 4 : 0;
}
