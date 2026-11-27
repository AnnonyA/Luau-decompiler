#include "Luau/Compiler.h"
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
int main(int argc,char**argv){
 if(argc!=4){std::cerr<<"usage: compile_api SOURCE OPT OUT_BYTECODE\n";return 1;}
 std::ifstream in(argv[1],std::ios::binary);if(!in){std::cerr<<"cannot read source\n";return 1;}
 std::ostringstream ss;ss<<in.rdbuf();
 Luau::CompileOptions opt;opt.optimizationLevel=std::atoi(argv[2]);opt.debugLevel=2;
 std::string bytecode=Luau::compile(ss.str(),opt);
 std::ofstream out(argv[3],std::ios::binary);out.write(bytecode.data(),bytecode.size());
 if(!out){std::cerr<<"cannot write bytecode\n";return 1;}
 if(bytecode.empty()||bytecode[0]==0){std::cerr<<(bytecode.empty()?"empty bytecode":bytecode.substr(1))<<'\n';return 2;}
 return 0;
}
