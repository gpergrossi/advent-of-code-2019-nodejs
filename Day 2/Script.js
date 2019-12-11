// Certain variables are present in a NodeJS module:
// e.g. module, console, process
//
// 'module.require' is valid, but so is simply 'require'.
// The "module." part only serves to differentiate that 
// 'require' method from another one that could exist.

const fs = require('fs');
const readline = require('readline');

// Class "Computer"
function Computer(rom) {
   this.rom = [...rom];
   this.memory = [...rom];
   this.instructionPointer = 0;
}

Computer.prototype.reset = function() {
   this.memory = [...this.rom];
   this.instructionPointer = 0;
}

Computer.prototype.checkRange = function(addr, caller) {
   if (addr < 0 || addr >= this.memory.length) {
      throw new Exception("Address out of range :" + addr + " at " + caller);
   }
};

Computer.prototype.getAddressParameter = function(paramIndex) {
   this.checkRange(this.instructionPointer + paramIndex + 1, "parameter " + paramIndex + " from address " + this.instructionPointer);
   var addr = this.memory[this.instructionPointer + paramIndex + 1];
   return addr;
};

Computer.prototype.getValueParameter = function(paramIndex) {
   var addr = this.getAddressParameter(paramIndex);
   this.checkRange(addr, "address referenced by parameter " + paramIndex + " from address " + this.instructionPointer);
   return this.memory[addr];
};

Computer.prototype.step = function() {
   this.checkRange(this.instructionPointer, "instruction pointer");
   var instruction = this.memory[this.instructionPointer];
      
   if (instruction == 1) {
      // Add
      var a = this.getValueParameter(0);
      var b = this.getValueParameter(1);
      var c_ptr = this.getAddressParameter(2);
      
      this.checkRange(c_ptr, "address referenced by parameter " + 2 + " from address " + this.instructionPointer);
      this.memory[c_ptr] = a + b;
      this.instructionPointer += 4;
      
      return 1;
   } else if (instruction == 2) {
      // Multiply
      var a = this.getValueParameter(0);
      var b = this.getValueParameter(1);
      var c_ptr = this.getAddressParameter(2);
      
      this.checkRange(c_ptr, "address referenced by parameter " + 2 + " from address " + this.instructionPointer);
      this.memory[c_ptr] = a * b;
      this.instructionPointer += 4;
      
      return 1;
   } else if (instruction == 99) {
      return 0;
   } else {
      throw new Exception("Invalid instruction " + instruction + " at programPointer " + this.instructionPointer);
   }
};


Computer.prototype.execute = function(address) {
   this.instructionPointer = address;
   while(this.step());
};
// End of Class "Computer"

main();

function main() {
   var readInterface = readline.createInterface({
      input: fs.createReadStream('Input.txt'),
      output: process.stdout,
      terminal: false
   });

   var rom = [];

   readInterface.on('line', function(line) {
      var parts = line.split(',');
      var values = parts.map(function(substr) {
         return parseInt(substr, 10);
      });
      rom = rom.concat(values);
   });
   
   readInterface.on('close', function() {
      var computer = new Computer(rom);
      
      var result = runProgram(computer, 12, 2);
      console.log("Answer 1 = " + result);
      
      for (let noun = 0; noun < 99; noun++) {
         for (let verb = 0; verb < 99; verb++) {
            result = runProgram(computer, noun, verb);
            if (result == 19690720) {
               console.log("Answer 2 = " + (noun*100+verb));
               process.exit(0);
            }
         }
      }
   });
}

function runProgram(computer, noun, verb) {
   computer.reset();
   computer.memory[1] = noun;
   computer.memory[2] = verb;
   computer.execute(0);
   return computer.memory[0];
}