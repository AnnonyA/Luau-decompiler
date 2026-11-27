#include "lua.h"
#include "lualib.h"
#include "Luau/Common.h"
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>

int main(int argc, char** argv)
{
    if (argc < 2)
        return 2;
    for (Luau::FValue<bool>* flag = Luau::FValue<bool>::list; flag; flag = flag->next)
        if (std::strcmp(flag->name, "LuauIntegerLibrary") == 0)
            flag->value = true;
    std::ifstream in(argv[1], std::ios::binary);
    if (!in)
        return 2;
    const std::string bytecode((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    lua_State* state = luaL_newstate();
    luaL_openlibs(state);
    // This host capability is part of the custom-vector fixture's original
    // compiler/VM contract; the decompiler must not invent the alias itself.
    lua_getglobal(state, "vector");
    lua_getfield(state, -1, "create");
    lua_setglobal(state, "customVector");
    lua_pop(state, 1);
    luaL_sandbox(state);
    luaL_sandboxthread(state);
    if (luau_load(state, "=literal-fidelity", bytecode.data(), bytecode.size(), 0))
    {
        std::cerr << "load: " << lua_tostring(state, -1) << '\n';
        lua_close(state);
        return 3;
    }
    for (int i = 2; i < argc; ++i)
        lua_pushstring(state, argv[i]);
    int status = lua_pcall(state, argc - 2, 0, 0);
    if (status)
        std::cerr << "runtime: " << lua_tostring(state, -1) << '\n';
    lua_close(state);
    return status ? 4 : 0;
}
