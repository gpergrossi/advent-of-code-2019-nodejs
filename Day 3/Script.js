// Certain variables are present in a NodeJS module:
// e.g. module, console, process
//
// 'module.require' is valid, but so is simply 'require'.
// The "module." part only serves to differentiate that 
// 'require' method from another one that could exist.

const fs = require('fs');
const readline = require('readline');
const assert = require('assert');

// Class "WireSegment"
function WireSegment(x, y, code) {
   this.direction = code.charAt(0);
   this.length = parseInt(code.substring(1));
   this.x = x;
   this.y = y;
   
   if (this.direction == 'U') {
      this.dx = 0;
      this.dy = -1;
   } else if (this.direction == 'D') {
      this.dx = 0;
      this.dy = 1;
   } else if (this.direction == 'L') {
      this.dx = -1;
      this.dy = 0;
   } else if (this.direction == 'R') {
      this.dx = 1;
      this.dy = 0;
   }
   
   if (this.dx >= 0) {
      this.x0 = x;
      this.x1 = x + this.dx * this.length;
   } else {
      this.x0 = x + this.dx * this.length;
      this.x1 = x;
   }
   
   if (this.dy >= 0) {
      this.y0 = y;
      this.y1 = y + this.dy * this.length;
   } else {
      this.y0 = y + this.dy * this.length;
      this.y1 = y;
   }
}

WireSegment.prototype.toString = function() {
   return "[" + this.x0 + "," + this.y0 + "][" + this.x1 + "," + this.y1 + "]";
}

WireSegment.prototype.hasPoint = function(x, y) {
   return (x >= this.x0) && (x <= this.x1) && (y >= this.y0) && (y <= this.y1);
}

WireSegment.prototype.intersect = function*(other) {
   if (this.x1 < other.x0) return undefined;
   if (this.x0 > other.x1) return undefined;
   if (this.y1 < other.y0) return undefined;
   if (this.y0 > other.y1) return undefined;
   var x0 = Math.max(this.x0, other.x0);
   var x1 = Math.min(this.x1, other.x1);
   var y0 = Math.max(this.y0, other.y0);
   var y1 = Math.min(this.y1, other.y1);
   for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
         yield {x: x, y: y};
      }
   }
}

WireSegment.prototype.points = function*() {
   for (let i = 0; i <= this.length; i++) {
      yield {x: (this.x + i * this.dx), y: (this.y + i * this.dy)};
   }
}
// End of Class "WireSegment"

// Class "Wire"
function Wire(code) {
   this.currentX = 0;
   this.currentY = 0;
   this.segments = [];
   
   var parts = code.split(',');
   for (let part of parts) {
      var segment = new WireSegment(this.currentX, this.currentY, part);
      this.currentX += segment.dx * segment.length;
      this.currentY += segment.dy * segment.length;
      this.segments.push(segment);
   }
}

Wire.prototype.hasPoint = function(x, y) {
   for (let segment of segments) {
      if (segment.hasPoint(x, y)) return true;
   }
   return true;
}

Wire.prototype.intersect = function*(other) {
   for (let seg0 of this.segments) {
      for (let seg1 of other.segments) {
         const iterator = seg0.intersect(seg1);
         var item;
         while (!(item = iterator.next()).done) {
            yield item.value;
         }
      }
   }
}

Wire.prototype.points = function*() {
   var lastPt = null;
   for (let seg of this.segments) {
      const iterator = seg.points();
      var item;
      while (!(item = iterator.next()).done) {
         if (lastPt === null || item.value.x != lastPt.x || item.value.y != lastPt.y) {
            lastPt = item.value;
            yield item.value;
         }
      }
   }
}

Wire.prototype.indexOf = function(x, y) {
   const iterator = this.points();
   var item;
   var index = 0;
   while (!(item = iterator.next()).done) {
      if (item.value.x == x && item.value.y == y) {
         return index;
      }
      index++;
   }
   return -1;
}
// End of Class "Wire"

main();

function main() {
   var readInterface = readline.createInterface({
      input: fs.createReadStream('Input.txt'),
      output: process.stdout,
      terminal: false
   });

   var wires = [];

   readInterface.on('line', function(line) {
      wires.push(new Wire(line));
   });
   
   readInterface.on('close', function() {
      console.log("Answer 1 = " + getClosestIntersectionByManhattan(wires));
      
      assert.strictEqual(610, getClosestIntersectionByWireLength([new Wire("R75,D30,R83,U83,L12,D49,R71,U7,L72"), new Wire("U62,R66,U55,R34,D71,R55,D58,R83")]));
      assert.strictEqual(410, getClosestIntersectionByWireLength([new Wire("R98,U47,R26,D63,R33,U87,L62,D20,R33,U53,R51"), new Wire("U98,R91,D20,R16,D67,R40,U7,R15,U6,R7")]) );
      console.log("Answer 2 = " + getClosestIntersectionByWireLength(wires));
   });
}

function getClosestIntersectionByManhattan(wires) {
   const iterator = wires[0].intersect(wires[1]);
   let closest = undefined;
   let item;
   while (!(item = iterator.next()).done) {
      let distance = Math.abs(item.value.x) + Math.abs(item.value.y);
      if (distance > 0) {
         if (closest == undefined || distance < closest) {
            closest = distance;
         }
      }
   }
   return closest;
}

function getClosestIntersectionByWireLength(wires) {
   const iterator = wires[0].intersect(wires[1]);
   let closest = undefined;
   let item;
   while (!(item = iterator.next()).done) {
      
      var wireLen0 = wires[0].indexOf(item.value.x, item.value.y);
      var wireLen1 = wires[1].indexOf(item.value.x, item.value.y);
      
      let distance = wireLen0 + wireLen1;
      if (distance > 0) {
         if (closest == undefined || distance < closest) {
            closest = distance;
         }
      }
   }
   return closest;
}