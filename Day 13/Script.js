"use strict";

const fs = require('fs');
const readline = require('readline');
const keypress = require('keypress');

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
// Class "Map"

function Map() {
   this.clear();
}

Map.prototype.clear = function() {
   this.minX = 1000;
   this.minY = 1000;
   this.maxX = -1000;
   this.maxY = -1000;
   this.tiles = [];
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

Map.prototype.countIf = function(predicate) {
   if (this.maxX <= this.minX || this.maxY <= this.minY) return 0;
   var count = 0;   
   for (let y = this.minY; y <= this.maxY; y++) {
      for (let x = this.minX; x <= this.maxX; x++) {
         let tile = this.getTile(x, y);
         if (predicate({x: x, y: y, id: tile})) {
            count++;
         }
      }
   }
   return count;
}

Map.prototype.find = function*(predicate) {
   if (this.maxX <= this.minX || this.maxY <= this.minY) return 0;
   var count = 0;   
   for (let y = this.minY; y <= this.maxY; y++) {
      for (let x = this.minX; x <= this.maxX; x++) {
         let id = this.getTile(x, y);
         let tile = {x: x, y: y, id: id};
         if (predicate(tile)) {
            yield tile;
         }
      }
   }
   return count;
}

Map.prototype.toString = function() {   
   if (this.maxX <= this.minX || this.maxY <= this.minY) return;
   let str = "";
   for (let y = this.minY; y <= this.maxY; y++) {
      for (let x = this.minX; x <= this.maxX; x++) {
         let tile = this.getTile(x, y);
         if (tile == 0) str += " ";
         else if (tile == 1) str += "#";
         else if (tile == 2) str += "X";
         else if (tile == 3) str += "=";
         else if (tile == 4) str += "@";
         else if (tile == 5) str += ".";
         else str += "?";
      }
      str += "\n";
   }
   return str;
}

Map.prototype.clone = function() {
   var clone = new Map();
   for (let y = this.minY; y <= this.maxY; y++) {
      for (let x = this.minX; x <= this.maxX; x++) {
         let id = this.getTile(x, y);
         if (id != 0) {
            clone.setTile(x, y, id);
         }
      }
   }
   return clone;
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
      
      var mostRecentScore = 0;
      var batchedInputCollector = {
         x: 0, y: 0, id: 0, next: 0
      };
      batchedInputCollector.accept = function(value) {
         var me = batchedInputCollector;
         switch (me.next) {
            case 0: 
               me.x = value; 
               me.next = 1;
               break;
               
            case 1:
               me.y = value;
               me.next = 2;
               break;
               
            case 2:
               me.id = value; 
               
               if (me.x == -1 && me.y == 0) {
                  // Display score
                  mostRecentScore = me.id;
               } else {
                  map.setTile(me.x, me.y, me.id);
               }
               
               me.next = 0;
               break;
         }
      }      
      computer.on("output", batchedInputCollector.accept);
      
      // Run display game without tokens
      var answer1;
      await new Promise((done, error) => {
         computer.execute(() => {
            console.log(map.toString());
            answer1 = map.countIf((tile) => (tile.id == 2));
            console.log("ANSWER 1 = " + answer1);
            done();
         });
      });
      
      // Track ball position history for better display
      var ballHistory = [];
      var firstFrame = true;
      var ballX, ballY, ballDX, ballDY;
      var paddleX, paddleY;
      
      // Start keyboard input
      //var lastKey = null;
      //keypress(process.stdin);
      //process.stdin.on('keypress', function (ch, key) {
      //   process.stdin.pause();
      //   lastKey = key;
      //});
      //process.stdin.setRawMode(true);
      //process.stdin.resume();
      
      const EMPTY = 0;
      const WALL = 1;
      const BLOCK = 2;
      const PADDLE = 3;
      const BALL = 4;
      
      computer.on("requestInput", (callback) => {
         // Get info from board
         let ballResult = map.find((tile) => (tile.id == 4)).next().value;
         ballX = ballResult.x;
         ballY = ballResult.y;
         let paddleResult = map.find((tile) => (tile.id == 3)).next().value;
         paddleX = paddleResult.x;
         paddleY = paddleResult.y;
         if (firstFrame) {
            ballDX = 1;
            ballDY = 1;
            firstFrame = false;
         } else {
            let prevBall = ballHistory[ballHistory.length-1];
            ballDX = ballX - prevBall.x;
            ballDY = ballY - prevBall.y;
         }
      
         // Update ball history
         let ballResults = map.find((tile) => (tile.id == 4));
         for (let ball of ballResults) {
            ballHistory.push(ball);
            if (ballHistory.length > 3) ballHistory.shift();
         }
         
         // Predict next ball position
         let workingMap = map.clone();
         let workingBallX = ballX;
         let workingBallY = ballY;
         let workingBallDX = ballDX;
         let workingBallDY = ballDY;
         while (workingBallY < paddleY-1) {
            let moved = false;
            while (!moved) {
               let horizontalObstacle = workingMap.getTile(workingBallX + workingBallDX, workingBallY);
               let verticalObstacle = workingMap.getTile(workingBallX, workingBallY + workingBallDY);
               let diagonalObstacle = workingMap.getTile(workingBallX + workingBallDX, workingBallY + workingBallDY);
               
               if (horizontalObstacle == WALL || horizontalObstacle == BLOCK || horizontalObstacle == PADDLE) {
                  if (horizontalObstacle == BLOCK) {
                     workingMap.setTile(workingBallX + workingBallDX, workingBallY, EMPTY);
                  }
                  workingBallDX = -workingBallDX;
               } else if (verticalObstacle == WALL || verticalObstacle == BLOCK || verticalObstacle == PADDLE) {
                  if (verticalObstacle == BLOCK) {
                     workingMap.setTile(workingBallX, workingBallY + workingBallDY, EMPTY);
                  }
                  workingBallDY = -workingBallDY;
               } else if (diagonalObstacle == WALL || diagonalObstacle == BLOCK || diagonalObstacle == PADDLE) {
                  if (diagonalObstacle == BLOCK) {
                     workingMap.setTile(workingBallX + workingBallDX, workingBallY + workingBallDY, EMPTY);
                  }
                  workingBallDX = -workingBallDX;
                  workingBallDY = -workingBallDY;
               } else {
                  workingBallX += workingBallDX;
                  workingBallY += workingBallDY;
                  moved = true;
               }
            }
         }
         
         // Render with ball history and future
         let renderingMap = map.clone();
         for (let ball of ballHistory) {
            if (renderingMap.getTile(ball.x, ball.y) == 0) {
               renderingMap.setTile(ball.x, ball.y, 5);
            }
         }
         if (renderingMap.getTile(workingBallX, workingBallY) == EMPTY) renderingMap.setTile(workingBallX, workingBallY, 5);
         if (renderingMap.getTile(workingBallX, paddleY) == EMPTY) renderingMap.setTile(workingBallX, paddleY, 5);
         console.log("Score: " + mostRecentScore + "\n" + renderingMap.toString());
         
         // Automatic mode
         if (paddleX < workingBallX) {
            setTimeout(() => { callback(1); }, 10);
         } else if (paddleX > workingBallX) {
            setTimeout(() => { callback(-1); }, 10);
         } else {
            setTimeout(() => { callback(0); }, 10);
         }
         
         // Wait for arrow key input
         //console.log("Play with arrow keys. Left/Right to move, anything else to stay put");
         //lastKey = null;
         //process.stdin.resume();
         //var timer = setInterval(() => {
         //   if (lastKey !== null) {
         //      if (lastKey.ctrl && lastKey.name == 'c') {
         //         process.exit(1);
         //      } else if (lastKey.name == 'left') {
         //         clearInterval(timer);
         //         callback(-1);
         //      } else if (lastKey.name == 'right') {
         //         clearInterval(timer);
         //         callback(1);
         //      } else {
         //         clearInterval(timer);
         //         callback(0);
         //      }
         //   } else {
         //      process.stdin.resume();
         //   }
         //}, 500);
      });
      
      // Reset game
      map.clear();
      mostRecentScore = 0;
      computer.reset();
      
      // Add tokens
      computer.setValue(0, 2);
      
      // Start next game
      await new Promise((done, error) => {
         computer.execute(() => {
            if (map.countIf((tile) => (tile.id == 2)) == 0) {
               console.log("Winner!");
               console.log("ANSWER 1 = " + answer1);
               console.log("ANSWER 2 = " + mostRecentScore);
            }
            else
            {
               console.log("Try again.");
            }
            done();
         });
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