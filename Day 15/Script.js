"use strict";

const fs = require('fs');
const readline = require('readline');
const Heap = require('heap');
const xxhash = require('js-xxhash');

const DIRECTION_UNDEFINED = 0;
const DIRECTION_UP = 1;
const DIRECTION_DOWN = 2;
const DIRECTION_LEFT = 3;
const DIRECTION_RIGHT = 4;

const TILE_UNKNOWN = 0;
const TILE_EMPTY = 1;
const TILE_WALL  = 2;
const TILE_VENT  = 3;
const TILE_START = 4;
const TILE_DROID = 5;
const TILE_EXPLORE = 6;

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

Computer.prototype.execute = function() {
   var computer = this;
   var continueCallback = function(result) {
      if (result.halt) {
         computer._doEvent('halt');
      } else {
         setImmediate(() => computer.step(continueCallback));
      }
   }
   this.step(continueCallback);
};

Computer.prototype.exit = function() {
   this._doEvent('halt');
}

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

const ROBOT_STATE_SEARCHING = 0;
const ROBOT_STATE_WALKING = 1;
const ROBOT_STATE_DONE = 2;
const ROBOT_STATE_MANUAL = 3;

function Robot(map) {
   this.map = map;
   this.x = 0;
   this.y = 0;
   this.direction = DIRECTION_UNDEFINED;
   this.standingOn = TILE_START;
   this.map.setTileValue(this.x, this.y, TILE_DROID);
   this.state = ROBOT_STATE_SEARCHING;
}

Robot.prototype.requestOutput = function(callback) {
   if (this.state === ROBOT_STATE_SEARCHING) {      
      // Identify reachable unknown tiles
      var explorePredicate = function(tile) {
         if (tile.getValue() != TILE_UNKNOWN) return false;
         if (isTileWalkable(tile.getNeighbor(-1,  0))) return true;
         if (isTileWalkable(tile.getNeighbor( 1,  0))) return true;
         if (isTileWalkable(tile.getNeighbor( 0, -1))) return true;
         if (isTileWalkable(tile.getNeighbor( 0,  1))) return true;
         return false;
      };
      var exploreTiles = Array.from(this.map.find(explorePredicate));
      
      // Find best tile to explore
      var originTile = this.map.getTile(0, 0);
      var robotTile = this.map.getTile(this.x, this.y);
      var bestScore = undefined;
      var bestExploreTile = undefined;
      for (let exploreTile of exploreTiles) {
         var originPath = this.map.getShortestPath(originTile, exploreTile, isTileWalkable);
         if (typeof(originPath) === 'undefined') continue;
         
         var robotPath = this.map.getShortestPath(robotTile, exploreTile, isTileWalkable);
         if (typeof(robotPath) === 'undefined') continue;
         
         var score = 2 * originPath.length + robotPath.length;
         
         if (typeof(bestScore) === 'undefined' || score < bestScore) {
            bestScore = score;
            bestExploreTile = exploreTile;
         }
      }
      
      // Select path to walk
      if (typeof(bestExploreTile) === 'undefined') {
         this.state = ROBOT_STATE_DONE;
      } else {
         this.state = ROBOT_STATE_WALKING;
         
         // Find path to desired tile
         var path = this.map.getShortestPath(robotTile, bestExploreTile, isTileWalkable);
         if (typeof(path) === 'undefined') throw new Error("No path to tile!");
         this.path = path;
         this.path.shift();
      }
   }
   
   if (this.state === ROBOT_STATE_WALKING) {
      if (typeof(this.path) === 'undefined') throw new Error("No path to follow!");
      
      var nextTile = this.path.shift();
      if (nextTile.x == (this.x + 1) && nextTile.y == this.y) {
         this.direction = DIRECTION_RIGHT;
         callback(this.direction);
      } else if (nextTile.x == (this.x - 1) && nextTile.y == this.y) {
         this.direction = DIRECTION_LEFT;
         callback(this.direction);
      } else if (nextTile.x == this.x && nextTile.y == (this.y + 1)) {
         this.direction = DIRECTION_DOWN;
         callback(this.direction);
      } else if (nextTile.x == this.x && nextTile.y == (this.y - 1)) {
         this.direction = DIRECTION_UP;
         callback(this.direction);
      } else {
         throw new Error("Cannot step to (" + nextTile.x + ", " + nextTile.y + ") from (" + this.x + ", " + this.y + ")!");
      }
      
      if (this.path.length == 0) {
         this.state = ROBOT_STATE_SEARCHING;
      }
   }

   if (this.state === ROBOT_STATE_DONE) {
      callback(0);
   }
   
   if (this.state === ROBOT_STATE_MANUAL) {
      // Manual mode
      console.log("Direction? (1 = up, 2 = down, 3 = left, 4 = right)");
      getIntegerInput(process.stdin, process.stdout, (value) => {
         this.direction = value;
         callback(value);
      }, 1, 4);
   }
}

Robot.prototype.acceptInput = function(value) {
   var dx = 0;
   var dy = 0;
   switch (this.direction) {
      case DIRECTION_UNDEFINED:
         throw new Error("Not ready! robot direction is not set!");
         break;
      case DIRECTION_UP:    dy = -1; break;
      case DIRECTION_DOWN:  dy = 1;  break;
      case DIRECTION_LEFT:  dx = -1; break;
      case DIRECTION_RIGHT: dx = 1;  break;
   }
   this.direction = 0;
   
   switch (value) {
      case 0: // hit a wall
         this.map.setTileValue(this.x + dx, this.y + dy, TILE_WALL);
         break;
      
      case 1: // moved forward
         this.map.setTileValue(this.x, this.y, this.standingOn);
         this.x += dx;
         this.y += dy;
         this.standingOn = this.map.getTileValue(this.x, this.y);
         if (this.standingOn === TILE_UNKNOWN) this.standingOn = TILE_EMPTY;
         this.map.setTileValue(this.x, this.y, TILE_DROID);
         break;
      
      case 2: // moved forward to vent
         this.map.setTileValue(this.x, this.y, this.standingOn);
         this.x += dx;
         this.y += dy;
         this.standingOn = TILE_VENT;
         this.map.setTileValue(this.x, this.y, TILE_DROID);
         break;
      
   }
}

// End of Class "Robot"
//================================================================================
// Class "TileMap"

function TileMap() {
   this.minX = 1000;
   this.minY = 1000;
   this.maxX = -1000;
   this.maxY = -1000;
   this.tiles = [];
}

TileMap.prototype.clear = function() {
   this.minX = 1000;
   this.minY = 1000;
   this.maxX = -1000;
   this.maxY = -1000;
   this.tiles = [];
}

TileMap.prototype.setTileValue = function(x, y, value) {
   if (typeof(this.tiles[x]) === 'undefined') {
      this.tiles[x] = [];
   }
   if (typeof(this.tiles[x][y]) === 'undefined') {
      //this.tilesPainted++;
   }
   this.tiles[x][y] = value;
   
   if (value != 0) {
      if (x > this.maxX) this.maxX = x;
      if (x < this.minX) this.minX = x;
      if (y > this.maxY) this.maxY = y;
      if (y < this.minY) this.minY = y;
   }
}

TileMap.prototype.getTileValue = function(x, y) {   
   if (typeof(this.tiles[x]) === 'undefined') {
      return 0;
   }
   if (typeof(this.tiles[x][y]) === 'undefined') {
      return 0;
   }
   return this.tiles[x][y];
}

TileMap.prototype.getTile = function(x, y) {   
   return new Tile(this, x, y);
}

TileMap.prototype.find = function*(predicate) {
   if (this.maxX < this.minX || this.maxY < this.minY) return 0;
   var count = 0;   
   for (let y = this.minY-1; y <= this.maxY+1; y++) {
      for (let x = this.minX-1; x <= this.maxX+1; x++) {
         let tile = this.getTile(x, y);
         if (predicate(tile)) {
            yield tile;
         }
      }
   }
   return count;
}

TileMap.prototype.getShortestPath = function(sourceTile, destinationTile, walkablePredicate) {
   const verbose = false;
   
   // Errors
   if (sourceTile.map !== destinationTile.map) {
      console.log(sourceTile.toString());
      console.log(destinationTile.toString());
      throw new Error("Cannot find path between tiles from different maps");
   }
   
   // Fast exit conditions
   if (destinationTile.equals(sourceTile)) return [sourceTile];
   if (destinationTile.equals(sourceTile.getNeighbor( 1,  0))) return [sourceTile, destinationTile];
   if (destinationTile.equals(sourceTile.getNeighbor(-1,  0))) return [sourceTile, destinationTile];
   if (destinationTile.equals(sourceTile.getNeighbor( 0,  1))) return [sourceTile, destinationTile];
   if (destinationTile.equals(sourceTile.getNeighbor( 0, -1))) return [sourceTile, destinationTile];
   
   // Prepare data stuctures
   var pathFindInfo = new PathFindInfo(this);
   var tilePriorityComparison = function(a, b) {
      var pathFindInfoA = pathFindInfo.get(a);
      var pathFindInfoB = pathFindInfo.get(b);
      var priorityA = (pathFindInfoA.srcDist + pathFindInfoA.dstDist);
      var priorityB = (pathFindInfoB.srcDist + pathFindInfoB.dstDist);
      
      var compare = priorityA - priorityB;
      if (compare != 0) return compare;
      
      return pathFindInfoA.dstDist - pathFindInfoB.dstDist;
   };
   var exploreHeap = new Heap(tilePriorityComparison);
   
   // Initialize search algorithm
   exploreHeap.push(sourceTile);
   var sourceTilepathFindInfo = pathFindInfo.get(sourceTile);
   sourceTilepathFindInfo.srcDist = 0;
   sourceTilepathFindInfo.dstDist = Tile.manhattanDistance(sourceTile, destinationTile);
   sourceTilepathFindInfo.inHeap = true;
      
   // Do A* search
   if (verbose) console.log("Searching for path from (" + sourceTile.x + ", " + sourceTile.y + ") to (" + destinationTile.x + ", " + destinationTile.y + ")...");
   while (!exploreHeap.empty()) {
      let exploreTile = exploreHeap.pop();
      let exploreTilePathFindInfo = pathFindInfo.get(exploreTile);
      exploreTilePathFindInfo.inHeap = false;
      exploreTilePathFindInfo.visited = true;
      
      if (verbose) console.log("Considering (" + exploreTile.x + ", " + exploreTile.y + ")...");
      
      let neighborTiles = [
         exploreTile.getNeighbor(-1,  0),
         exploreTile.getNeighbor( 1,  0),
         exploreTile.getNeighbor( 0, -1),
         exploreTile.getNeighbor( 0,  1)
      ];
      for (let neighborTile of neighborTiles) {
         let neighborPathFindInfo = pathFindInfo.get(neighborTile);
         
         // Skip unwalkable or out-of-bounds tiles except when they are the destination.
         if (!neighborTile.equals(destinationTile)) {
            // Is tile within map bounds?
            if (neighborTile.x < this.minX || neighborTile.x > this.maxX || neighborTile.y < this.minY || neighborTile.y > this.maxY) {
               if (verbose) console.log("   Neighbor (" + neighborTile.x + ", " + neighborTile.y + ") is beyond the map boundaries.");
               continue;
            }
            
            // Is tile walkable?
            if (neighborPathFindInfo.isWall || !walkablePredicate(neighborTile)) {
               neighborPathFindInfo.isWall = true;
               if (verbose) console.log("   Neighbor (" + neighborTile.x + ", " + neighborTile.y + ") is not walkable.");
               continue;
            }
         } else {
            if (verbose) console.log("   Neighbor (" + neighborTile.x + ", " + neighborTile.y + ") is destination!");
         }
         
         // Skip tiles that have been visited already
         if (neighborPathFindInfo.visited) {
            if (verbose) console.log("   Neighbor (" + neighborTile.x + ", " + neighborTile.y + ") has already been visited.");
            continue;
         }
         
         // Update neighbor path info.
         let heapChange = false;
         if (neighborPathFindInfo.hasPrevious) {
            if (exploreTilePathFindInfo.srcDist + 1 < neighborPathFindInfo.srcDist) {
               neighborPathFindInfo.previous = exploreTile;
               neighborPathFindInfo.srcDist = exploreTilePathFindInfo.srcDist + 1;
               heapChange = true;
               if (verbose) console.log("   Found shorter route to neighbor (" + neighborTile.x + ", " + neighborTile.y + ")!");
            } else {
               if (verbose) console.log("   Ignoring longer route to neighbor (" + neighborTile.x + ", " + neighborTile.y + ").");
            }
         } else {
            neighborPathFindInfo.hasPrevious = true;
            neighborPathFindInfo.previous = exploreTile;
            neighborPathFindInfo.srcDist = exploreTilePathFindInfo.srcDist + 1;
            neighborPathFindInfo.dstDist = Tile.manhattanDistance(neighborTile, destinationTile);
            heapChange = true;
            if (verbose) console.log("   Adding neighbor (" + neighborTile.x + ", " + neighborTile.y + ") to exploreHeap!");
         }
         
         // Add neighbor to heap (or update priority)
         if (heapChange) {
            if (neighborPathFindInfo.inHeap) {
               exploreHeap.updateItem(neighborTile);
            } else {
               exploreHeap.push(neighborTile);
               neighborPathFindInfo.inHeap = true;
            }
            if (verbose) console.log("   Heap updated.");
         }
      }
         
      // End?
      if (exploreTile.equals(destinationTile)) {
         if (verbose) console.log("Destination reached!");
         break;
      }
   }
   
   // Build path
   var path = [];
   var currTile = destinationTile;
   while (!currTile.equals(sourceTile)) {
      path.push(currTile);
      var currTilePathFindInfo = pathFindInfo.get(currTile);
      if (typeof(currTilePathFindInfo) !== 'undefined' && currTilePathFindInfo.hasPrevious) {
         currTile = currTilePathFindInfo.previous;
      } else {
         return undefined;
      }
   }
   path.push(currTile);
   
   return path.reverse();
}

TileMap.prototype.distanceMap = function(sourceTile, walkablePredicate) {
   const verbose = false;
   
   // Prepare data stuctures
   var pathFindInfo = new PathFindInfo(this);
   var tilePriorityComparison = function(a, b) {
      var pathFindInfoA = pathFindInfo.get(a);
      var pathFindInfoB = pathFindInfo.get(b);
      var priorityA = pathFindInfoA.srcDist;
      var priorityB = pathFindInfoB.srcDist;
      return priorityA - priorityB;
   };
   var exploreHeap = new Heap(tilePriorityComparison);
   
   // Initialize search algorithm
   exploreHeap.push(sourceTile);
   var sourceTilepathFindInfo = pathFindInfo.get(sourceTile);
   sourceTilepathFindInfo.srcDist = 0;
   sourceTilepathFindInfo.inHeap = true;
      
   // Do Dijkstra search
   if (verbose) console.log("Producing distance map from (" + sourceTile.x + ", " + sourceTile.y + ")...");
   while (!exploreHeap.empty()) {
      let exploreTile = exploreHeap.pop();
      let exploreTilePathFindInfo = pathFindInfo.get(exploreTile);
      exploreTilePathFindInfo.inHeap = false;
      exploreTilePathFindInfo.visited = true;
      
      if (verbose) console.log("Considering (" + exploreTile.x + ", " + exploreTile.y + ")...");
      
      let neighborTiles = [
         exploreTile.getNeighbor(-1,  0),
         exploreTile.getNeighbor( 1,  0),
         exploreTile.getNeighbor( 0, -1),
         exploreTile.getNeighbor( 0,  1)
      ];
      for (let neighborTile of neighborTiles) {
         let neighborPathFindInfo = pathFindInfo.get(neighborTile);
         
         // Is tile within map bounds?
         if (neighborTile.x < this.minX || neighborTile.x > this.maxX || neighborTile.y < this.minY || neighborTile.y > this.maxY) {
            if (verbose) console.log("   Neighbor (" + neighborTile.x + ", " + neighborTile.y + ") is beyond the map boundaries.");
            continue;
         }
         
         // Is tile already visited?
         if (neighborPathFindInfo.visited) {
            if (verbose) console.log("   Neighbor (" + neighborTile.x + ", " + neighborTile.y + ") has already been visited.");
            continue;
         }
         
         // Is tile walkable?
         if (neighborPathFindInfo.isWall || !walkablePredicate(neighborTile)) {
            neighborPathFindInfo.isWall = true;
            if (verbose) console.log("   Neighbor (" + neighborTile.x + ", " + neighborTile.y + ") is not walkable.");
            continue;
         }
         
         // Update neighbor path info.
         let heapChange = false;
         if (neighborPathFindInfo.hasPrevious) {
            if (exploreTilePathFindInfo.srcDist + 1 < neighborPathFindInfo.srcDist) {
               neighborPathFindInfo.previous = exploreTile;
               neighborPathFindInfo.srcDist = exploreTilePathFindInfo.srcDist + 1;
               heapChange = true;
               if (verbose) console.log("   Found shorter route to neighbor (" + neighborTile.x + ", " + neighborTile.y + ")!");
            } else {
               if (verbose) console.log("   Ignoring longer route to neighbor (" + neighborTile.x + ", " + neighborTile.y + ").");
            }
         } else {
            neighborPathFindInfo.hasPrevious = true;
            neighborPathFindInfo.previous = exploreTile;
            neighborPathFindInfo.srcDist = exploreTilePathFindInfo.srcDist + 1;
            heapChange = true;
            if (verbose) console.log("   Adding neighbor (" + neighborTile.x + ", " + neighborTile.y + ") to exploreHeap!");
         }
         
         // Add neighbor to heap (or update priority)
         if (heapChange) {
            if (neighborPathFindInfo.inHeap) {
               exploreHeap.updateItem(neighborTile);
            } else {
               exploreHeap.push(neighborTile);
               neighborPathFindInfo.inHeap = true;
            }
            if (verbose) console.log("   Heap updated.");
         }
      }
   }
   
   // Build output map
   var output = new TileMap();
   for (let x = this.minX-1; x <= this.maxX+1; x++) {
      for (let y = this.minY-1; y <= this.maxY+1; y++) {
         let pfi = pathFindInfo.get(this.getTile(x, y));
         if (pfi.visited) {
            output.setTileValue(x, y, pfi.srcDist + 1);
         }
      }
   }
   
   return output;
}

TileMap.prototype.toString = function() {
   const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
   return this.toStringWithStyle((tile) => {
      var value = tile.getValue();
      if (value == 0) {
         return " ";
      } else {
         return chars.charAt(((value - 1) & 63));
      }
   });
}

TileMap.prototype.toStringWithStyle = function(tileStyle) {   
   if (this.maxX < this.minX || this.maxY < this.minY) return;
   let str = "";
   for (let y = this.minY; y <= this.maxY; y++) {
      for (let x = this.minX; x <= this.maxX; x++) {
         let tile = this.getTile(x, y);
         str += tileStyle(tile);
      }
      str += "\n";
   }
   return str;
}

TileMap.prototype.hash = function() {
   var tiles = Array.of(this.find((tile) => (tile.getValue() != 0)));
   var buf = Buffer.alloc(4 * 3 * tiles.length);
   var pos = 0;
   for (let tile of tiles) {
      buf.writeInt32BE(tile.x, pos)
      buf.writeInt32BE(tile.y, pos+4)
      buf.writeInt32BE(tile.id, pos+8)
      pos += 12;
   }
   var hash = xxhash.xxHash32(buf, 0x1758E1AB);
   return hash;
}

TileMap.prototype.clone = function() {
   var clone = new TileMap();
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

// End of Class "TileMap"
//================================================================================
// Class "Tile"

function Tile(map, x, y) {
   this.map = map;
   this.x = x;
   this.y = y;
}

Tile.prototype.getNeighbor = function(dx, dy) {
   return new Tile(this.map, this.x + dx, this.y + dy);
};

Tile.prototype.getValue = function() {
   return this.map.getTileValue(this.x, this.y);
}

Tile.prototype.setValue = function(id) {
   return this.map.setTileValue(this.x, this.y, id);
}

Tile.manhattanDistance = function(tileA, tileB) {
   if (tileA.map !== tileB.map) return -1;
   var distX = Math.abs(tileA.x - tileB.x);
   var distY = Math.abs(tileA.y - tileB.y);
   return distX + distY;
}

Tile.prototype.hash = function() {
   var tiles = Array.of(this.find((tile) => (tile.getValue() != 0)));
   var buf = Buffer.alloc(12);
   buf.writeInt32BE(this.map.hash(), 0)
   buf.writeInt32BE(this.x, 4)
   buf.writeInt32BE(this.y, 8)
   var hash = xxhash.xxHash32(buf, 0x1758E1AB);
   return hash;
}

Tile.prototype.equals = function(other) {
   if (this.map !== other.map) return false;
   if (this.x !== other.x) return false;
   if (this.y !== other.y) return false;
   return true;
}

Tile.prototype.toString = function() {
   return "Tile[map=" + this.map.hash() + ", x=" + this.x + ", y=" + this.y + "]";
}

// End of Class "Tile"
//================================================================================
// End of Class "PathFindInfo"

function PathFindInfo(map) {
   this.minX = map.minX-1;
   this.maxX = map.maxX+1;
   this.minY = map.minY-1;
   this.maxY = map.maxY+1;
   this.width = this.maxX - this.minX + 1;
   this.height = this.maxY - this.minY + 1;
   
   var size = this.width * this.height;
   this.tiles = Array(size);
   for (let i = 0; i < size; i++) {
      this.tiles[i] = {
         visited: false,
         isWall: false,
         hasPrevious: false,
         previous: undefined,
         srcDist: undefined,
         dstDist: undefined,
         inHeap: false,
      };
   }
}

PathFindInfo.prototype.get = function(tile) {
   if (tile.x < this.minX || tile.x > this.maxX || tile.y < this.minY || tile.y > this.maxY) {
      return undefined;
   }
   var x = tile.x - this.minX;
   var y = tile.y - this.minY;
   return this.tiles[y * this.width + x];
};

// Class "PathFindInfo"
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
      let map = new TileMap();
      let robot = new Robot(map);
      
      computer.on("output", (value) => {
         robot.acceptInput(value);
      });
      
      computer.on("requestInput", (callback) => {
         console.log("============================\n" + map.toStringWithStyle(oxygenSystemTileStyle) + "----------------------------");
         robot.requestOutput((value) => {
            if (value == 0) {
               computer.exit();
            } else {
               callback(value);
            }
         });
      });
      
      await new Promise((resolve, error) => {
         computer.on("halt", () => {
            resolve();
         });
         computer.execute();
      });
      
      var start = map.find((tile) => (tile.getValue() == TILE_START)).next().value;
      var end = map.find((tile) => (tile.getValue() == TILE_VENT)).next().value;
      var path = map.getShortestPath(start, end, isTileWalkable);
      console.log("ANSWER 1 = " + (path.length - 1));
      
      var maxDist = 0;
      var distanceMap = map.distanceMap(end, isTileWalkable);
      var tiles = distanceMap.find((tile) => (tile.getValue() > 0));
      for (let tile of tiles) {
         if (tile.getValue()-1 > maxDist) {
            maxDist = tile.getValue()-1;
         }
      }
      console.log("============================\n" + distanceMap.toString() + "----------------------------");
      console.log("ANSWER 2 = " + maxDist);
   });
}





// Helper functions

function getIntegerInput(input, output, callback, min, max) {
   const io = readline.createInterface({
     input: input,
     output: output
   });

   var inputCallback = function(response) {
      var value = parseInt(response, 10);
      if (isNaN(value) || (response != value)) {
         output.write("Invalid integer. Try again:\n");
         setImmediate(() => io.question('> ', inputCallback));
      } else if (value < min || value > max) {
         output.write("Integer out of range [" + min + ", " + max + "]. Try again:\n");
         setImmediate(() => io.question('> ', inputCallback));
      } else {
         io.close();
         callback(value);
      }
   };
   io.question('> ', inputCallback);
}

function isTileWalkable(tile) {
   let id = tile.getValue();
   if (id == TILE_UNKNOWN) return false;
   if (id == TILE_EMPTY) return true;
   if (id == TILE_WALL) return false;
   return (id == TILE_DROID || id == TILE_START || id == TILE_VENT);
}

function oxygenSystemTileStyle(tile) {
   switch (tile.getValue()) {
      case TILE_UNKNOWN: return " ";
      case TILE_EMPTY:   return ".";
      case TILE_WALL:    return "#";
      case TILE_START:   return "@";
      case TILE_VENT:    return "$";
      case TILE_DROID:   return "D";
      case TILE_EXPLORE: return "?";
      default: return "!";
   }
}