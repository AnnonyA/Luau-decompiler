#include "lua.h"
#include "lualib.h"
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

static void check(lua_State* L, int status) {
    if (status) { std::cerr << lua_tostring(L, -1) << '\n'; std::exit(2); }
}
static int keep(lua_State* L) {
    int ref = lua_ref(L, -1); lua_pop(L, 1); return ref;
}
static int call(lua_State* L, int chunk, int nargs, int value = 0) {
    lua_getref(L, chunk);
    if (nargs) lua_pushinteger(L, value);
    check(L, lua_pcall(L, nargs, 1, 0));
    if (!lua_isfunction(L, -1)) { std::cerr << "chunk must return function\n"; std::exit(3); }
    return keep(L);
}
static bool eq(lua_State* L, int a, int b) {
    lua_getref(L, a); lua_getref(L, b); bool result = lua_rawequal(L, -1, -2); lua_pop(L, 2); return result;
}
static void env(lua_State* L, int chunk, int envRef) {
    lua_getref(L, chunk); lua_getref(L, envRef);
    if (!lua_setfenv(L, -2)) { std::cerr << "setfenv failed\n"; std::exit(4); }
    lua_pop(L, 1);
}
int main(int argc, char** argv) {
    if (argc != 4) { std::cerr << "usage: repeat_bytecode BYTECODE OPT capture|env|recursive|mutate-cache|recursive-capture\n"; return 1; }
    std::ifstream in(argv[1], std::ios::binary);
    if (!in) { std::cerr << "cannot read bytecode\n"; return 1; }
    std::ostringstream ss; ss << in.rdbuf();
    int optimizationLevel = std::atoi(argv[2]);
    std::string bytecode = ss.str();
    lua_State* L = luaL_newstate(); luaL_openlibs(L);
    check(L, luau_load(L, argv[1], bytecode.data(), bytecode.size(), 0));
    int chunk = keep(L);
    lua_getref(L, chunk); lua_getfenv(L, -1); int originalEnv = keep(L); lua_pop(L, 1);
    lua_newtable(L); int alternateEnv = keep(L);
    std::string mode = argv[3];
    std::vector<int> f;
    if (mode == "capture" || mode == "recursive-capture") {
        for (int x : {1, 2, 2, 1}) f.push_back(call(L, chunk, 1, x));
    } else if (mode == "env" || mode == "recursive") {
        f.push_back(call(L, chunk, 0));
        env(L, chunk, alternateEnv);
        f.push_back(call(L, chunk, 0)); f.push_back(call(L, chunk, 0));
        env(L, chunk, originalEnv);
        f.push_back(call(L, chunk, 0));
    } else if (mode == "mutate-cache") {
        f.push_back(call(L, chunk, 0));
        env(L, f[0], alternateEnv);
        f.push_back(call(L, chunk, 0)); f.push_back(call(L, chunk, 0));
        env(L, f[0], originalEnv);
        f.push_back(call(L, chunk, 0));
    } else { std::cerr << "invalid mode\n"; return 1; }
    std::cout << "mode=" << mode << " O" << optimizationLevel << " load=once invocations=4\n";
    std::cout << std::boolalpha << "f1==f4 " << eq(L,f[0],f[3]) << " f2==f3 " << eq(L,f[1],f[2]) << " f1==f2 " << eq(L,f[0],f[1]) << '\n';
    lua_newtable(L);
    lua_getref(L,f[0]); lua_pushliteral(L,"cached"); lua_rawset(L,-3);
    for (size_t i=0; i<f.size(); ++i) {
        lua_getref(L,f[i]); lua_rawget(L,-2);
        std::cout << "key[f" << i+1 << "]=" << (lua_isnil(L,-1) ? "nil" : lua_tostring(L,-1)) << (i+1<f.size() ? " " : "\n");
        lua_pop(L,1);
    }
    lua_pop(L,1);
    if (mode=="capture") {
        for (int ref:f) { lua_getref(L,ref); check(L,lua_pcall(L,0,1,0)); std::cout << lua_tonumber(L,-1) << ' '; lua_pop(L,1); }
        std::cout << '\n';
    }
    if (mode=="recursive" || mode=="recursive-capture") {
        std::cout << "self=";
        for (int ref:f) { lua_getref(L,ref); check(L,lua_pcall(L,0,1,0)); lua_getref(L,ref); std::cout << bool(lua_rawequal(L,-1,-2)) << ' '; lua_pop(L,2); }
        std::cout << '\n';
        if (mode=="recursive-capture") {
            std::cout << "captured=";
            for (int ref:f) { lua_getref(L,ref); check(L,lua_pcall(L,0,2,0)); std::cout << lua_tonumber(L,-1) << ' '; lua_pop(L,2); }
            std::cout << '\n';
        }
    }
    lua_close(L);
}
