"use strict";

const fs = require('fs');
const readline = require('readline');
const permutation = require('array-permutation');

//================================================================================
// Class "Computer"

function Computer(name, rom, input, output) {
   this.name = name;
   this.rom = [...rom];
   this.memory = [...rom];
   this.instructionPointer = 0;
   this.input = input;
   this.output = output;
   this.events = {};
   this.silent = false;
}

Computer.prototype.reset = function() {
   this._doEvent("reset");
   this.memory = [...this.rom];
   this.instructionPointer = 0;
}

Computer.prototype.getValue = function(addr) {
   if (addr < 0 || addr >= this.memory.length) {
      throw new Error("[" + this.name + "] Address out of range " + addr);
   }
   this._doEvent("getValue", addr);
   return this.memory[addr];
}

Computer.prototype.setValue = function(addr, value) {
   if (addr < 0 || addr >= this.memory.length) {
      throw new Error("[" + this.name + "] Address out of range " + addr);
   }
   this._doEvent("setValue", addr, value);
   this.memory[addr] = value;
}

Computer.prototype.step = function(callback) {
   this._doEvent('step');
   try {
      var instruction = new Instruction(this, this.instructionPointer);
      instruction.execute(callback);
   } catch (e) {
      e.message = "[" + this.name + "] " + e.message + " at instruction address " + this.instructionPointer;
      throw e;
   }
};

Computer.prototype.execute = function(callback) {
   var computer = this;
   var continueCallback = function(result) {
      if (result.halt) {
         computer._doEvent('halt');
         setImmediate(callback);
      } else {
         setImmediate(() => computer.step(continueCallback));
      }
   }
   this.step(continueCallback);
};

Computer.prototype.on = function(event, callback) {
   this.events[event] = callback;
};

Computer.prototype.println = function(string) {
   if (!this.silent) {
      this.output.write("[" + this.name + "] " + string + "\n");
   }
};

Computer.prototype.toString = function() {
   return this.name;
}

// Private

Computer.prototype._onOutput = function(value) {
   if (!this._doEvent("output", value)) {
      this.println("Program emits " + value);
   }
};

Computer.prototype._onRequestInput = function(callback) {
   if (!this._doEvent("requestInput", callback)) {
      this.println("Program requests an integer:");
      getIntegerInput(this.input, this.output, callback);
   }
   
};

Computer.prototype._doEvent = function(event, ...args) {
   if (typeof(this.events[event]) !== 'undefined') {
      this.events[event](...args);
      return true;
   }
   return false;
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
         var computer = this.computer;
         computer._onRequestInput((response) => {
            a.setValue(response);
            computer.instructionPointer += 2;
            setImmediate(() => callback(result));
         });
         break;
         
      case 4: // Output
         var a = new Parameter(this, 0);
         this.computer._onOutput(a.getValue());
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





// Main

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
   
   readInterface.on('close', async function() {
      let amps = createAmps(rom);
      
      connectAmpsLinear(amps);
      let largest = 0;      
      await asyncForEach(permutation(0, 5, 1), async function(permute) {
         let phaseSettings = permute;
         let result = await runAmps(amps, phaseSettings);
         if (result > largest) largest = result;
      });
      console.log("ANSWER 1 = " + largest);
      
      connectAmpsFeedback(amps);
      largest = 0;
      await asyncForEach(permutation(5, 10, 1), async function(permute) {
         let phaseSettings = permute;
         let result = await runAmps(amps, phaseSettings);
         if (result > largest) largest = result;
      });
      console.log("ANSWER 2 = " + largest);
   });
}





// Helper functions

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

async function asyncForEach(iterable, callback) {
   for (let item of iterable) {
      await callback(item);
   }
}

function createAmps(rom) {
   var amps = [];
   for (let i = 0; i < 5; i++) {
      let amp = new Computer("AMP" + (i+1), rom, process.stdin, process.stdout);
      
      amp.silent = true; // no printed output
      
      let resetCallback = function() {
         amp.println(">>>>> RESET <<<<<");
         amp.inputCount = 0;
         amp.seedInputs = [];
         amp.outputs = [];
         amp.awaitingOutputs = [];
      };
      resetCallback();
      
      amp.on('reset', resetCallback);
      
      amp.on('requestInput', (callback) => {
         amp.inputCount++;
         if (amp.inputCount <= amp.seedInputs.length) {
            var value = amp.seedInputs[amp.inputCount - 1];
            amp.println("Requested input, got " + value + " from seed input " + (amp.inputCount-1));
            setImmediate(() => callback(value));
         } else {
            if (amp.inputAmp == null) throw new Error("No input amp defined!");
            if (amp.inputAmp.outputs.length > 0) {
               var value = amp.inputAmp.outputs.pop();
               amp.println("Requested input, got " + value + " from " + amp.inputAmp);
               setImmediate(() => callback(value));
            } else {
               amp.inputAmp.awaitingOutputs.push((value) => {
                  amp.println("Requested input, got " + value + " from " + amp.inputAmp);
                  setImmediate(() => callback(value));
               });
            }
         }
      });
         
      amp.on('output', (value) => {
         amp.println("Program emits " + value);
         produceOutputFrom(amp, value);
      });
      
      amps[i] = amp;
   }
   
   return amps;
}

function connectAmpsLinear(amps) {
   for (let i = 0; i < 5; i++) {
      let amp = amps[i];
            
      if (i > 0) {
         amp.inputAmp = amps[i-1];
      } else {
         amp.inputAmp = null;
      }
   }
}

function connectAmpsFeedback(amps) {
   for (let i = 0; i < 5; i++) {
      let amp = amps[i];
            
      if (i > 0) {
         amp.inputAmp = amps[i-1];
      } else {
         amp.inputAmp = amps[4];
      }
   }
}

function requestInputFrom(amp, callback) {
   if (amp == null) throw new Error("Cannot request input from a null amp");
   if (amp.outputs.length > 0) {
      var value = amp.outputs.pop();
      callback(value);
   } else {
      amp.awaitingOutputs.push(callback);
   }
}

function produceOutputFrom(amp, value) {
   if (amp == null) throw new Error("Cannot produce output from a null amp");
   if (amp.awaitingOutputs.length > 0) {
      var callback = amp.awaitingOutputs.pop();
      callback(value);
   } else {
      amp.outputs.push(value);
   }
}

function runAmps(amps, phaseSettings) {   
   return new Promise((resolve, reject) => {
      for (let i in amps) {
         let amp = amps[i];
         amp.reset();
         if (i == 0) amp.seedInputs = [phaseSettings[0], 0];
         else amp.seedInputs = [phaseSettings[i]];
      }
      
      var lastAmp = amps[4];
      lastAmp.on('halt', () => {
         if (lastAmp.outputs.length > 0) {
            var value = lastAmp.outputs.pop();
            resolve(value);
         } else {
            reject(new Error("No output from " + lastAmp.name));
         }
      });
      
      for (let amp of amps) {
         amp.execute(() => { });
      }
   });
}