//================================================================================
// Class "Map"
"use strict";

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




var map = new Map();
// map = {};
// map.__proto = Map.prototype;


for (var i = 0; i < 10; i++) {
   for (var j = 0; j < 10; j++) {
      map.setTile(i, i+j, i*j + j);
   }
}

console.log(JSON.stringify(map));


var object12 = {};
object12[map] = 69;

console.log(Object.keys(object12));
console.log(object12.toString());

delete Object.getPrototypeOf(map).toString;
console.log(map.toString());