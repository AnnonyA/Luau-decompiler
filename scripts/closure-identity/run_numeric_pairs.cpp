#include "lua.h"
#include "lualib.h"
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <iterator>
#include <limits>
#include <string>
#include <vector>

static void check(lua_State* L, int status) {
    if (status) { std::cerr << lua_tostring(L, -1) << '\n'; std::exit(2); }
}
static int keep(lua_State* L) { int ref = lua_ref(L, -1); lua_pop(L, 1); return ref; }
static bool equal(lua_State* L, int a, int b) {
    lua_getref(L, a); lua_getref(L, b);
    bool same = lua_rawequal(L, -1, -2); lua_pop(L, 2); return same;
}
static std::vector<int> activate(lua_State* L, int chunk, double value) {
    lua_getref(L, chunk); lua_pushnumber(L, value); check(L, lua_pcall(L, 1, 2, 0));
    if (!lua_isfunction(L, -2) || !lua_isfunction(L, -1)) {
        std::cerr << "chunk must return two functions\n"; std::exit(3);
    }
    std::vector<int> pair = {lua_ref(L, -2), lua_ref(L, -1)};
    lua_pop(L, 2); return pair;
}
static void printKeys(lua_State* L, int table, const std::vector<std::vector<int>>& pairs, int position) {
    for (const auto& pair : pairs) {
        lua_getref(L, table); lua_getref(L, pair[position]); lua_rawget(L, -2);
        std::cout << (lua_isnil(L, -1) ? "nil" : lua_tostring(L, -1)) << ' ';
        lua_pop(L, 2);
    }
    std::cout << '\n';
}
int main(int argc, char** argv) {
    if (argc != 3) { std::cerr << "usage: run_numeric_pairs BYTECODE one-nan-nan-one|nan-one-one-nan\n"; return 1; }
    const std::string sequence = argv[2];
    if (sequence != "one-nan-nan-one" && sequence != "nan-one-one-nan") return 1;
    std::ifstream input(argv[1], std::ios::binary); if (!input) return 1;
    const std::string bytes((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
    lua_State* L = luaL_newstate(); luaL_openlibs(L);
    // One load and one retained chunk for the complete four-activation sequence.
    check(L, luau_load(L, "=numeric-captures", bytes.data(), bytes.size(), 0));
    int chunk = keep(L);
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double first = sequence == "one-nan-nan-one" ? 1 : nan;
    const double other = sequence == "one-nan-nan-one" ? nan : 1;
    const std::vector<double> values = {first, other, other, first};
    std::vector<std::vector<int>> pairs;
    for (double value : values) pairs.push_back(activate(L, chunk, value));
    std::cout << std::boolalpha << "load=once activations=4 sequence=" << sequence << '\n';
    std::cout << "pair_eq ";
    for (const auto& pair : pairs) std::cout << equal(L, pair[0], pair[1]) << ' ';
    std::cout << "\nf1=f4 " << equal(L, pairs[0][0], pairs[3][0])
        << " f2=f3 " << equal(L, pairs[1][0], pairs[2][0])
        << " f1=f2 " << equal(L, pairs[0][0], pairs[1][0]) << '\n';
    lua_newtable(L);
    lua_getref(L, pairs[0][0]); lua_pushliteral(L, "first"); lua_rawset(L, -3);
    lua_getref(L, pairs[1][0]); lua_pushliteral(L, "second"); lua_rawset(L, -3);
    int keys = keep(L);
    std::cout << "keys_first "; printKeys(L, keys, pairs, 0);
    std::cout << "keys_second "; printKeys(L, keys, pairs, 1);
    std::cout << "values " << std::setprecision(17);
    bool valuesMatch = true;
    for (size_t i = 0; i < pairs.size(); ++i) for (int function : pairs[i]) {
        lua_getref(L, function); check(L, lua_pcall(L, 0, 1, 0));
        if (lua_type(L, -1) != LUA_TNUMBER) { std::cerr << "closure must return a number\n"; return 4; }
        double value = lua_tonumber(L, -1); lua_pop(L, 1);
        if (std::isnan(value)) std::cout << "nan "; else std::cout << value << ' ';
        valuesMatch = valuesMatch && (std::isnan(values[i]) ? std::isnan(value) : value == values[i]);
    }
    std::cout << "\nvalues_match " << valuesMatch << '\n';
    lua_close(L); return 0;
}
