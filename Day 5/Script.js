"use strict";

const fs = require('fs');
const readline = require('readline');

//================================================================================
// Class "Computer"

function Computer(rom, input, output) {
   this.rom = [...rom];
   this.memory = [...rom];
   this.instructionPointer = 0;
   this.input = input;
   this.output = output;
}

Computer.prototype.reset = function() {
   this.memory = [...this.rom];
   this.instructionPointer = 0;
}

Computer.prototype.getValue = function(addr) {
   if (addr < 0 || addr >= this.memory.length) {
      throw new Error("Address out of range :" + addr + " at " + caller);
   }
   return this.memory[addr];
}

Computer.prototype.setValue = function(addr, value) {
   if (addr < 0 || addr >= this.memory.length) {
      throw new Error("Address out of range :" + addr + " at " + caller);
   }
   this.memory[addr] = value;
}

Computer.prototype.step = function(callback) {
   try {
      var instruction = new Instruction(this, this.instructionPointer);
      instruction.execute(callback);
   } catch (e) {
      console.log(e.message + " at instruction address " + this.instructionPointer);
      process.exit(1);
   }
};


Computer.prototype.execute = function(callback) {
   var computer = this;
   var continueCallback = function(result) {
      if (result.halt) {
         callback();
      } else {
         setImmediate(() => computer.step(continueCallback));
      }
   }
   this.step(continueCallback);
};

// End of Class "Computer"
//================================================================================
// Class "Instruction"

function Instruction(computer, address) {
   this.computer = computer;
   this.address = address;
   
   var value = computer.getValue(address);
   this.opCode = value % 100;
   
   this.parameterModes = Math.floor(value / 100);
}

Instruction.prototype.execute = function(callback) {
   var result = {
      halt: false
   };
   
   switch (this.opCode) {
      case 1:
         // Add
         var a = new Parameter(this, 0);
         var b = new Parameter(this, 1);
         var c = new Parameter(this, 2);
         c.setValue(a.getValue() + b.getValue());
         this.computer.instructionPointer += 4;
         setImmediate(() => callback(result));
         break;
         
      case 2: // Multiply
         var a = new Parameter(this, 0);
         var b = new Parameter(this, 1);
         var c = new Parameter(this, 2);
         c.setValue(a.getValue() * b.getValue());
         this.computer.instructionPointer += 4;
         setImmediate(() => callback(result));
         break;
         
      case 3: // Input
         var a = new Parameter(this, 0);
         this.computer.output.write("Program requests an integer:\n");
         var computer = this.computer;
         getIntegerInput(this.computer.input, this.computer.output, (response) => {
            a.setValue(response);
            computer.instructionPointer += 2;
            setImmediate(() => callback(result));
         });
         break;
         
      case 4: // Output
         var a = new Parameter(this, 0);
         this.computer.output.write("Program emits " + a.getValue() + "\n");
         this.computer.instructionPointer += 2;
         setImmediate(() => callback(result));
         break;
         
      case 5: // Jump if true
         var a = new Parameter(this, 0);
         var b = new Parameter(this, 1);
         if (a.getValue() != 0) {
            this.computer.instructionPointer = b.getValue();
         } else {
            this.computer.instructionPointer += 3;
         }
         setImmediate(() => callback(result));
         break;
         
      case 6: // Jump if false
         var a = new Parameter(this, 0);
         var b = new Parameter(this, 1);
         if (a.getValue() == 0) {
            this.computer.instructionPointer = b.getValue();
         } else {
            this.computer.instructionPointer += 3;
         }
         setImmediate(() => callback(result));
         break;
         
      case 7: // Less than
         var a = new Parameter(this, 0);
         var b = new Parameter(this, 1);
         var c = new Parameter(this, 2);
         if (a.getValue() < b.getValue()) {
            c.setValue(1);
         } else {
            c.setValue(0);
         }
         this.computer.instructionPointer += 4;
         setImmediate(() => callback(result));
         break;
         
      case 8: // Equals
         var a = new Parameter(this, 0);
         var b = new Parameter(this, 1);
         var c = new Parameter(this, 2);
         if (a.getValue() == b.getValue()) {
            c.setValue(1);
         } else {
            c.setValue(0);
         }
         this.computer.instructionPointer += 4;
         setImmediate(() => callback(result));
         break;
         
      case 99: // Halt
         result.halt = true;
         setImmediate(() => callback(result));
         break;
         
      default:
         throw new Error("Invalid op code " + this.opCode);
   }
   
}

// End of Class "Instruction"
//================================================================================
// Class "Parameter"

function Parameter(instruction, index) {
   this.computer = instruction.computer;
   this.instruction = instruction;
   this.index = index;
   
   var mode = instruction.parameterModes;
   for (let i = 0; i < index; i++) {
      mode = Math.floor(mode / 10);
   }
   mode = mode % 10;
   this.mode = mode;
}

Parameter.prototype.getValue = function() {
   switch (this.mode) {
      case 0: // Position mode (reference)
         var addr = this.computer.getValue(this.instruction.address + this.index + 1);
         return this.computer.getValue(addr);
         
      case 1: // Immediate mode
         return this.computer.getValue(this.instruction.address + this.index + 1);
                  
      default:
         throw new Error("Parameter " + this.index + " has invalid mode " + this.mode);
   }
}

Parameter.prototype.setValue = function(value) {
   switch (this.mode) {
      case 0: // Position mode (reference)
         var addr = this.computer.getValue(this.instruction.address + this.index + 1);
         return this.computer.setValue(addr, value);
         
      case 1: // Immediate mode
         throw new Error("Cannot write to an immediate mode parameter!");
                  
      default:
         throw new Error("Parameter " + this.index + " has invalid mode " + this.mode);
   }
}

// End of Class "Parameter"
//================================================================================

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
      var computer = new Computer(rom, process.stdin, process.stdout);
      computer.execute(() => {
         console.log("Program halted");
      });
   });
}

function getIntegerInput(input, output, callback) {
   const io = readline.createInterface({
     input: input,
     output: output
   });

   var inputCallback = function(response) {
      var value = parseInt(response, 10);
      if (isNaN(value) || (response != value)) {
         output.write("Invalid integer. Try again:\n");
         setImmediate(() => io.question('> ', inputCallback));
      } else {
         io.close();
         callback(value);
      }
   };
   io.question('> ', inputCallback);
}