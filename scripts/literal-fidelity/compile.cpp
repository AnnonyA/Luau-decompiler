#include "Luau/Compiler.h"
#include "Luau/Common.h"
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>

int main(int argc, char** argv)
{
    if (argc != 5)
        return 2;
    std::ifstream in(argv[1], std::ios::binary);
    if (!in)
        return 2;
    const std::string source((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    Luau::CompileOptions options;
    options.optimizationLevel = std::atoi(argv[2]);
    options.debugLevel = 2;
    const std::string mode(argv[4]);
    if (mode == "integer")
    {
        bool found = false;
        for (Luau::FValue<bool>* flag = Luau::FValue<bool>::list; flag; flag = flag->next)
            if (std::strcmp(flag->name, "LuauIntegerType2") == 0)
            {
                flag->value = true;
                found = true;
            }
        if (!found)
            return 3;
    }
    else if (mode == "custom-vector")
        options.vectorCtor = "customVector";
    else if (mode != "vector")
        return 2;
    const std::string bytecode = Luau::compile(source, options);
    std::ofstream out(argv[3], std::ios::binary);
    out.write(bytecode.data(), bytecode.size());
    if (bytecode.empty() || bytecode[0] == 0)
    {
        std::cerr << (bytecode.empty() ? "empty bytecode" : bytecode.substr(1)) << '\n';
        return 4;
    }
    return out ? 0 : 2;
}
