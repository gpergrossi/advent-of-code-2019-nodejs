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
   this.relativeModeBase = 0;
}

Computer.prototype.reset = function() {
   this._doEvent("reset");
   this.memory = [...this.rom];
   this.instructionPointer = 0;
   this.relativeModeBase = 0;
}

Computer.prototype.getValue = function(addr) {
   if (addr < 0) {
      throw new Error("[" + this.name + "] Address out of range " + addr);
   }
   this._doEvent("getValue", addr);
   if (addr >= this.memory.length) return 0;
   return this.memory[addr];
}

Computer.prototype.setValue = function(addr, value) {
   if (addr < 0) {
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
         
      case 9: // Adjust relative base
         var a = new Parameter(this, 0);
         this.computer.relativeModeBase += a.getValue();
         this.computer.instructionPointer += 2;
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
         
      case 2: // Relative mode
         var offset = this.computer.getValue(this.instruction.address + this.index + 1);
         return this.computer.getValue(this.computer.relativeModeBase + offset);
                  
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
                  
      case 2: // Relative mode
         var offset = this.computer.getValue(this.instruction.address + this.index + 1);
         return this.computer.setValue(this.computer.relativeModeBase + offset, value);
         
      default:
         throw new Error("Parameter " + this.index + " has invalid mode " + this.mode);
   }
}

// End of Class "Parameter"
//================================================================================
// Class "Robot"

function Robot(map) {
   this.map = map;
   this.x = 0;
   this.y = 0;
   this.direction = 0; // up
   this.state = 0;
}

Robot.prototype.requestOutput = function(callback) {
   if (this.state == 0) {
      var value = this.map.getTile(this.x, this.y);
      //console.log("Robot says tile (" + this.x + "," + this.y + ") is " + value);
      this.state = 1;
      callback(value);
   } else {
      throw new Error("not ready! robot can't provide tile color because it is in state " + this.state + "!");
   }
}

Robot.prototype.acceptInput = function(value) {
   switch (this.state) {
      case 0: // read colorDepth
         throw new Error("not ready! robot is waiting to provide the paint of its current tile!");
         break;
      
      case 1: // paint
         //console.log("Robot paints (" + this.x + "," + this.y + ") to " + value);
         this.map.setTile(this.x, this.y, value);
         this.state = 2;
         break;
      
      case 2: // turn
         if (value == 0) {
            //console.log("Robot turns left");
            this.direction -= 1;
            if (this.direction < 0) this.direction += 4;
         } else if (value == 1) {
            //console.log("Robot turns right");
            this.direction += 1;
            if (this.direction > 3) this.direction -= 4;
         }
         
         // then move
         switch (this.direction) {
            case 0: // up
               //console.log("Robot moves up");
               this.y -= 1;
               break;
               
            case 1: // right
               //console.log("Robot moves right");
               this.x += 1;
               break;
               
            case 2: // down
               //console.log("Robot moves down");
               this.y += 1;
               break;
            
            case 3: // left
               //console.log("Robot moves left");
               this.x -= 1;
               break;
         }
         
         this.state = 0;
         break;
   }
}

// End of Class "Robot"
//================================================================================
// Class "Map"

function Map() {
   this.minX = 1000;
   this.minY = 1000;
   this.maxX = -1000;
   this.maxY = -1000;
   this.tilesPainted = 0;
   this.tiles = [];
}

Map.prototype.setTile = function(x, y, value) {
   if (typeof(this.tiles[x]) === 'undefined') {
      this.tiles[x] = [];
   }
   if (typeof(this.tiles[x][y]) === 'undefined') {
      this.tilesPainted++;
   }
   this.tiles[x][y] = value;
   
   if (value != 0) {
      if (x > this.maxX) this.maxX = x;
      if (x < this.minX) this.minX = x;
      if (y > this.maxY) this.maxY = y;
      if (y < this.minY) this.minY = y;
   }
}

Map.prototype.getTile = function(x, y) {   
   if (typeof(this.tiles[x]) === 'undefined') {
      return 0;
   }
   if (typeof(this.tiles[x][y]) === 'undefined') {
      return 0;
   }
   return this.tiles[x][y];
}

Map.prototype.display = function() {   
   if (this.maxX > this.minX && this.maxY > this.minY) {
      
      for (let y = this.minY; y <= this.maxY; y++) {
         let str = "";
         for (let x = this.minX; x <= this.maxX; x++) {
            let tile = this.getTile(x, y);
            if (tile == 0) str += ".";
            else if (tile == 1) str += "#";
            else str += "?";
         }
         console.log(str);
      }
      
   }
}

// End of Class "Map"
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
      let computer = new Computer("CPU", rom, process.stdin, process.stdout)
      let map = new Map();
      let robot = new Robot(map);
      
      computer.on("output", (value) => {
         robot.acceptInput(value);
      });
      
      computer.on("requestInput", (callback) => {
         robot.requestOutput(callback);
      });
      
      await new Promise((resolve, error) => {
         computer.execute(() => {
            map.display();
            console.log("ANSWER 1 = " + map.tilesPainted);
            resolve();
         });
      });
      
      map = new Map();
      map.setTile(0, 0, 1);
      robot = new Robot(map);
      
      computer.reset();
      
      computer.on("output", (value) => {
         robot.acceptInput(value);
      });
      
      computer.on("requestInput", (callback) => {
         robot.requestOutput(callback);
      });
      
      computer.execute(() => {
         console.log("ANSWER 2:");
         map.display();
      });
      
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