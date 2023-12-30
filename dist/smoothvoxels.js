/**************************************\
*          Smooth Voxels               *
* Copyright (c) 2023 Samuel Van Egmond *
*           MIT License                *
*    https://smoothvoxels.glitch.me    *
\**************************************/

/* global AFRAME */
/* global THREE */

"use strict";

// =====================================================
// ../smoothvoxels/svox.js
// =====================================================

var SVOX = {
  colorManagement: true,
  showWarnings: true,
  clampColors: false,
  models : {},
};

// Material type constants
SVOX.MATSTANDARD = "standard";
SVOX.MATBASIC    = "basic";
SVOX.MATLAMBERT  = "lambert";
SVOX.MATPHONG    = "phong";
SVOX.MATPHYSICAL = "physical";
SVOX.MATMATCAP   = "matcap";
SVOX.MATTOON     = "toon";
SVOX.MATNORMAL   = "normal";

// Material resize constants
SVOX.BOUNDS = "bounds"; // Resize the bounds to fit the model
SVOX.FIT    = "fit";    // Resize the model to fit the bounds
SVOX.FILL   = "fill";   // Resize the model to fill the bounds

// Material lighting constants
SVOX.FLAT   = "flat";   // Flat shaded triangles
SVOX.QUAD   = "quad";   // Flat shaded quads
SVOX.SMOOTH = "smooth"; // Smooth shaded triangles
SVOX.BOTH   = "both";   // Smooth shaded, but flat shaded clamped / flattened

// Material side constants
SVOX.FRONT  = "front";  // Show only front side of the material
SVOX.BACK   = "back";   // Show only back side of the material
SVOX.DOUBLE = "double"; // Show both sides of the material

SVOX._FACES   = [ 'nx', 'px', 'ny', 'py', 'nz', 'pz'];

// Vertex numbering per side. 
// The shared vertices for side nx (negative x) and pz (positive z) indicated as example:
//
//           --------
//           |1    2|
//           |  py  |
//           |0    3|
//    -----------------------------
//    |1   [2|1]   2|1    2|1    2|    nx shares vertext 2 & 3 
//    |  nx  |  pz  |  px  |  nz  |
//    |0   [3|0]   3|0    3|0    3|    with vertex 1 & 0 of pz
//    -----------------------------
//           |1    2|
//           |  ny  |
//           |0    3|
//           --------

// Define the vertex offsets for each side.

SVOX._VERTICES = {
  nx: [ { x:0, y:0, z:0 },  
        { x:0, y:1, z:0 },  
        { x:0, y:1, z:1 },  
        { x:0, y:0, z:1 }  
      ],
  px: [ { x:1, y:0, z:1 },  
        { x:1, y:1, z:1 },  
        { x:1, y:1, z:0 },  
        { x:1, y:0, z:0 }  
      ],
  ny: [ { x:0, y:0, z:0 },  
        { x:0, y:0, z:1 },  
        { x:1, y:0, z:1 },  
        { x:1, y:0, z:0 }  
      ],
  py: [ { x:0, y:1, z:1 },  
        { x:0, y:1, z:0 },  
        { x:1, y:1, z:0 },  
        { x:1, y:1, z:1 }  
      ],
  nz: [ { x:1, y:0, z:0 },  
        { x:1, y:1, z:0 },  
        { x:0, y:1, z:0 },  
        { x:0, y:0, z:0 }  
      ],
  pz: [ { x:0, y:0, z:1 },  
        { x:0, y:1, z:1 },  
        { x:1, y:1, z:1 },  
        { x:1, y:0, z:1 }  
      ]
};

// The offsets per face

SVOX._FACEOFFSETS = {
  nx: { x:-1, y:0, z:0 },
  px: { x:+1, y:0, z:0 },
  ny: { x:0, y:-1, z:0 },
  py: { x:0, y:+1, z:0 },
  nz: { x:0, y:0, z:-1 },
  pz: { x:0, y:0, z:+1 }  
};

// Define the uv's for each face
// Textures can be shown on all sides of all voxels (allows scaling and rotating) 
// Or a cube texture, with the layout below, can be projected on all model sides (no scaling or rotating allowed) 
// NOTE: To cover a model, ensure that the model fits the voxel matrix, i.e has no empty voxels next to it 
//       (export the model to remove unused space).
//
//    0.0   0.25    0.5    0.75   1.0 u >
// 1.0 -----------------------------
//     |      |o     |      |      |
// v^  |      |  py  |      |  ny  |  
//     |      |      |      |o     |   
// 0.5 -----------------------------  
//     |      |      |      |      |
//     |  nx  |  pz  |  px  |  nz  |
//     |o     |      |     o|      |
// 0.0 -----------------------------
//
// See uvassigner for how this definition is used
// The order changes because of the sign, to ensure the u or v direction and the sign are 'compatible'.
// Note that the texture origin is voxel coordinate (0,0,0), so e.g. the nz and px side will differ when the scale does not 'fit' the model size
// Top, right, bottom and left are used to determine the adjacent voxel in that direction when looking straight at this face
SVOX._FACEUVDEFS = {                // ud & vd = direction, cubeu & cubev = cube offset
  nx: { order:[0,1,2,3], udir:'z', vdir:'y', uminbound:'minZ', vminbound:'minY', usign: 1, vsign: 1, cubeu:0.00, cubev:0.00, top:{ x: 0, y: 1, z: 0 }, right:{ x: 0, y: 0, z: 1 }, bottom:{ x: 0, y:-1, z: 0 }, left:{ x: 0, y: 0, z:-1 } },
  px: { order:[3,2,1,0], udir:'z', vdir:'y', uminbound:'maxZ', vminbound:'minY', usign:-1, vsign: 1, cubeu:0.50, cubev:0.00, top:{ x: 0, y: 1, z: 0 }, right:{ x: 0, y: 0, z: 1 }, bottom:{ x: 0, y:-1, z: 0 }, left:{ x: 0, y: 0, z:-1 } },
  ny: { order:[0,1,2,3], udir:'x', vdir:'z', uminbound:'minX', vminbound:'minZ', usign: 1, vsign: 1, cubeu:0.75, cubev:0.50, top:{ x: 0, y: 0, z: 1 }, right:{ x: 1, y: 0, z: 0 }, bottom:{ x: 0, y: 0, z:-1 }, left:{ x:-1, y: 0, z: 0 } },
  py: { order:[1,0,3,2], udir:'x', vdir:'z', uminbound:'minX', vminbound:'maxZ', usign: 1, vsign:-1, cubeu:0.25, cubev:0.50, top:{ x: 0, y: 0, z: 1 }, right:{ x: 1, y: 0, z: 0 }, bottom:{ x: 0, y: 0, z:-1 }, left:{ x:-1, y: 0, z: 0 } }, 
  nz: { order:[3,2,1,0], udir:'x', vdir:'y', uminbound:'maxX', vminbound:'minY', usign:-1, vsign: 1, cubeu:0.75, cubev:0.00, top:{ x: 0, y: 1, z: 0 }, right:{ x: 1, y: 0, z: 0 }, bottom:{ x: 0, y:-1, z: 0 }, left:{ x:-1, y: 0, z: 0 } },  
  pz: { order:[0,1,2,3], udir:'x', vdir:'y', uminbound:'minX', vminbound:'minY', usign: 1, vsign: 1, cubeu:0.25, cubev:0.00, top:{ x: 0, y: 1, z: 0 }, right:{ x: 1, y: 0, z: 0 }, bottom:{ x: 0, y:-1, z: 0 }, left:{ x:-1, y: 0, z: 0 } }  
};

// The neighboring voxels and their neighboring faces for quick ambient occlusion
SVOX._AONEIGHBORS = {
  nx: { top:{ x:-1, y: 1, z: 0, faces:['ny'] }, topRight:{ x:-1, y: 1, z: 1, faces:['ny','nz'] }, right:{ x:-1, y: 0, z: 1, faces:['nz'] }, bottomRight:{ x:-1, y:-1, z: 1, faces:['nz','py'] }, bottom:{ x:-1, y:-1, z: 0, faces:['py'] }, bottomLeft:{ x:-1, y:-1, z:-1, faces:['py','pz'] }, left:{ x:-1, y: 0, z:-1, faces:['pz'] },  topLeft:{ x:-1, y: 1, z:-1, faces:['pz','ny'] } },
  px: { top:{ x: 1, y: 1, z: 0, faces:['ny'] }, topRight:{ x: 1, y: 1, z:-1, faces:['ny','pz'] }, right:{ x: 1, y: 0, z:-1, faces:['pz'] }, bottomRight:{ x: 1, y:-1, z:-1, faces:['pz','py'] }, bottom:{ x: 1, y:-1, z: 0, faces:['py'] }, bottomLeft:{ x: 1, y:-1, z: 1, faces:['py','nz'] }, left:{ x: 1, y: 0, z: 1, faces:['nz'] },  topLeft:{ x: 1, y: 1, z: 1, faces:['nz','ny'] } },
  ny: { top:{ x: 0, y:-1, z: 1, faces:['nz'] }, topRight:{ x: 1, y:-1, z: 1, faces:['nz','nx'] }, right:{ x: 1, y:-1, z: 0, faces:['nx'] }, bottomRight:{ x: 1, y:-1, z:-1, faces:['nx','pz'] }, bottom:{ x: 0, y:-1, z:-1, faces:['pz'] }, bottomLeft:{ x:-1, y:-1, z:-1, faces:['pz','px'] }, left:{ x:-1, y:-1, z: 0, faces:['px'] },  topLeft:{ x:-1, y:-1, z: 1, faces:['px','nz'] } },
  py: { top:{ x: 0, y: 1, z:-1, faces:['pz'] }, topRight:{ x: 1, y: 1, z:-1, faces:['pz','nx'] }, right:{ x: 1, y: 1, z: 0, faces:['nx'] }, bottomRight:{ x: 1, y: 1, z: 1, faces:['nx','nz'] }, bottom:{ x: 0, y: 1, z: 1, faces:['nz'] }, bottomLeft:{ x:-1, y: 1, z: 1, faces:['nz','px'] }, left:{ x:-1, y: 1, z: 0, faces:['px'] },  topLeft:{ x:-1, y: 1, z:-1, faces:['px','pz'] } },
  nz: { top:{ x: 0, y: 1, z:-1, faces:['ny'] }, topRight:{ x:-1, y: 1, z:-1, faces:['ny','px'] }, right:{ x:-1, y: 0, z:-1, faces:['px'] }, bottomRight:{ x:-1, y:-1, z:-1, faces:['px','py'] }, bottom:{ x: 0, y:-1, z:-1, faces:['py'] }, bottomLeft:{ x: 1, y:-1, z:-1, faces:['py','nx'] }, left:{ x: 1, y: 0, z:-1, faces:['nx'] },  topLeft:{ x: 1, y: 1, z:-1, faces:['nx','ny'] } },
  pz: { top:{ x: 0, y: 1, z: 1, faces:['ny'] }, topRight:{ x: 1, y: 1, z: 1, faces:['ny','nx'] }, right:{ x: 1, y: 0, z: 1, faces:['nx'] }, bottomRight:{ x: 1, y:-1, z: 1, faces:['nx','py'] }, bottom:{ x: 0, y:-1, z: 1, faces:['py'] }, bottomLeft:{ x:-1, y:-1, z: 1, faces:['py','px'] }, left:{ x:-1, y: 0, z: 1, faces:['px'] },  topLeft:{ x:-1, y: 1, z: 1, faces:['px','ny'] } }
}

// Logging functions

/**
 * Log errors to the console and an optional div #svoxerrors (as in the playground)
 * @param {error} Error object with name and message
 */
SVOX.logError = function(error) {
  // Remove the __playground model name
  let errorText = error.name + ": " + error.message.replace('(__playground)', '').trim();
  let errorElement = document.getElementById('svoxerrors');
  if (errorElement)
    errorElement.innerHTML += errorText + '<br>';
  console.error(`SVOX ${errorText}`);    
};
  
/**
 * Log warnings to the console and an optional div #svoxwarnings (as in the playground)
 * @param {warning} warning object with name and message
 * @param {modelName} optional model name
 */
SVOX.logWarning = function(warning, modelName) {
  let warningText = warning.name + ": " + warning.message.replace('(__playground)', '').trim();
  if (this.showWarnings) {
    let warningElement = document.getElementById('svoxwarnings');
    if (warningElement)
      warningElement.innerHTML += warningText + '<br>';
  }
  console.warn(`SVOX ${modelName ? '(' + modelName + ') ' : ''}${warningText}`);
};

  
/**
 * Log info to the console
 * @param {info} info object with name and message
 * @param {modelName} optional model name
 */
SVOX.logInfo = function(info, modelName) {
  let infoText = info.name + ": " + info.message;
  console.info(`SVOX ${modelName ? '(' + modelName + ') ' : ''}${infoText}`);
};

// =====================================================
// ../smoothvoxels/model/planar.js
// =====================================================

/**
 * Planars are the representaions of origin, clamp and skip
 */
class Planar {

    /**
     * Parse a planar representation from a string.
     * @param {string} value The string containing the planar settings.
     * @returns {object} An object with the planar values.
     */
  static parse(value) {
    if (!value)
      return undefined;
    
    if (typeof value === 'object') {
      return {
        nx: value.nx,
         x: value.x,
        px: value.px,
        ny: value.ny,
         y: value.y,
        py: value.py,
        nz: value.nz,
         z: value.z,
        pz: value.pz,
        active: value.nx || value.x || value.px || value.ny || value.y || value.py || value.nz || value.z || value.pz
      };      
    }
    
    value = ' ' + (value || '').toLowerCase();
      
    if (value !== ' ' && !/^(?!$)(\s+(?:none|-x|x|\+x|-y|y|\+y|-z|z|\+z|\s))+\s*$/.test(value)) {
      throw {
        name: 'SyntaxError',
        message: `Planar expression '${value}' is only allowed to be 'none' or contain -x x +x -y y +y -z z +z.`
      };  
    }
    
    let none = value.includes('none');
    let planar = {
      nx: !none && value.includes('-x'),
       x: !none && value.includes(' x'),
      px: !none && value.includes('+x'),
      ny: !none && value.includes('-y'),
       y: !none && value.includes(' y'),
      py: !none && value.includes('+y'),
      nz: !none && value.includes('-z'),
       z: !none && value.includes(' z'),
      pz: !none && value.includes('+z')
    };
    planar.active = planar.nx || planar.x || planar.px || planar.ny || planar.y || planar.py || planar.nz || planar.z || planar.pz;
    return planar;
  }
  
  /**
   * Returns a planar as a string.
   * @param {object} planar The planar object.
   * @returns {string} The planar string.
   */ 
  static toString(planar) {
    if (!planar)
      return undefined;
   
    let result = '';
    if (planar.nx || planar.x || planar.px ||
        planar.ny || planar.y || planar.py ||
        planar.nz || planar.z || planar.pz ) {
      result +=  (planar.nx ? ' -x' : '') + (planar.x ? ' x' : '') + (planar.px ? ' +x' : '')
               + (planar.ny ? ' -y' : '') + (planar.y ? ' y' : '') + (planar.py ? ' +y' : '')
               + (planar.nz ? ' -z' : '') + (planar.z ? ' z' : '') + (planar.pz ? ' +z' : '');
    }
    else {
      result += 'none';
    }
      
    return result.trim();
  }  
  
  /**
   * Combines two planars.
   * @param {object} planar1 The first planar object.
   * @param {object} planar2 The first planar object.
   * @param {object} defaultPlanar The default returned when planar1 and planar2 are both not set.
   * @returns {object} An object with the combined planar values.
   */ 
  static combine(planar1, planar2, defaultPlanar) {
    if (!planar1 && !planar2)
      return defaultPlanar;
    if (!planar1)
      return planar2;
    if (!planar2)
      return planar1;
    if (planar1 === planar2)
      return planar1;
    let planar = {
      nx: planar1.nx || planar2.nx,
       x: planar1.x  || planar2.x,
      px: planar1.px || planar2.px,
      ny: planar1.ny || planar2.ny,
       y: planar1.y  || planar2.y,
      py: planar1.py || planar2.py,
      nz: planar1.nz || planar2.nz,
       z: planar1.z  || planar2.z,
      pz: planar1.pz || planar2.pz
    };
    planar.active = planar.nx || planar.x || planar.px || planar.ny || planar.y || planar.py || planar.nz || planar.z || planar.pz;
    return planar;
  }

}

// =====================================================
// ../smoothvoxels/model/boundingbox.js
// =====================================================

class BoundingBox {

  get size() { 
    if (this.minX > this.maxX)
      return { x:0, y:0, z:0};
    else
      return {
        x: this.maxX - this.minX + 1,
        y: this.maxY - this.minY + 1,
        z: this.maxZ - this.minZ + 1
      };
  }
  
  constructor(copyFrom) {
    if (copyFrom)
      this.copy(copyFrom);
    else
      this.reset();
  }
  
  isValid() {
    return this.minX <= this.maxX && this.minY <= this.maxY && this.minZ <= this.maxZ;
  }
  
  reset() {
    this.minX = Number.POSITIVE_INFINITY;
    this.minY = Number.POSITIVE_INFINITY;
    this.minZ = Number.POSITIVE_INFINITY;
    this.maxX = Number.NEGATIVE_INFINITY;
    this.maxY = Number.NEGATIVE_INFINITY;
    this.maxZ = Number.NEGATIVE_INFINITY;
  }

  set(x, y, z) {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.minZ = Math.min(this.minZ, z);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
    this.maxZ = Math.max(this.maxZ, z);
  }
  
  copy(boundingBox) {
    this.minX = boundingBox.minX;
    this.minY = boundingBox.minY;
    this.minZ = boundingBox.minZ;
    this.maxX = boundingBox.maxX;
    this.maxY = boundingBox.maxY;
    this.maxZ = boundingBox.maxZ;
  }
  
  getCenter() {
    if (this.isValid()) {
      return { 
        x: (this.minX + this.maxX) / 2,
        y: (this.minY + this.maxY) / 2,
        z: (this.minZ + this.maxZ) / 2
      }
    }
    else {
      return { x:0, y:0, z:0 };
    }
  }
        
  // End of class BoundingBox
}

// =====================================================
// ../smoothvoxels/model/voxelmatrix.js
// =====================================================

// =====================================================
// class Voxel
// =====================================================

/* Note, voxels only supports hexadecimal colors like #FFF or #FFFFFF*/
class Voxel {
  
  constructor(color, group) {
    this.color = color;
    this.material = color.material;
    this.faces = { };
    this.visible = true;
    this.group = group ?? color.material.group;
  }
  
  dispose() {
    this.color = null;
    this.material = null;
    this.faces = null;
  }
}

// =====================================================
// class VoxelMatrix
// =====================================================

class VoxelMatrix {
  
  get minX()  { return this.bounds.minX; }
  get minY()  { return this.bounds.minY; }
  get minZ()  { return this.bounds.minZ; }
  get maxX()  { return this.bounds.maxX; }
  get maxY()  { return this.bounds.maxY; }
  get maxZ()  { return this.bounds.maxZ; }
  
  get size() { 
    if (this.minX > this.maxX)
      return { x:0, y:0, z:0};
    else
      return {
        x: this.maxX - this.minX + 1,
        y: this.maxY - this.minY + 1,
        z: this.maxZ - this.minZ + 1
      };
  }
 
  get count() { return this._count; }
  
  constructor() {
    this.bounds = new BoundingBox();
    this._voxels = {};
    this._count = 0;
    this.prepareForWrite();
  }
  
  // Reset is used when reloading .vox files
  reset() {
    this.forEach(function(voxel) {
      voxel.reset;
    }, this, true);
    this.bounds.reset();
    this._voxels = {};
    this._count = 0;
  }
  
  setVoxel(x, y, z, voxel) {
    if (!(voxel instanceof Voxel))
     throw new Error("setVoxel requires a Voxel set to an existing color of a material of this model.");
    
    this.bounds.set(x, y, z);
    voxel.material.bounds.set(x, y, z);

    voxel.x = x;
    voxel.y = y;
    voxel.z = z;
    
    // Create the group if it does not yet exist
    let voxels = this._voxels[voxel.group.id];
    if (!voxels) {
      voxels = this._voxels[voxel.group.id] = [];
    }    
    
    let matrixId = ((x+1024) >> 4)+(((y+1024) >> 4)<<10)+(((z+1024)>>4)<<20);
    let matrix = voxels[matrixId];
    if (!matrix) {
      matrix = voxels[matrixId] = [];
    }
    let index = ((x+1024) & 15) + (((y+1024) & 15)<<4) + (((z+1024) & 15)<<8);
    if (!matrix[index]) {
      this._count++;
    }
    matrix[index] = voxel;
  }
   
  clearVoxel(x, y, z, groupId) {
    if (!groupId) {
      throw { name:'Error', message:'clearVoxel(x, y, z, groupId) must be called with a groupId' };
    } 
    
    let voxels = this._voxels[groupId];
    if (voxels) {
      let matrixId = ((x+1024) >> 4)+(((y+1024) >> 4)<<10)+(((z+1024)>>4)<<20);
      let matrix = voxels[matrixId];
      if (matrix) {
        let index = ((x+1024) & 15) + (((y+1024) & 15)<<4) + (((z+1024) & 15)<<8);
        if (matrix[index]) {
          this._count--;
          matrix[index] = null;
        }
      }
    }
  }
  
  getVoxel(x, y, z, groupId) {
    if (!groupId) {
      throw { name:'Error', message:'getVoxel(x, y, z, groupId) must be called with a groupId' };
    } 
    
    let voxels = this._voxels[groupId];
    if (voxels) {
      let matrixId = ((x+1024) >> 4)+(((y+1024) >> 4)<<10)+(((z+1024)>>4)<<20);
      let matrix = voxels[matrixId];
      if (matrix) {
        let index = ((x+1024) & 15) + (((y+1024) & 15)<<4) + (((z+1024) & 15)<<8);
        let voxel = matrix[index];
        if (voxel)
          return voxel;
      }
    }
    return null;
  }
  
  getVoxelForAnyGroup(x, y, z) {
    let matrixId = ((x+1024) >> 4)+(((y+1024) >> 4)<<10)+(((z+1024)>>4)<<20);
    let index = ((x+1024) & 15) + (((y+1024) & 15)<<4) + (((z+1024) & 15)<<8);
    for (const groupId in this._voxels) {
      let voxel = this._voxels[groupId]?.[matrixId]?.[index];
      if (voxel)
        return voxel;
    }
    return null;
  } 
      
  forEach(func, thisArg, visibleOnly = true) {
    let param = [];
    for (const groupId in this._voxels) {
      let voxels = this._voxels[groupId];
      for (let matrixId in voxels) {
        let matrix = voxels[matrixId];
        for (let index in matrix) {
          let voxel = matrix[index];
          if (voxel && (!visibleOnly || voxel.visible)) {
            param[0] = voxel;
            let stop = func.apply(thisArg, param);
            if (stop === true) return;
          }
        }
      }
    }
  }
  
  forEachInGroup(groupId, func, thisArg, visibleOnly = true) {
    let param = [];
    let voxels = this._voxels[groupId];
    for (let matrixId in voxels) {
      let matrix = voxels[matrixId];
      for (let index in matrix) {
        let voxel = matrix[index];
        if (voxel && (!visibleOnly || voxel.visible)) {
          param[0] = voxel;
          let stop = func.apply(thisArg, param);
          if (stop === true) return;
        }
      }
    }
  }  
  
  forEachInBoundary(func, thisArg) {
    let param = [];
    for (let z = this.bounds.minZ; z <= this.bounds.maxZ; z++) {
      for (let y = this.bounds.minY; y <= this.bounds.maxY; y++) {
        for (let x = this.bounds.minX; x <= this.bounds.maxX; x++) {
          for (const groupId in this._voxels) {         
            param[0] = this.getVoxel(x,y,z, groupId);
            if (param[0]) {
              let stop = func.apply(thisArg, param);
              if (stop === true) return;
              break;
            }
          }
          if (!param[0]) {
            let stop = func.apply(thisArg, param);
            if (stop === true) return;            
          }
          param[0] = null;
        }
      }
    }
  }
    
  prepareForWrite() {
    this.bounds.reset();
    this._count = 0;
    
    this.forEach(function overwriteVoxel(voxel) {
      // Overrwite all voxels to recalulate the bounding box and the count the voxels
      this.setVoxel(voxel.x, voxel.y, voxel.z, voxel);
      this._count++;
    }, this);  
  }
  
  // End of class VoxelMatrix
}

// =====================================================
// ../smoothvoxels/model/vertexmatrix.js
// =====================================================

// =====================================================
// class VertexMatrix
// =====================================================

class VertexMatrix {
  
  constructor(model) {
    this.model = model;
    this._vertices = {};
  }
  
  createVertex(voxel, faceName, vi) {
    // Calculate the actual vertex coordinates
    let vertexOffset = SVOX._VERTICES[faceName][vi];
    let x = voxel.x + vertexOffset.x;
    let y = voxel.y + vertexOffset.y;
    let z = voxel.z + vertexOffset.z;
       
    // Retrieve the material of the voxel to set the different material properties for the vertex
    let material = voxel.material;

    let flatten = this._isVertexPlanar(this.model.voxels, voxel, x, y, z, material.flatten, this.model.flatten);
    let clamp   = this._isVertexPlanar(this.model.voxels, voxel, x, y, z, material.clamp, this.model.clamp);
    
    // Create the vertex if it does not yet exist
    // Note: for clones the voxel group is the clone, but the material group the original, so use voxel.group!
    let vertex = this.getVertex(x, y, z, voxel.group.id);
    if (!vertex) {
      vertex = { x, y, z,
                 newX:0, newY:0, newZ:0, newSet:false,
                 links: [ ],
                 nrOfClampedLinks: 0,
                 group: voxel.group, 
                 colors: [ voxel.color ],
                 deform: material.deform,
                 warp: material.warp,
                 scatter: material.scatter,
                 flatten: flatten,
                 clamp: clamp,
                 equidistant: undefined,
                 faces: { },
                 type: SVOX.VNOTSET                  
               };
      vertex.faces[faceName] = true;  // for non manifold fix in normals calculator
      this._setVertex(x, y, z, vertex);
    }
    else {     
      vertex.colors.push(voxel.color);
      
      vertex.flatten.x = vertex.flatten.x || flatten.x;
      vertex.flatten.y = vertex.flatten.y || flatten.y;
      vertex.flatten.z = vertex.flatten.z || flatten.z;
      vertex.clamp.x   = vertex.clamp.x   || clamp.x;
      vertex.clamp.y   = vertex.clamp.y   || clamp.y;
      vertex.clamp.z   = vertex.clamp.z   || clamp.z;
      
      // Favour less deformation over more deformation
      if (!material.deform)
        vertex.deform = null;
      else if (vertex.deform &&
               (this._getDeformIntegral(material.deform) < this._getDeformIntegral(vertex.deform))) {
        vertex.deform = material.deform;
      }

      // Favour less / less requent warp over more warp
      if (!material.warp)
        vertex.warp = null;
      else if (vertex.warp &&
               ((material.warp.amplitude < vertex.warp.amplitude) ||
                (material.warp.amplitude === vertex.warp.amplitude && material.warp.frequency > vertex.warp.frequency))) {
        vertex.warp = material.warp;
      }

      // Favour less scatter over more scatter
      if (!material.scatter)
        vertex.scatter = null;
      else if (vertex.scatter &&
               Math.abs(material.scatter) < Math.abs(vertex.scatter)) {
        vertex.scatter = material.scatter;    
      }
      vertex.faces[faceName] = true;
    }

    return vertex; 
  } 
  
  _setVertex(x, y, z, vertex) {
    vertex.x = x;
    vertex.y = y;
    vertex.z = z;

    // Create the group if it does not yet exist
    let vertices = this._vertices[vertex.group.id];
    if (!vertices) {
      vertices = this._vertices[vertex.group.id] = [];
    }
    
    let matrixId = ((x+1024) >> 4)+(((y+1024) >> 4)<<10)+(((z+1024)>>4)<<20);
    let matrix = vertices[matrixId];
    if (!matrix) {
      matrix = vertices[matrixId] = [];
    }
    let index = ((x+1024) & 15) + (((y+1024) & 15)<<4) + (((z+1024) & 15)<<8);
    
    matrix[index] = vertex;
  }
  
  getVertex(x, y, z, groupId) {
    if (!groupId) {
      throw { name:'Error', message:'getVertex(x, y, z, groupId) must be called with a groupId' };
    }  
    
    let vertices = this._vertices[groupId];
    if (vertices) {
      let matrixId = ((x+1024) >> 4)+(((y+1024) >> 4)<<10)+(((z+1024)>>4)<<20);
      let matrix = vertices[matrixId];
      if (matrix) {
        let index = ((x+1024) & 15) + (((y+1024) & 15)<<4) + (((z+1024) & 15)<<8);
        return matrix[index];
      }
    }
    return null;
  }

  forEach(func, thisArg) {
    let param = [];
    for (const groupId in this._vertices) {
      let vertices = this._vertices[groupId];
      for (let matrixId in vertices) {
        let matrix = vertices[matrixId];
        for (let index in matrix) {
          param[0] = matrix[index];
          func.apply(thisArg, param);
        }
      }
    }
  }
 
  _isVertexPlanar(voxels, voxel, vx, vy, vz, materialPlanar, modelPlanar) {
    let material = voxel.material;  
    
    let planar = materialPlanar;
    let bounds = material.bounds;
    if (!planar) {
      planar = modelPlanar;
      bounds = voxels.bounds;
    }
    
    let result = { x:false, y:false, z:false};
    if (planar) {
      // Note bounds are in voxel coordinates and vertices add from 0 0 0 to 1 1 1
      result.x = planar.x || (planar.nx && vx < bounds.minX + 0.5) || (planar.px && vx > bounds.maxX + 0.5);
      result.y = planar.y || (planar.ny && vy < bounds.minY + 0.5) || (planar.py && vy > bounds.maxY + 0.5);
      result.z = planar.z || (planar.nz && vz < bounds.minZ + 0.5) || (planar.pz && vz > bounds.maxZ + 0.5);
    }
    
    return result;
  }  
  
  _getDeformIntegral(deform) {
    // Returns the total amount of deforming done by calculating the integral
    return (deform.damping === 1)
       ? deform.strength*(deform.count + 1)
       : (deform.strength*(1-Math.pow(deform.damping,deform.count+1)))/(1-deform.damping);
  }  
    
  // End of class VertexMatrix
}

// =====================================================
// ../smoothvoxels/model/texturelist.js
// =====================================================

class TextureList {
  
  constructor() {
    this._textures = [];
  }

  createTexture(settings, modelName) {
    if (!settings.id) {
      throw {
        name: 'SyntaxError',
        message: `(${modelName}) Mandatory property 'id' missing in texture`,
      };
    }    
    if (this._textures.find(t => t.id === settings.id)) {
      SVOX.logWarning({
        name: 'ModelWarning',
        message: `(${modelName}) Duplicate texture id '${settings.id}' found.`,
      });
    }    
  

    let texture = TextureReader.read(settings, modelName);
    this._textures.push(texture);

    return texture;
  }
  
  get length() {
    return this._textures.length;
  }
  
  getById(id) {
    let texture = this._textures.find(t => t.id === id);
    if (!texture) {
      throw {
        name: 'SyntaxError',
        message: `Texture with id '${id}' does not exist`,
      };
    }        
    return texture;
  }

  forEach(func, thisArg) {
    this._textures.forEach(func, thisArg);
  }
}

// =====================================================
// ../smoothvoxels/model/lightlist.js
// =====================================================

class LightList {
  
  constructor() {
    this._lights = [];
  }

  createLight(settings, modelName) {

    let light = LightReader.read(settings, modelName);
    this._lights.push(light);

    return light;
  }
  
  get length() {
    return this._lights.length;
  } 

  forEach(func, thisArg) {
    this._lights.forEach(func, thisArg);
  }
  
  get visible() {
    return this._lights.some((light) => light.size !== 0);
  }
}

// =====================================================
// ../smoothvoxels/model/grouplist.js
// =====================================================

class GroupList {
  
  constructor() {
    this._groups = [];    
  }

  createGroup(settings, modelName) {
    // In case this is a cloned group it may have bounds already, so remove those
    delete settings.bounds;
    delete settings.vertexBounds;
    
    let group = GroupReader.read(settings, modelName);

    if (this._groups.find(g => g.id === settings.id)) {
      throw {
        name: 'ModelError',
        message: `(${modelName}) Duplicate group id '${settings.id}' found.`,
      };
    }    
    group.bounds = new BoundingBox(); // Voxels
    group.vertexBounds = new BoundingBox(); // Warped, scatters and deformed vertices
    
    this._groups.push(group);

    return group;
  }
  
  get length() {
    return this._groups.length;
  }
  
  getById(id) {
    let group = this._groups.find(g => g.id === id);
    if (!group) {
      throw {
        name: 'SyntaxError',
        message: `Group with id '${id}' does not exist`,
      };
    }        
    return group;
    
  }
  
  sort() {
    this._groups.sort(function compare(a, b) { 
      if (!a.group) return -1;
      if (!b.group) return 1;
      if (a.id === b.group) return -1;
      if (a.group === b.id) return 1;
      return 0;
    });
  }
  
  removePrefabs() {
    this._groups = this._groups.filter(g => !g.prefab);
  }

  forEach(func, thisArg) {
    this._groups.forEach(func, thisArg);
  }
}

// =====================================================
// ../smoothvoxels/model/materiallist.js
// =====================================================

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

// =====================================================
// class Color
// =====================================================

/* Note, the Color class only supports hexadecimal colors like #FFF or #FFFFFF. */
/*       Its r, g and b members are stored as floats between 0 and 1.           */

class Color {

  // id is optional, and will then be generated on write
  static fromHex(hex, id) {
    let color = new Color();
    color._set(hex);
    
    // Vertex colors should be in lineair space 
    // See: https://www.donmccurdy.com/2020/06/17/color-management-in-threejs/
    if (false && SVOX.colorManagement) {
      color.r = this._SRGBToLinear(color.r);
      color.g = this._SRGBToLinear(color.g);
      color.b = this._SRGBToLinear(color.b);
    }
        
    color.id = id;
    color.exId = null; // Used for MagicaVoxel color index
    color.count = 0;
    
    return color;
  } 
  
  // r, g, b from 0 to 1 !!
  static fromRgb(r, g, b, id) {
    r = Math.round(clamp(r, 0, 1) * 255);
    g = Math.round(clamp(g, 0, 1) * 255);
    b = Math.round(clamp(b, 0, 1) * 255);
    let color = '#' +
                (r < 16 ? '0' : '') + r.toString(16) +
                (g < 16 ? '0' : '') + g.toString(16) +
                (b < 16 ? '0' : '') + b.toString(16);
    return Color.fromHex(color, id);
  } 
  
  clone() {
    let clone = new Color();
    clone._color = this._color;
    clone.r = this.r;
    clone.g = this.g;
    clone.b = this.b;
    clone._material = this._material;
    return clone;
  }
  
  multiply(factor) {
    if (factor instanceof Color)
      return Color.fromRgb(this.r*factor.r, this.g*factor.g, this.b*factor.b);
    else
      return Color.fromRgb(this.r*factor, this.g*factor, this.b*factor);
  }
  
  normalize() {
    let d = Math.sqrt(this.r*this.r + this.g*this.g + this.b*this.b);
    return this.multiply(1/d);
  }
  
  add(...colors) {
    let r = this.r + colors.reduce((sum, color) => sum + color.r, 0);
    let g = this.g + colors.reduce((sum, color) => sum + color.g, 0);
    let b = this.b + colors.reduce((sum, color) => sum + color.b, 0);
    return Color.fromRgb(r, g, b);
  }

  _setMaterial(material) {
    if (this._material !== undefined)
      throw "A Color can only be added once.";

    this._material = material;    
    this.count = 0;
  }
  
  get material() {
    return this._material;
  }
  
  _set(colorValue) {
    let color = colorValue;
    if (typeof color === 'string' || color instanceof String) {
      color = color.trim().toUpperCase();
      if (color.match(/^#?([0-9a-fA-F]{3}|#?[0-9a-fA-F]{6})$/)) {
        color = color.replace('#', '');
        
        this._color = '#' + color;
        
        if (color.length === 3) {
          color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2]; 
        }
        
        // Populate .r .g and .b
        let value = parseInt(color, 16);
        this.r = ((value >> 16) & 255) / 255;
        this.g = ((value >> 8) & 255) / 255;
        this.b = (value & 255) / 255;
        
        return;
      }
    }    
    
    throw {
        name: 'SyntaxError',
        message: `Color ${colorValue} is not a hexadecimal color of the form #RGB or #RRGGBB.`
    };
  }
  
  toString() {
    return this._color;
  }
}

// =====================================================
// class BaseMaterial
// =====================================================


class BaseMaterial {
  
  constructor(settings) {
       
    this._settings = settings;

    // Determine the base ID. 
    // Since we are always creating the settings in the order in SVOX.MATERIALPROPERTIES, 
    // the property order should be fixed for different materials.
    this._baseId = JSON.stringify(settings);

    this.index = 0;    
    
    this._colors = [];
  }
  
  get baseId() {
    return this._baseId;
  }
  
  get settings()     { return this._settings; }
  
  get colors()       { return this._colors; }
  get colorCount()   { return this._colors.length; } 
  
  get colorUsageCount() {
    return this._colors.reduce((s,c) => (s + c.count), 0);
  } 
  
  get hasMap() {
    for (const property in this._settings) {
      if (property !== 'envmap' && (property === 'map' || property.endsWith('Map')) && this._settings[property]) {
        return true;
      }
    }
    return false;
  }   
}

// =====================================================
// class Material
// =====================================================

class Material {
  
  constructor(baseMaterial, settings) {
    this._settings = settings;
    this._baseMaterial = baseMaterial;  

    let colors = this._settings.colors;
    this._settings.colors = [];
    colors.forEach(function addColor(color) {
      this.addColor(color);
    }, this);
            
    this.bounds = new BoundingBox();
  }
    
  get settings()     { return this._settings; }
  
  get type()         { return this._settings.type; }

  get baseMaterial() { return this._baseMaterial; }
  get baseId()       { return this._baseMaterial.baseId; }
  get index()        { return this._baseMaterial.index; }
   
  get lighting()     { return this._settings.lighting; }
  get lights()       { return this._settings.lights; }
  
  get castShadow()   { return this._settings.castShadow; }
  get receiveShadow() { return this._settings.receiveShadow; }
  
  get fade()         { return this._settings.fade; }
  get opacity()      { return this._settings.opacity; }  
  get transparent()  { return this._settings.transparent; }
  
  get wireframe()    { return this._settings.wireframe; }
  get simplify()     { return this._settings.simplify; }
  get side()         { return this._settings.side; }
    
  get deform()       { return this._settings.deform; }
  get warp()         { return this._settings.warp; }
  get scatter()      { return this._settings.scatter; }
  
  get flatten()      { return this._settings.flatten }
  get clamp()        { return this._settings.clamp; }
  get skip()         { return this._settings.skip; }
  get hide()         { return this._settings.hide; }
  
  get ao()           { return this._settings.ao; }
  get quickAo()      { return this._settings.quickAo; }
  get aoSides()      { return this._settings.aoSides; }
  
  get shell()        { return this._settings.shell; };
  
  get data()         { return this._settings.data; };
  
  get colors()       { return this._settings.colors; }
  get colorCount()   { return this._settings.colors.length; } 
  
  get colorUsageCount() { 
    return this._settings.colors.reduce((s,c) => (s + c.count), 0);
  } 
   
  addColorHex(hex, id) {
    return this.addColor(Color.fromHex(hex, id));
  }  

  addColorRGB(r, g, b, id) {
    return this.addColor(Color.fromRgb(r, g, b, id));
  }    
  
  addColor(color) {
    if (!(color instanceof Color))
      throw "addColor requires a Color object, e.g. material.addColor(Color.fromHex('#FFFFFF'))";
       
    color._setMaterial(this);
    this._settings.colors.push(color);
    this._baseMaterial._colors.push(color);
    return color;
  }
   
}

// =====================================================
// class MaterialList
// =====================================================

class MaterialList {
  
    constructor() {
      this.baseMaterials = [];
      this.materials = [];
    }
  
    createMaterial(model, modelName, settings, noColors) {
      
      let defMaterial = MaterialReader.read(settings, modelName, noColors);
      let defBase     = defMaterial.base;
      let defBaseId   = defMaterial.baseId;

      let baseMaterial = new BaseMaterial(defBase);
      let baseId = baseMaterial.baseId;
      let existingBase = this.baseMaterials.find(m => m.baseId === baseId);
      
      if (existingBase) {
        baseMaterial = existingBase;
      }
      else {
        this.baseMaterials.push(baseMaterial);
      }
      
      let material = new Material(baseMaterial, defMaterial);
      material.group = model.groups.getById(defMaterial.group);
      this.materials.push(material);
      
      return material;
    }
  
    forEach(func, thisArg, baseOnly) {
      if (baseOnly) {
        this.baseMaterials.foreach(func, thisArg);
      }
      else {
        this.materials.forEach(func, thisArg);
      }
    }
  
    find(func) {
      return this.materials.find(func);
    }
  
    findColorById(id) {
      let color = null;
      this.forEach(function(material) {
        if (!color) 
          color = material.colors.find(c => c.id === id);
      }, this);
      
      return color;
    }
  
    findColorByExId(exId) {
      let color = null;
      this.forEach(function(material) {
        if (!color) 
          color = material.colors.find(c => c.exId === exId);
      }, this);
      
      return color;
    }
  
}

// =====================================================
// ../smoothvoxels/model/model.js
// =====================================================

class Model {
  
  constructor(settings) {
    this._settings = settings;
    this.textures = new TextureList();
    this.lights = new LightList();
    this.groups = new GroupList();
    this.materials = new MaterialList();
    this.voxels = new VoxelMatrix();
    this.vertices = new VertexMatrix(this); 
    
    this.groups.createGroup( { id:'*', 
                                scale: this.scale, 
                                shape: this.shape,
                                origin: this.origin, 
                                resize: this.resize, 
                                rotation: this.rotation, 
                                position: this.position
                              } );    
  }

  get settings()  { return this._settings;           }
  
  get name()      { return this._settings.name;      }
  get size()      { return this.voxels.size;         }
  get scale()     { return this._settings.scale;     }
  get rotation()  { return this._settings.rotation;  }
  get position()  { return this._settings.position;  }
  get simplify()  { return this._settings.simplify;  }
  get resize()    { return this._settings.resize;    }
  get shape()     { return this._settings.shape;     }
  get wireframe() { return this._settings.wireframe; }
  get origin()    { return this._settings.origin;    }
  get flatten()   { return this._settings.flatten;   }
  get clamp()     { return this._settings.clamp;     }
  get skip()      { return this._settings.skip;      }
  get hide()      { return this._settings.hide;      }
  get tile()      { return this._settings.tile;      }
  get shape()     { return this._settings.shape;     }
  get ao()        { return this._settings.ao;        }
  get quickAo()   { return this._settings.quickAo;   }
  get aoSides()   { return this._settings.aoSides;   }
  get aoSamples() { return this._settings.aoSamples; }
  get data()      { return this._settings.data;      }
  get shell()     { return this._settings.shell;     }
  get improveNonManifold() { return this._settings.improveNonManifold; }
      
  prepareForWrite(countColors) {
    this.settings.size = this.size;
    
    if (countColors !== false)  // undefined
      countColors = true;

    this.materials.forEach(function(material) {
      // Reset all material bounding boxes
      material.bounds.reset();
      
      material.colors.forEach(function(color) {
        // Reset all color counts
        color.count = 0;
      }, this);
    }, this);
    
    // Add color usage count for model shell colors (to ensure the material is generated)
    if (this.shell) {
      this.shell.forEach(function (sh) {
        sh.color.count++;
      }, this);
    }
      
    // Add color usage count for material shell colors
    this.materials.forEach(function(material) {
      if (material.shell) {
        material.shell.forEach(function (sh) {
          sh.color.count++;      
        }, this);
      }
    }, this);    
    
    if (this.lights.visible) {
      // There are visible lights, so the modelreader created a material and a color for them
      // Set the count to 1 to indicate it is used
      this.materials.materials[0].colors[0].count = 1;
    }
        
    this.voxels.prepareForWrite();
    
    if (countColors) {
      this.voxels.forEach(function countColors(voxel) {
        voxel.color.count++;
      });
    }
    
    this._determineColorIds();
  }
  
  /*
   * Determines the colorID's
   */
  _determineColorIds() {
    // Retrieve all colors
    let colors = [];
    let colorIds = {};
    this.materials.forEach(function(material) {
      material.colors.forEach(function(color) {
        colors.push(color);
        colorIds[color.id] = color.id;
      });
    });

    // Sort the colors on (usage) count
    colors.sort(function (a, b) {
      return b.count - a.count;
    });

    // Give the new colors their Id, reusing existing Id's
    let index = 0;
    for (let c = 0; c < colors.length; c++) {
      if (!colors[c].id) {
        let colorId;
        do {
          colorId = this._colorIdForIndex(index++)
        } while(colorIds[colorId]);
        colorIds[colorId] = colorId;
        colors[c].id = colorId; 
      }
    }    
  }
  
    
  /**
   * Calculate the color Id, after sorting the colors on usage.
   * This ensures often used colors are encoded as one character A-Z.
   * If there are more then 26 colors used the other colors are Aa, Ab, ... Ba, Bb, etc. or even Aaa, Aab, etc.
   * @param model The sorted index of the color.
   */
  _colorIdForIndex(index) {
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let id = '';
    do {
      let mod = index % 26;
      id = chars[mod] + id.toLowerCase();
      index = (index - mod) / 26;
      if (index<26)
        chars = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    } while (index > 0);
    return id;
  }  
  
  determineBoundsForAllGroups(prepareForResize = false) {

    this.voxels.bounds.reset();
    this.groups.forEach(function(group) {
      group.bounds.reset();
      group.vertexBounds.reset();
      group.vertexOffset  = null;
      group.vertexRescale = null;
    }, this);
    
    this.voxels.forEach(function(voxel) {
      this.voxels.bounds.set(voxel.x, voxel.y, voxel.z);
      voxel.group.bounds.set(voxel.x, voxel.y, voxel.z);
      voxel.material.group.bounds.set(voxel.x, voxel.y, voxel.z);
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        if (!face.hidden || !prepareForResize) {
          for (let v = 0; v < 4; v++) {
            let vertex = face.vertices[v];
            vertex.group.vertexBounds.set(vertex.x, vertex.y, vertex.z);
          }
        }
      }
    }, this, true);
     
    if (this.voxels.bounds.isValid()) {
      this.voxels.bounds.set(this.voxels.bounds.maxX+1, this.voxels.bounds.maxY+1, this.voxels.bounds.maxZ+1)
    }
    else {
      this.voxels.bounds.set(0,0,0);
    }

    this.groups.forEach(function(group) {
      
      if (!group.bounds.isValid()) {
        // This group does not contain voxels. Use the model bounds instead
        group.bounds.reset();
        group.bounds.set(0,0,0);
      }
      else {
        group.bounds.set(group.bounds.maxX+1, group.bounds.maxY+1, group.bounds.maxZ+1)
      }
      
      if (!group.vertexBounds.isValid()) {
        // This group contains no voxels or all faces in this group are skipped, so use the voxel bounds instead
        group.vertexBounds.copy(group.bounds);
      }
      
      if (prepareForResize) {
        
        if (group.resize === SVOX.BOUNDS) {
          // The bounds were determined above
          group.vertexRescale = { x:1, y:1, z:1 };
        } 
        else if (group.resize === SVOX.FIT) {
          // Resize the actual model to fit the original voxel bounds
          let scaleX = (group.bounds.maxX-group.bounds.minX)/(group.vertexBounds.maxX-group.vertexBounds.minX);
          let scaleY = (group.bounds.maxY-group.bounds.minY)/(group.vertexBounds.maxY-group.vertexBounds.minY);
          let scaleZ = (group.bounds.maxZ-group.bounds.minZ)/(group.vertexBounds.maxZ-group.vertexBounds.minZ);
          let scale = Math.min(scaleX, scaleY, scaleZ);
          group.vertexRescale = { x:scale, y:scale, z:scale };
          group.vertexBounds.copy(group.bounds);
        }
        else if (group.resize === SVOX.FILL) {
          // Resize the actual model to fill the original voxel bounds in all 3 axis directions
          group.vertexRescale = {
            x: (group.bounds.maxX-group.bounds.minX)/(group.vertexBounds.maxX-group.vertexBounds.minX),
            y: (group.bounds.maxY-group.bounds.minY)/(group.vertexBounds.maxY-group.vertexBounds.minY),
            z: (group.bounds.maxZ-group.bounds.minZ)/(group.vertexBounds.maxZ-group.vertexBounds.minZ)
          }
          group.vertexBounds.copy(group.bounds);
        }
        else {
          // Don't resize the model, and keep the original voxel bounds
          group.vertexRescale = { x:1, y:1, z:1 };
          group.vertexBounds.copy(group.bounds);
        }

        let offsetX = (group.vertexBounds.maxX - group.vertexBounds.minX)/2;
        let offsetY = (group.vertexBounds.maxY - group.vertexBounds.minY)/2;
        let offsetZ = (group.vertexBounds.maxZ - group.vertexBounds.minZ)/2;      

        // Determine the origin offset
        group.originOffset = { x: 0, y: 0, z: 0 };
        if (group.origin) {
          if (group.origin.nx) group.originOffset.x =  offsetX;
          if (group.origin.px) group.originOffset.x = -offsetX;
          if (group.origin.ny) group.originOffset.y =  offsetY;
          if (group.origin.py) group.originOffset.y = -offsetY;
          if (group.origin.nz) group.originOffset.z =  offsetZ;
          if (group.origin.pz) group.originOffset.z = -offsetZ;
        }
        
        if (Math.abs(group.originOffset.x) < 0.00001) group.originOffset.x = 0;
        if (Math.abs(group.originOffset.y) < 0.00001) group.originOffset.y = 0;
        if (Math.abs(group.originOffset.z) < 0.00001) group.originOffset.z = 0;      
      }
      
    }, this);
  }  
  
  _normalize(vector) {
    if (vector) {
      let length = Math.sqrt( vector.x * vector.x + vector.y * vector. y + vector.z * vector.z );
      if (length > 0) {
        vector.x /= length;
        vector.y /= length;
        vector.z /= length;
      }
    }
    return vector;
  }
  
  _isZero(vector) {
    return !vector || (vector.x === 0 && vector.y === 0 && vector.z === 0);
  }
  
  // End of class Model
}

// =====================================================
// ../smoothvoxels/io/propertyparser.js
// =====================================================

class PropertyParser {
  
    /**
     *
     */
    static _stringIsNumber(value) {
      return (/^-?\d*(\.\d+)?$/.test(value));
    }
  
    /**
     * Parses and checks a name string
     * @param {string} name The name of the field
     * @param {string} defaultValue The default value for the field
     * @param {string} value The string value of the field
     * @returns {string} The name if it is valid
     * @throws {SyntaxError} Invalid name
     */
    static parseName(name, defaultValue, value) {
      if (!value) {
        return defaultValue;
      }
      else if (value === '*') {
        // Special case for the default group Id
        return value;
      }
      else if (/^([a-zA-Z_][a-zA-Z_0-9]*)$/.test(value)) {
        return value;
      }
            
      throw {
        name: 'SyntaxError',
        message: `Invalid name '${value}' for ${name}'.`
      };
    }
  
    /**
     * Parses and checks a boolean string, only true and false are allowed.
     * @param {string} name The name of the field
     * @param {string} defaultValue The default value for an optional field
     * @param {string} value The string value of the field
     * @returns {string} A boolean if the value is true or false
     * @throws {SyntaxError} Invalid name
     */
    static parseBoolean(name, defaultValue, value) {
      if (typeof value === 'boolean') return value;
      
      let parseValue = value || `${defaultValue}`;
      if (parseValue === 'undefined') return undefined;
      if (parseValue === 'true')  return true;
      if (parseValue === 'false') return false;
      
      throw {
        name: 'SyntaxError',
        message: `Invalid boolean value '${value}' for '${name}'. Use true or false.`
      };
    }
  
    /**
     * Parses an enum value (string) and checks if it is one of the allowed values.
     * @param {string} name The name of the field
     * @param {array} allowedValues An array containing the allowed values
     * @param {string} defaultValue The default value for an optional field
     * @param {string} value The string value of the field
     * @returns {string} The value if it is one of the allowed values
     * @throws {SyntaxError} Invalid value for the allowed values
     */
    static parseEnum(name, allowedValues, defaultValue, value) { 
      let parseValue = value || defaultValue;
      if (parseValue === undefined)
        return undefined;
      if (allowedValues.includes(parseValue))
        return parseValue;
      
      throw {
        name: 'SyntaxError',
        message: `Invalid value '${value}' for '${name}'. Allowed values: ${allowedValues.join(', ')}.`
      };
    }
  
    /**
     * Parses and checks a color string
     * @param {string} name The name of the field
     * @param {string} defaultValue The default value for an optional field
     * @param {string} value The string value of the field
     * @returns {Color} A color if the value is valid
     * @throws {SyntaxError} Invalid value
     */
    static parseColor(name, defaultValue, value) { 
      let parseValue = value || defaultValue;
      try {
        if (parseValue)
          return Color.fromHex(parseValue);
        else
          return undefined;
      }
      catch (ex) {
        throw {
          name: ex.name,
          message: `Invalid value for '${name}'. ${ex.message}`
        };                
      }
    }
  
    /**
     * Parses and checks a color id
     * @param {string} name The name of the field
     * @param {string} value The string value of the field
     * @returns {ColorId} A color Id if the value is valid
     * @throws {SyntaxError} Invalid value
     */
    static parseColorId(name, value) { 
      if (value) {
        if (/^[A-Z][a-z]*$/.test(value)) {
          return value;
        }
        else {            
          throw {
            name: 'SyntaxError',
            message: `Invalid color Id for '${name}'.`
          };                
        }
      }
      else
        return undefined;
    }
  
    /**
     * Parses a planar point expression, i.e. model origin
     * @param {string} name The name of the field
     * @param {string} defaultValue The default planar expression for an optional field
     * @param {string} value The string value of the field in the form -x x +x -y y +y -z z +z
     * @returns {Color} A planar struct if the value is valid
     * @throws {SyntaxError} Invalid value
     */
    static parsePlanarPoint(name, defaultValue, value) {
      let planar = Planar.parse(value || defaultValue);
      
      if (planar) {      
        if (((planar.nx ? 1 : 0) + (planar.x ? 1 : 0) + (planar.px ? 1 : 0) > 1) ||
            ((planar.ny ? 1 : 0) + (planar.y ? 1 : 0) + (planar.py ? 1 : 0) > 1) ||
            ((planar.nz ? 1 : 0) + (planar.z ? 1 : 0) + (planar.pz ? 1 : 0) > 1)) {
          throw {
            name: 'SyntaxError',
            message: `Invalid value '${value}' for '${name}'.`
          };                          
        }  
      }
      
      return planar;
    }
  
    /**
     * Parses a planar planes expression, i.e. clamp, flatten, skip.
     * @param {string} name The name of the field
     * @param {string} defaultValue The default planar expression for an optional field
     * @param {string} value The string value of the field in the form -x x +x -y y +y -z z +z
     * @returns {Color} A planar struct if the value is valid
     * @throws {SyntaxError} Invalid value
     */
    static parsePlanarPlanes(name, defaultValue, value) {
      let planar = Planar.parse(value || defaultValue);

      if (planar) {
        if (planar.x) { planar.nx = false; planar.px = false; }
        if (planar.y) { planar.ny = false; planar.py = false; }
        if (planar.z) { planar.nz = false; planar.pz = false; }
      }
      
      return planar;
    }  
  
    /**
     * Parses a planar sides expression, i.e. tile or aosides
     * @param {string} name The name of the field
     * @param {string} defaultValue The default planar expression for an optional field
     * @param {string} value The string value of the field in the form -x x +x -y y +y -z z +z
     * @returns {Color} A planar struct if the value is valid
     * @throws {SyntaxError} Invalid value
     */
    static parsePlanarSides(name, defaultValue, value) {
      let planar = Planar.parse(value || defaultValue);
      
      if (planar) {
        if (planar.x) { planar.x = false; planar.nx = true; planar.px = true; }
        if (planar.y) { planar.y = false; planar.ny = true; planar.py = true; }
        if (planar.z) { planar.z = false; planar.nz = true; planar.pz = true; }
      }
      
      return planar;
    }   
  
    /**
     * Parses and checks a float string
     * @param {string} name The name of the field
     * @param {string} defaultValue The default value for an optional field
     * @param {string} value The string value of the field
     * @returns {string} A float if the value is valid
     * @throws {SyntaxError} Invalid value
     */
    static parseFloat(name, defaultValue, value) {
      try {
        return PropertyParser._parseFloatPart(value, defaultValue);
      }
      catch(ex) {
        throw {
          name: 'SyntaxError',
          message: `Invalid value '${value}' for '${name}'.`
        };
      }
    }
   
    /**
     * Parses an 'x y' string into an object with float x y values
     * @param {string} name The name of the field
     * @param {string} defaultX The default value for the x value for an optional field
     * @param {string} defaultY The default value for the y value for an optional field or when the second float value is omitted
     * @param {boolean} allowUniform When true one value is allowed to fill x, y and z
     * @param {string} value The string value of the field
     * @returns {string} A struct { float1, float2 }
     * @throws {SyntaxError} Invalid value
     */
    static parseXYFloat(name, allowUniform, defaultX, defaultY, value) {
      try {
        let xy = undefined;
        if (typeof value === 'object') {
          xy = {
            x: value.x,
            y: value.y
          };
          if (!Number.isFinite(xy.x) || !Number.isFinite(xy.y)) {
            throw {
              name: 'SyntaxError',
              message: `'${name}' object must have two values.`
            };
          }
        } 
        else if (typeof value === 'number') {
          if (!allowUniform) {
            throw {
              name: 'SyntaxError',
              message: `'${name}' must have two values.`
            };
          }
          xy = {
            x: value,
            y: value
          };          
        }
        else if (value === undefined || value === null) {
          if (Number.isFinite(defaultX)) {
            xy = { 
              x: defaultX,
              y: !Number.isFinite(defaultY) && allowUniform ? defaultX : defaultY
            };
          }
          else {
            return undefined;            
          }
        }
        else {
          // It must be a string 
          xy = value.split(/\s+/).filter(s => s);
          if (xy.length === 1 && allowUniform) {
            xy.push(xy[0]);   
          }
          
          // There should always be at least one value, so don't use defaultX
          
          if (xy.length < 2 && Number.isFinite(defaultY)) {
            xy.push(defaultY.toString());
          }
          if (xy.length !== 2) {
            throw {
              name: 'SyntaxError',
              message: `'${name}' must have ${allowUniform?'one or':''} two values.`
            };
          }

          xy = { 
              x: PropertyParser._parseFloatPart(xy[0], defaultX), 
              y: PropertyParser._parseFloatPart(xy[1], defaultY)
          };
        }
        
        return xy;
      }
      catch(ex) {
        throw {
          name: 'SyntaxError',
          message: `Invalid value '${value}' for '${name}'.`
        };        
      }
    }  
  
    /**
     * Parses an 'x y z' string into an object with integer x y z values
     * @param {string} name The name of the field
     * @param {boolean} allowUniform When true one value is allowed to fill x, y and z
     * @param {string} defaultX The default value for the x value for an optional field
     * @param {string} defaultY The default value for the y value for an optional field or when the second value is omitted
     * @param {string} defaultY The default value for the y value for an optional field or when the third value is omitted
     * @param {string} value The string value of the field
     * @returns {object} An { x, y, z } object with integers 
     */
    static parseXYZInt(name, allowUniform, defaultX, defaultY, defaultZ, value) {
      let xyz = PropertyParser.parseXYZFloat(name, allowUniform, defaultX, defaultY, defaultZ, value);
      
      if (xyz.x !== Math.trunc(xyz.x) || xyz.y !== Math.trunc(xyz.y) || xyz.z !== Math.trunc(xyz.z)) {
        throw {
          name: 'SyntaxError',
          message: `'${name}' object must have three integer values.`
        };
      }
      
      return xyz;
    }
  
    /**
     * Parses an 'x y z' string into an object with float x y z values
     * @param {string} name The name of the field
     * @param {boolean} allowUniform When true one value is allowed to fill x, y and z
     * @param {string} defaultX The default value for the x value for an optional field
     * @param {string} defaultY The default value for the y value for an optional field or when the second value is omitted
     * @param {string} defaultY The default value for the y value for an optional field or when the third value is omitted
     * @param {string} value The string value of the field
     * @returns {object} An { x, y, z } object with floats 
     */
    static parseXYZFloat(name, allowUniform, defaultX, defaultY, defaultZ, value) {
      try {
        let xyz = undefined;
        if (typeof value === 'object') {
          xyz = {
            x: value.x,
            y: value.y,
            z: value.z
          };
          if (!Number.isFinite(xyz.x) || !Number.isFinite(xyz.y) || !Number.isFinite(xyz.z)) {
            throw {
              name: 'SyntaxError',
              message: `'${name}' object must have three values.`
            };
          }
        } 
        else if (typeof value === 'number') {
          if (!allowUniform) {
            throw {
              name: 'SyntaxError',
              message: `'${name}' must have three values.`
            };
          }
          xyz = {
            x: value,
            y: value,
            z: value
          };          
        }
        else if (value === undefined || value === null) {
          if (Number.isFinite(defaultX)) {
            xyz = { 
              x: defaultX,
              y: !Number.isFinite(defaultY) && allowUniform ? defaultX : defaultY,
              z: !Number.isFinite(defaultZ) && allowUniform ? defaultX : defaultZ
            };
          }
          else {
            return undefined;            
          }
        }
        else {
          // It must be a string 
          xyz = value.split(/\s+/).filter(s => s);
          if (xyz.length === 1 && allowUniform) {
            xyz.push(xyz[0]);  
            xyz.push(xyz[0]);  
          }
          
          // There should always be at least one value, so don't use defaultX
          
          if (xyz.length < 2 && Number.isFinite(defaultY)) {
            xyz.push(defaultY.toString());
          }
          if (xyz.length < 3 && Number.isFinite(defaultZ)) {
            xyz.push(defaultZ.toString());
          }
          if (xyz.length !== 3) {
            throw {
              name: 'SyntaxError',
              message: `'${name}' must have ${allowUniform?'one or':''} three values.`
            };
          }

          xyz = { 
              x: PropertyParser._parseFloatPart(xyz[0], defaultX), 
              y: PropertyParser._parseFloatPart(xyz[1], defaultY), 
              z: PropertyParser._parseFloatPart(xyz[2], defaultZ)
          };
        }
        
        return xyz;
      }
      catch(ex) {
        throw {
          name: 'SyntaxError',
          message: `Invalid value '${value}' for '${name}'.`
        };        
      }
    }

    /**
     * parseFloat replacement with default value in case the string is not a float
     * (Since the simple parseFloat("false" || 1) returns NaN and parseFloat(0) || 1 returns 1)
     * @param {value} string the string containing the float value
     * @param {float} defaultValue the default value when the value is not a valid float
     */
    static _parseFloatPart(value, defaultValue) {
      if (value === null || value === undefined) {
        return defaultValue;
      }
      else if (typeof value === 'number') {
        return value;
      }
      else if (typeof value === 'string') {
        let parseValue = value.trim();
        if (parseValue === '') {
          return defaultValue;
        }

        const isNumberString = /^-?[0-9]+\.[0-9]+$|^-?[0-9]+$/;
        if (isNumberString.test(parseValue)) {
          return parseFloat(parseValue);
        }
      }
    
      throw {
        name: 'SyntaxError',
        message: `Invalid float value '${value}'.`
      };  
    }   
  
    /**
     * Parses a string
     * @param {string} name The name of the field
     * @param {string} value The string value of the field
     * @returns {string} The content of the string
     */
    static parseString(name, value) {
      return value;
    }  
  
    /**
     * Parses a 'color distance íntensity angle' string to an ao object
     * @param {string} name The name of the field
     * @param {string/object} value The ao value as a string '#000 2 1 70' (color, íntensity and angle optional), or object { color:'#000', maxDistance:2, íntensity:1, angle:70 }, or undefined
     * returns {object} { color, maxDistance, íntensity, angle } or undefined
     */
    static parseAo(name, value) {
      try {
        let ao = undefined;
        if (typeof value === 'object') {
          let color = value.color || '#000';
          let maxDistance = Math.abs(!Number.isFinite(value.maxDistance) ? 1.0 : value.maxDistance);
          let intensity = !Number.isFinite(value.intensity) ? 1.0 : value.intensity;
          let angle = !Number.isFinite(value.angle) ? 70.0 : value.angle;
          angle = Math.max(0, Math.min(180, Math.round(angle)));

          return { color, maxDistance, intensity, angle };
        }
        else if (typeof value === 'string') {
          let parseValue = value;
          if (!parseValue.startsWith('#')) { 
              // Default to black color
              parseValue = "#000 " + parseValue;
          }

          let color = PropertyParser.parseColor(name, '#000', parseValue.split(/\s+/)[0]);
          let maxDistance = Math.abs(PropertyParser._parseFloatPart(parseValue.split(/\s+/)[1], 1.0));
          let intensity = PropertyParser._parseFloatPart(parseValue.split(/\s+/)[2], 1);
          let angle = PropertyParser._parseFloatPart(parseValue.split(/\s+/)[3], 70);

          angle = Math.max(0, Math.min(180, Math.round(angle)));

          return { color, maxDistance, intensity, angle };
        }
      }
      catch(ex) {
        throw {
          name: 'SyntaxError',
          message: `Invalid value '${value}' for '${name}'.`
        };        
      }
    } 
 
    /**
     * Parses a 'color intensity' string to a quickAo object
     * @param {string} name The name of the field
     * @param {string/object} value The ao value as a string '#000 1' (color, intensity is optional), or object { color:'#000', intensity:1 }, or undefined
     * returns {object} { color, intensity } or undefined
     */
    static parseQuickAo(name, value) {
      try {
        if (typeof value === 'object') {
          let color = value.color || '#000';
          let intensity = !Number.isFinite(value.intensity) ? 1.0 : value.intensity;
          return { color, intensity };
        }
        else if (typeof value === 'string') {
          let parseValue = value;
          if (!parseValue.startsWith('#')) { 
              // Default to black color
              parseValue = "#000 " + parseValue;
          }

          let color = PropertyParser.parseColor(name, '#000', parseValue.split(/\s+/)[0]);
          let intensity = PropertyParser._parseFloatPart(parseValue.split(/\s+/)[1], 1);

          return { color, intensity };
        }
      }
      catch(ex) {
        throw {
          name: 'SyntaxError',
          message: `Invalid value '${value}' for '${name}'.`
        };        
      }
    } 
  
    /**
     * Parses a scale string to a scale object
     * @param {string} name The name of the field
     * @param {string/object} value The scale value as a string '1 1 1', object { x:1, y:1, z:1 }, number or undefined
     * returns {object} { x, y, z }
     */
    static parseScale(name, defaultValue, value) {
      let parseValue = value || defaultValue;
      let scale = PropertyParser.parseXYZFloat(name, true, undefined, undefined, undefined, parseValue);
      
      if (scale && (scale.x === 0 || scale.y === 0 || scale.z === 0)) {
        throw {
          name: 'SyntaxError',
          message: `'${name}' cannot be 0 for x, y or z`
        };        
      }
            
      return scale;
    }    

    /**
     * Parses a 'count strength damping' string to a deform object
     * @param {string} name The name of the field
     * @param {string/object} value The deform value as a string '2 1 1', object { count:2, strength:1, damping:1 }, or undefined
     * returns {object} { count, strength, damping }
     */
    static parseDeform(name, value) {
      let deform = undefined;
      if (typeof value === 'object') {
        let count = !Number.isFinite(value.count) ? 1.0 : value.strength;
        let strength = !Number.isFinite(value.strength) ? 1.0 : value.strength;
        let damping = !Number.isFinite(value.damping) ? 1.0 : value.damping;
        deform = { count, strength, damping };        
      }
      else if (typeof value === 'number') {
        deform = { count:value, strength:1, damping:1 };
      }
      else if (typeof value === 'string') {
        let values = PropertyParser.parseXYZFloat(name, false, 0, 1, 1, value);
        deform = { count:Math.abs(Math.round(values.x)), strength:values.y, damping:values.z };
      }
      
      return deform;
    }  

  
    /**
     * Parses a 'amplitude frequency' string to a warp object
     * @param {string} name The name of the field
     * @param {string} value The warp data, or undefined
     * returns {object} { amplitude, frequency } or undefined
     */
    static parseWarp(name, value) {
      let warp = undefined;

      if (typeof value === 'object') {
        let amplitude  = Number.isFinite(value.amplitude)  ? value.amplitude  : 0.5;
        let amplitudeX = Number.isFinite(value.amplitudeX) ? value.amplitudeX : amplitude;
        let amplitudeY = Number.isFinite(value.amplitudeY) ? value.amplitudeY : amplitude;
        let amplitudeZ = Number.isFinite(value.amplitudeZ) ? value.amplitudeZ : amplitude;
        let frequency  = Number.isFinite(value.frequency)  ? value.frequency  : 0.2;
        warp = { amplitudeX, amplitudeY, amplitudeZ, frequency };
      }
      else if (typeof value === 'number') {
        warp = { amplitudeX:value, amplitudeY:value, amplitudeZ:value, frequency:0.2 };
      }
      else if (typeof value === 'string') {
        let stringValues = value.split(/\s+/);
        
        if (stringValues.length === 1 || stringValues.length === 2) {
          let amplitude  = PropertyParser._parseFloatPart(stringValues[0], 0.5);
          let amplitudeX = amplitude;
          let amplitudeY = amplitude;
          let amplitudeZ = amplitude;
          let frequency  = PropertyParser._parseFloatPart(stringValues[1], 0.2);
          warp = { amplitudeX, amplitudeY, amplitudeZ, frequency };
        }
        else if (stringValues.length === 3 || stringValues.length === 4) {
          let amplitudeX = PropertyParser._parseFloatPart(stringValues[0], 0.5);
          let amplitudeY = PropertyParser._parseFloatPart(stringValues[1], 0.5);
          let amplitudeZ = PropertyParser._parseFloatPart(stringValues[2], 0.5);
          let frequency  = PropertyParser._parseFloatPart(stringValues[3], 0.2);
          warp = { amplitudeX, amplitudeY, amplitudeZ, frequency };
        }
        else {
          throw {
            name: 'SyntaxError',
            message: `'${name}' must have 1 to 4 values (amplitude [frequency] OR amplitudeX amplitudeY amplitudeZ [frequency])`
          };
        }
      }

      return warp;
    }
   
     /**
     * Parses a 'colorId distance'+ string to a shell object, e.g. "P 0.25 Q 0.5"
     * @param {string} value The shell data, or undefined
     * returns {array} [ { colorID, distance }, ... ] or null
     * NOTE: Since the color may be defined in a material which is parsed later, 
     *       we'll resolve the colorID later to add the color.
     */
    static parseShell(name, value) {
      let shell = undefined;
      let error = false;
      if (Array.isArray(value)) {
        shell = [];
        for (let s = 0; s<value.length; s++) {
          if (!value[s].colorId || !Number.isFinite(value[s].distance)) {
            error = true;
            break
          }
          shell.push( { colorId:value[s].colorId, distance:value[s].distance } );
        }
      }
      else if (typeof value === 'string' && value) {
        shell = [];
        if (value !== 'none') {
          let parts = value.split(/\s+/);
          if (parts.length < 2 || parts.length % 2 !== 0) { 
            error = true;
          }
          else {
            for (let s = 0; s < parts.length/2; s++) {
              let colorId  = parts[s*2 + 0];
              let distance = parts[s*2 + 1];
              if (!/^[A-Z][a-z]*$/.test(colorId) || !/^([-+]?[0-9]*\.?[0-9]+)*$/.test(distance)) {
                error = true;
                break;
              }
              else
                shell.push( { colorId:parts[s*2], distance:parts[s*2+1] } );
            }
          }
        }
      }
      
      if (shell && shell.length === 0) {
        shell = undefined;
      }
      
      if (error) {
        throw {
          name: 'SyntaxError',
          message: `Invalid value '${value}' for ${name}. Shell must be 'none' or one or more color ID's and distances, e.g. P 0.2 Q 0.4`
        };        
      }
      else if (shell) {
        shell = shell.sort(function(a,b) {
          return a.distance - b.distance;
        });
      }
      
      return shell;
    } 
  
    /**
     * Parses vertex data in the model or a material (which is used by a custom shader)
     * @param {object} modelData The vertex data string
     * @param {string} modelType 'model' or 'material' depending on what is parsed to get a better error on failure
     * @returns {object} the vertex data array e.g. [ {name:"data", values:[0.3,0.6,0.9]}, {name:"size",values:[0.5}]
     * @throws Syntax error in case the vertex data is not correct (i.e. it must be [<name> <float>+]+ )
     */
    // TODO: ALLOW FOR DIRECT INPUT OF AN ARRAY OF { name, values } OBJECTS, SIMILAR TO ABOVE FUNCTIONS
    static parseData(name, value) {
      try {
        if (value) {
          let data = [];
          let parts = value.split(/\s+/);
          let dataPart = null;
          for (let i = 0; i < parts.length; i++) {
            let part = parts[i];
            if (!PropertyParser._stringIsNumber(part)) {
              dataPart = { name:part, values:[] };
              data.push(dataPart);
            }
            else if (!dataPart) {
              break;
            }
            else {
              dataPart.values.push(PropertyParser._parseFloatPart(part));
            }
          }

          let error = (data.length === 0);
          for (let i = 0; i < data.length; i++) {
            error = error || (data[i].values.length === 0) || (data[i].values.length >= 4);
          }
          
          if (error) {
            throw "error";
          }

          return data;
        }

        return undefined;
      }
      catch(ex) {
        throw {
          name: 'SyntaxError',
          message: `Invalid value '${value}' for ''${name}'. Data should consist of one or more names, each followed by 1 to 4 float (default) values.`
        };        
      }
    }  
  
    /**
     * Parses an 'uscale vscale uoffset voffset rotation' string with floats into an object with these values
     * @param {string} name The name of the field
     * @param {string} value The string value of the field
     * @returns {object} An { uscale, vscale, uoffset, voffset, rotation } object with floats 
     */
    // TODO: ALLOW FOR DIRECT INPUT OF A MAPTRANSFORM OBJECT, SIMILAR TO ABOVE FUNCTIONS
    static parseMapTransform(name, value) {
      try {
        let parseValue = value || '-1 -1 0 0 0';      
        let values = parseValue.split(/\s+/);

        if (values.length !== 2 && values.length !== 4 && values.length !== 5) {
          throw "error";
        }

        return {
          uscale:   PropertyParser._parseFloatPart(values[0], -1.0),    // in voxels,  -1 = cover model
          vscale:   PropertyParser._parseFloatPart(values[1], -1.0),    // in voxels,  -1 = cover model
          uoffset:  PropertyParser._parseFloatPart(values[2], 0.0),     
          voffset:  PropertyParser._parseFloatPart(values[3], 0.0),     
          rotation: PropertyParser._parseFloatPart(values[4], 0.0)      // in degrees
        };
      }
      catch(ex) {
        throw {
          name: 'SyntaxError',
          message: `Invalid value '${value}' for '${name}'. '${name}' must have 2, 4 or 5 values.`
        };        
      }      
    } 
  
    /**
     * Parses an string with color definitions, e.g. A:#08F B:#FF8800 ...  or A(123):#0088FF B(124):#FF8800 (with MagicaVoxel palette indices)
     * @param {string} name The name of the field
     * @param {string} value The string value of the field
     * @returns {array} An array with Color classes. Each color has an id and exId (may be null)
     */
    // TODO: ALLOW FOR DIRECT INPUT OF AN ARRAY OF COLOR OBJECTS, SIMILAR TO ABOVE FUNCTIONS
    static parseColors(name, value) {
      if (Array.isArray(value)) {
        return value;
      }
      if (!value || value.length === 0) {
        return undefined;
      }
      
      // Cleanup the colors string (remove all extra spaces)
      const CLEANCOLORID = /\s*\(\s*(\d+)\s*\)\s*/g;
      const CLEANDEFINITION = /([A-Z][a-z]*)\s*(\(\d+\))?[:]\s*(#[a-fA-F0-9]*)\s*/g; 
      
      let parseValue = value;      
      parseValue = parseValue.replace(CLEANCOLORID, '($1)');
      parseValue = parseValue.replace(CLEANDEFINITION, '$1$2:$3 ').trim();
      
      let colors = [];

      let colorParts = parseValue.split(/\s+/);
      colorParts.forEach(function (colorData) {
          let color  = PropertyParser.parseColor(name, undefined, colorData.split(':')[1]);
          if (!color) {
            throw {
              name: 'SyntaxError',
              message: `Invalid '${name}' '${colorData}'.`
            };            
          }
        
          color.id   = colorData.split(':')[0];
          color.exId = undefined;
          if (color.id.includes('(')) {
            color.exId = Number(color.id.split('(')[1].replace(')',''));
            color.id   = color.id.split('(')[0];
          }

          if (!/^[A-Z][a-z]*|_$/.test(color.id)) {
            throw {
              name: 'SyntaxError',
              message: `Invalid color ID '${color.id}' for '${name}.`
            };
          }
        
          colors.push(color);

      });    
      
      return colors;
    }

}

// =====================================================
// ../smoothvoxels/io/propertywriter.js
// =====================================================

class PropertyWriter {
  
  static writeIntXYZ(value, allowUniform) {
    return PropertyWriter.writeFloatXYZ(value, allowUniform);
  }

  static writeFloatXYZ(value, allowUniform) {
    let result = null;
    if (value) {
      result = `${value.x}`;
      if (!allowUniform || value.y !== value.x || value.z !== value.x) {
        result += ` ${value.y} ${value.z}`;        
      }
    }
    return result;
  }
  
  static writeVertexData(value) {
    let result = null;
    if (value && value.length > 0) {
      result = '';
      for (let d=0; d<value.length; d++) {
        result += value[d].name + ' ';
        for (let v=0; v<value[d].values.length; v++) {
          result += value[d].values[v] + ' ';
        }
      }
    }
    return result.trim();
  }   
  
  static writeAo(value) {
    let result = null;
    if (value) {
      if (!value.color)
        value.color = '#000';
      if (!Number.isFinite(value.maxDistance))
        value.maxDistance = 1;
      if (!Number.isFinite(value.intensity))
        value.intensity = 1;
      if (!Number.isFinite(value.angle))
        value.angle = 70;
      
      result = `${value.color} ${value.maxDistance}` + 
               `${value.intensity!==1||value.angle!==70 ? ' ' + value.intensity : ''}` +
               `${value.angle!==70 ? ' ' + value.angle : ''}`;    
    }
    
    return result;
  }
  
  static writeQuickAo(value) {
    let result = null;
    if (value) {
      if (!value.color)
        value.color = '#000';
      if (!Number.isFinite(value.intensity))
        value.intensity = 1;
      
      result = `${value.color} ${value.intensity!==1 ? ' ' + value.intensity : ''}`;
    }
    return result;
  }
  
  static writeMapTransform(value) {
    let result = null;
    if (value) {
      if (!Number.isFinite(value.uscale))
        value.uscale = 1;
      if (!Number.isFinite(value.vscale))
        value.vscale = 1;
      if (!Number.isFinite(value.uoffset))
        value.uoffset = 0;
      if (!Number.isFinite(value.voffset))
        value.voffset = 0;
      if (!Number.isFinite(value.rotation))
        value.rotation = 0;
      result = `${value.uscale} ${value.vscale}`+ 
               `${value.uoffset===0&&value.voffset===0&&value.rotation===0 ? '' : ' ' + value.uoffset + ' ' + value.voffset}` +
               `${value.rotation===0 ? '' : ' ' + value.rotation}`;
    }
    return result;
  }
  
  static writeShell(value) {
    let result = null
    if (value) {
      result = `${value.length===0 ? 'none' : value.map((s) => s.colorId + ' ' + s.distance).join(' ')}`;
    }
    return result;
  }
  
  static writeDeform(value) {
    let result = null
    if (value) {
      if (!Number.isFinite(value.count))
        value.count = 1;
      if (!Number.isFinite(value.strength))
        value.strength = 1;
      if (!Number.isFinite(value.damping))
        value.damping = 1;
      
      result = `${value.count}${value.strength!==1||value.damping!==1 ? ' ' + value.strength : ''}` + 
               `${value.damping!==1 ? ' ' + value.damping : ''}`;
    }
    return result;
  }
  
  static writeWarp(value) {
    let result = null
    if (value) {
      if (!Number.isFinite(value.amplitudeX) && Number.isFinite(value.amplitude)) {
        value.amplitudeX = value.amplitude;
        value.amplitudeY = value.amplitude;
        value.amplitudeZ = value.amplitude;
      }
      if (Number.isFinite(value.amplitudeX) && Number.isFinite(value.amplitudeY) && Number.isFinite(value.amplitudeZ)) {
        if (value.amplitudeY === value.amplitudeX && value.amplitudeZ === value.amplitudeX) {
          result = `${value.amplitudeX} ${Number.isFinite(value.frequency) ? value.frequency : 0.2}`;
        }
        else {
          result = `${value.amplitudeX} ${value.amplitudeY} ${value.amplitudeZ} ${Number.isFinite(value.frequency) ? value.frequency : 0.2}`;          
        }
      }
    }
    return result;
  }  
  
  static writeColors(value) {
    return value.map((c) => `${c.id}${c.exId == null ? '' : '(' + c.exId + ')'}:${c._color}`).join(' ');
  }
}

// =====================================================
// ../smoothvoxels/io/texturedefinitions.js
// =====================================================

(function() {
  
  SVOX.TEXTUREDEFINITIONS = {
  
    // The order determines the write order

    _texture: {
      doc: "Texture properties"
    },
    id: {
      doc: "The texture Id, which material maps reference.",
      format: "<string>",
      values: undefined,
      completion: "",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "id"),
    },
    borderOffset: {
      doc: "The borderoffset prevents texture bleeding. The default is 0.5 pixels but high resolutions textures may require a higher value.",
      format: "<borderoffset>",
      values: undefined,
      completion: "0.5",
      dontWrite: "0.5",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "borderoffset", 0.5),
    },
    size: {
      doc: "Used to prevent bleeding (reduce by setting size smaller).",
      format: "<float:size> | <x> <y>",
      values: undefined,
      completion: "512 512",
      dontWrite: undefined,
      write: (v) => `${v.x} ${v.y}`,
      parse: PropertyParser.parseXYFloat.bind(null, "size", true, undefined, undefined),
    },
    cube: {
      doc: "Wheter this is a cube texture.",
      format: undefined,
      values: ["true","false"],
      completion: "false",
      dontWrite: "false",
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "cube", undefined),
    },
    image: {
      doc: "The image in Base64 format. Load in the playground using 'Add Image'.",
      format: "data:image/<type>;base64,...",
      values: undefined,
      completion: "",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseString.bind(null, "image"),
    }
  };
})();

// =====================================================
// ../smoothvoxels/io/texturereader.js
// =====================================================

class TextureReader {
  
  static read(parameters, modelName) {
    let definitions = SVOX.TEXTUREDEFINITIONS;
       
    this._cleanupParameters(parameters, modelName);
    
    let settings = { 
    };

    try {     
      for (const property in definitions) {
        let def = definitions[property];
        let value = parameters[property];
        if (def.parse) {
          value = def.parse(value);
        }
        if (value !== undefined) {
          settings[property] = value;
        }
      }    
    }
    catch (err) {
      throw { 
        name:err.name, 
        message:`(${modelName}) ${err.message}`
      };
    }
    
    this._validateSettings(settings, modelName);
    
    return settings;
  }
  
  // Rename the (typically all lower case) svox properties to camelCase
  // Ensure that there are no unknown properties
  static _cleanupParameters(parameters, modelName) {    
    let definitions = SVOX.TEXTUREDEFINITIONS;
    
    for(const property in parameters) {
      let found = false;

      for (const propertyName in definitions) {
        if (property.toLowerCase() === propertyName.toLowerCase()) {
          found = true;
          
          // Rename to normal javascript camelCasing if needed
          if (property !== propertyName) {
            parameters[propertyName] = parameters[property];
            delete parameters[property];
          }
          
          break;
        }
      }

      if (!found) {
        throw {
            name: 'SyntaxError',
            message: `(${modelName}) Unknown property '${property}' found in texture.`
        };                  
      }
    } 
  }
  
  // Validate / improve the settings where needed
  static _validateSettings(settings, modelName) {

    if (!settings.id) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) Mandatory property 'id' not set in texture.`
      };    
    }
    
    if (!settings.image) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) Mandatory property 'image' not set in texture '${settings.id}'.`
      };    
    }
  }
}

// =====================================================
// ../smoothvoxels/io/texturewriter.js
// =====================================================

class TextureWriter { 
  
  static write(texture) {
    let definitions = SVOX.TEXTUREDEFINITIONS;
    
    let out = [];
    for (const property in texture) {
      let def = definitions[property];
      if (def !== undefined && texture[property] !== undefined) {
        let value = def.write ? def.write(texture[property]) : `${texture[property]}`;
        if (value !== def.dontWrite) {
          out.push(`${property.toLowerCase()} = ${value}`)
        }
      }
    }
    
    return 'texture ' + out.join(', ');
  }
  
}

// =====================================================
// ../smoothvoxels/io/lightdefinitions.js
// =====================================================

(function() {
  
  SVOX.LIGHTDEFINITIONS = {
  
    // The order determines the write order

    _light: {
      doc: "Light properties"
    },
    color: {
      doc: "The light color (default #FFF).",
      format: "<#RGB|#RRGGBB>",
      values: undefined,
      completion: "#F80",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseColor.bind(null, "color", "#FFF"),
    },  
    intensity: {
      doc: "The intensity of the light.",
      format: "<float>",
      values: undefined,
      completion: "0.5",
      dontWrite: "1",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "intensity", 1),
    },  
    direction: {
      doc: "The direction from which the directional light shines.",
      format: "<x> <y> <z>",
      values: undefined,
      completion: "1 1 0",
      dontWrite: undefined,
      write: (v) => `${v.x} ${v.y} ${v.z}`,
      parse: PropertyParser.parseXYZFloat.bind(null, "direction", false, undefined, undefined, undefined),
    },
    atVoxel: {
      doc: "The color Id of the voxel(s) for which a light is created in its center. May result in many lights and slow rendering! ",
      format: "<ColorId>",
      values: undefined,
      completion: "V",
      dontWrite: undefined,
      write: (v) => `${v}`,
      parse: PropertyParser.parseColorId.bind(null, "atvoxel"),
    },
    position: {
      doc: "The position (in world coordinates!) at which the positional light is located. Distance & size in world units.",
      format: "<x> <y> <z>",
      values: undefined,
      completion: "2 2 0",
      dontWrite: undefined,
      write: (v) => `${v.x} ${v.y} ${v.z}`,
      parse: PropertyParser.parseXYZFloat.bind(null, "position", false, undefined, undefined, undefined),
    },
    distance: {
      doc: "For 'atvoxel' the distance in voxels that the light travels, but for 'position' these are world units",
      format: "<float>",
      values: undefined,
      completion: "10",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "distance", undefined),
    },  
    size: {
      doc: "The size of the visible positional light sphere. For 'atvoxel' in voxels, for 'position' in world units.",
      format: "<float>",
      values: undefined,
      completion: "1",
      dontWrite: "0",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "size", 0),
    },  
    detail: {
      doc: "The detail of the visible positional light sphere.",
      format: undefined,
      values: ["0","1","2","3"],
      completion: "2",
      dontWrite: "1",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "detail", undefined),
    },
    castShadow: {
      doc: "Defines whether this light casts baked shadows. Add castshadow = false to materials that have atvoxel lights.",
      format: undefined,
      values: ["true","false"],
      completion: "true",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "castShadow", undefined),
    },     
    data: {
      doc: "Vertex data for use in shaders, so only for visible lights (detail <> 0). Names and values must match model data.",
      format: "[<attributename> <float1> ... <float4>]+ ",
      values: undefined,
      completion: "data 0.5 0.5",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeVertexData(v),
      parse: PropertyParser.parseData.bind(null, "data"),
    },    
};
})();

// =====================================================
// ../smoothvoxels/io/lightreader.js
// =====================================================

class LightReader {
  
  static read(parameters, modelName) {
    let definitions = SVOX.LIGHTDEFINITIONS;
    
    this._cleanupParameters(parameters, modelName);
    
    let settings = { 
    };
    
    try {     
      for (const property in definitions) {
        let def = definitions[property];
        let value = parameters[property];
        if (def.parse) {
          value = def.parse(value);
        }
        if (value !== undefined) {
          settings[property] = value;
        }
      }
    }
    catch (err) {
      throw { 
        name:err.name, 
        message:`(${modelName}) ${err.message}`
      };
    }
    
    
    this._validateSettings(settings, modelName);
    
    return settings;
  }
  
  // Rename the (typically all lower case) svox properties to camelCase
  // Ensure that there are no unknown properties
  static _cleanupParameters(parameters, modelName) {    
    let definitions = SVOX.LIGHTDEFINITIONS;
    
    for(const property in parameters) {
      let found = false;

      for (const propertyName in definitions) {
        if (property.toLowerCase() === propertyName.toLowerCase()) {
          found = true;
          
          // Rename to normal javascript camelCasing if needed
          if (property !== propertyName) {
            parameters[propertyName] = parameters[property];
            delete parameters[property];
          }
          
          break;
        }
      }

      if (!found) {
        throw {
            name: 'SyntaxError',
            message: `(${modelName}) Unknown property '${property}' found in light.`
        };                  
      }
    } 
  }
  
  // Validate / improve the settings where needed
  static _validateSettings(settings, modelName) {
    
    // detail can be 0, 1, 2 or 3
    if (settings.detail !== undefined) {
      settings.detail = Math.round(Math.min(3, Math.max(0, settings.detail)));
    }

    if (settings.direction && settings.position) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) A light cannot have a 'direction' as well as a 'position'.`
      };    
    }

    if (settings.direction && settings.atVoxel) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) A light cannot have 'direction' as well as 'atvoxel'.`
      };    
    }

    if (settings.position && settings.atVoxel) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) A light cannot have a 'position' as well as 'atvoxel'.`
      };    
    }

    if (settings.distance && !settings.position && !settings.atVoxel) {
      throw {
          name: 'SyntaxError',
          message: `'(${modelName}) Distance' is only supported for lights with a 'position' or 'atvoxel'.`
      };    
    }
    
    if (settings.castShadow && !settings.direction && !settings.position && !settings.atVoxel) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) Castshadow is only allowed in lights that have 'direction' or 'position'.`
      };    
    }

    if (!settings.position && !settings.atVoxel && (settings.size || settings.detail)) {
      throw {
        name: 'SyntaxError',
        message: `(${modelName}) Only lights with a 'position' or 'atvoxel' can have size and detail.`
      };        
    }
    
    if (settings.size > 0 && settings.detail === undefined) {
      settings.detail = 1;
    }

    if ((settings.size === undefined || settings.size === 0) && settings.detail !== undefined) {
       SVOX.logWarning( { 
         name: 'LightWarning', 
         message: `(${modelName}) The light detail will be ignored because the size is not specified.` 
       }); 
    }
    
    if (settings.size === undefined && settings.data !== undefined) {
      throw {
        name: 'SyntaxError',
        message: `(${modelName}) Only visible lights, with a size property, can specify a data property.`
      };        
    }
    
    if (settings.direction && settings.direction.x === 0 && settings.direction.y === 0 && settings.direction.z === 0) {
      throw {
        name: 'SyntaxError',
        message: `(${modelName}) The direction of a directional light cannot be '0 0 0'.`
      };        
    }
  }
}

// =====================================================
// ../smoothvoxels/io/lightwriter.js
// =====================================================

class LightWriter { 
  
  static write(light) {
    let definitions = SVOX.LIGHTDEFINITIONS;
    
    let out = [];
    for (const property in light) {
      let def = definitions[property];
      if (def !== undefined && light[property] !== undefined) {
        let value = def.write ? def.write(light[property]) : `${light[property]}`;
        if (value !== def.dontWrite) {
          out.push(`${property.toLowerCase()} = ${value}`)
        }
      }
    }
    
    return 'light ' + out.join(', ');
  }
  
}

// =====================================================
// ../smoothvoxels/io/groupdefinitions.js
// =====================================================

(function() {
  
  SVOX.GROUPDEFINITIONS = {
  
    // The order determines the write order

    _group: {
      doc: "Group properties"
    },
    id: {
      doc: "The optional group Id, add materials to a group by adding group = <groupid> to the material.",
      format: "<string>",
      values: undefined,
      completion: "",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "id", undefined),
    },   
    clone: {
      doc: "Clone another group to reuse it, overwriting any of its properties, e.g. rotating or scaling the group and its children.",
      format: "<string>",
      values: undefined,
      completion: "",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "clone", undefined),
    },    
    prefab: {
      doc: "Prefab groups are clonable templates. Prefab properties are not overwritten when cloning. Prefabs cannot be nested.",
      format: undefined,
      values: ["true","false"],
      completion: "true",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "prefab", undefined),
    },    
    group: {
      doc: "The group Id from a parent group, to which this group is attached, following it for rotation and translation.",
      format: "<string>",
      values: undefined,
      completion: "",
      dontWrite: '*',
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "group", '*'),
    },      
    scale: {
      doc: "The scale of the voxels for this group in voxels (0.5 = half the size of voxels in model).",
      format: "<x> [<y> <z>]",
      values: undefined,
      completion: "1 1 1",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeFloatXYZ(v, true),
      parse: PropertyParser.parseScale.bind(null, "scale", undefined)
    },
    shape: {
      doc: "Reshapes the group to fit in this shape.",
      format: undefined,
      values: ["box","sphere","cylinder-x","cylinder-y","cylinder-z"],
      completion: "cylinder-y",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseEnum.bind(null, "shape", ["box", "sphere", "cylinder-x", "cylinder-y", "cylinder-z"], undefined),
    },    
    origin: {
      doc: "The origin for the group.",
      format: "{ -x x +x -y y +y -z z +z }",
      values: undefined,
      completion: "-y",
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarPoint.bind(null, "origin", undefined),
    },      
    resize: {
      doc: "Compensates for size change due to deform, warp or scatter.",
      format: undefined,
      values: ["bounds","fit","fill"],
      completion: "fit",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseEnum.bind(null, "resize", ["bounds", "fit", "fill"], undefined),
    },          
    rotation: {
      doc: "The rotation of the group around its center over the three axes.",
      format: "<float:x> <float:y> <float:z>",
      values: undefined,
      completion: "0 45 0",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeFloatXYZ(v, false),
      parse: PropertyParser.parseXYZFloat.bind(null, "rotation", false, undefined, undefined, undefined),
    },
    position: {
      doc: "The position of the group (in voxels coordinates from the parent group or model origin).",
      format: "<float:x> <float:y> <float:z>",
      values: undefined,
      completion: "0 0.5 0",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeFloatXYZ(v, false),
      parse: PropertyParser.parseXYZFloat.bind(null, "position", false, undefined, undefined, undefined),
    },  
    translation: {
      doc: "The translation of the group (in voxels coordinates from the original group position).",
      format: "<float:x> <float:y> <float:z>",
      values: undefined,
      completion: "0 0 0",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeFloatXYZ(v, false),
      parse: PropertyParser.parseXYZFloat.bind(null, "translation", false, undefined, undefined, undefined),
    },
    recolor: {
      doc: "Recolor (some of) the colors for this group, or its sub groups, by specifying a new hexadecimal RGB value for them.",
      format: "[<colorid>:<#RGB|#RRGGBB>]+",
      values: undefined,
      completion: "V:#F80",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeColors(v),
      parse: PropertyParser.parseColors.bind(null, "recolor"),
    }    
  };
})();

// =====================================================
// ../smoothvoxels/io/groupreader.js
// =====================================================

class GroupReader {
  
  static read(parameters, modelName) {
    let definitions = SVOX.GROUPDEFINITIONS;
    
    this._cleanupParameters(parameters, modelName);
    
    // NOTE: Clones are generated in the mesh generator!
    
    let settings = { 
    };
    
    try {     
      for (const property in definitions) {
        let def = definitions[property];
        let value = parameters[property];
        if (def.parse) {
          value = def.parse(value, def);
        }
        if (value !== undefined) {
          settings[property] = value;
        }
      }    
    }
    catch (err) {
      throw { 
        name:err.name, 
        message:`(${modelName}) ${err.message}`
      };
    }
    
    if (settings.id === '*' && settings.group === '*') {
      // The default for (parent) group is '*', so clear that for the '*' group itself
      settings.group = undefined;
    }    
    
    this._validateSettings(settings, modelName);
    
    return settings;
  }
  
  // Rename the (typically all lower case) svox properties to camelCase
  // Ensure that there are no unknown properties
  static _cleanupParameters(parameters, modelName) {  
    let definitions = SVOX.GROUPDEFINITIONS;
    
    for(const property in parameters) {
      let found = false;

      for (const propertyName in definitions) {
        if (property.toLowerCase() === propertyName.toLowerCase()) {
          found = true;
          
          // Rename to normal javascript camelCasing if needed
          if (property !== propertyName) {
            parameters[propertyName] = parameters[property];
            delete parameters[property];
          }
          
          break;
        }
      }

      if (!found) {
        throw {
            name: 'SyntaxError',
            message: `(${modelName}) Unknown property '${property}' found in group.`
        };                  
      }
    } 
  }
  
  // Validate / improve the settings where needed
  static _validateSettings(settings, modelName) {
    if (!settings.id) {
      settings.id = 'UnnamedGroup' + SVOX.groupIdCount++;
    }      
    if (settings.id === settings.clone) {
      throw {
        name: 'ModelError',
        message: `(${modelName}) Group '${settings.id}' cannot clone itself.`,
      };
    }
    if (settings.translation && settings.position) {
      throw {
        name: 'ModelError',
        message: `(${modelName}) Group '${settings.id}' uses translation, so it cannot also have a position.`,
      };
    }    
  }
}

// =====================================================
// ../smoothvoxels/io/groupwriter.js
// =====================================================

class GroupWriter { 
  
  static write(group) {
    let definitions = SVOX.GROUPDEFINITIONS;
    
    let out = [];
    for (const property in group) {
      // Don't write id's for groups that did not have a name to start with
      if (property === 'id' && group[property].startsWith('UnnamedGroup'))
        continue;
      
      let def = definitions[property];
      if (def !== undefined && group[property] !== undefined) {
        let value = def.write ? def.write(group[property]) : `${group[property]}`;
        if (value !== def.dontWrite) {
          out.push(`${property.toLowerCase()} = ${value}`)
        }
      }
    }
    
    return 'group ' + out.join(', ');
  }
  
}

// =====================================================
// ../smoothvoxels/io/materialdefinitions.js
// =====================================================

(function() {
  
  // Shortcuts for the definition
  let base     = true;
  let basic    = true;
  let lambert  = true;
  let phong    = true;
  let standard = true;
  let physical = true;
  let toon     = true;
  let matcap   = true;
  let normal   = true;
  
  SVOX.MATERIALDEFINITIONS = {
  
    // The order determines the write order

    _main: {
      doc: "Material properties"
    },
    type: {
      doc: "The material type.",
      format: undefined,
      values: ["standard","phong","lambert","basic","toon","matcap","normal"],
      completion: "basic",
      base, basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "standard",
      write: undefined,
      parse: PropertyParser.parseEnum.bind(null, "type", [ "basic", "phong", "lambert", "standard", "physical", "toon", "matcap", "normal" ], "standard"),
    },
    name: {
      doc: "Internal material name (different names means extra materials / draw calls!).",
      format: "<string>",
      values: undefined,
      completion: "MyMaterial",
      base, basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "name", undefined),
    },
    group: {
      doc: "The group Id from a group, to allow for rotation and translation of this separate group.",
      format: "<string>",
      values: undefined,
      completion: "",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: '*',
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "group", '*'),
    },    
    lighting: {
      doc: "The lighting of the surface. Smooth, flat (triangles), quad (rectangles) or both.",
      format: undefined,
      values: ["flat","quad","smooth","both"],
      completion: "",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "flat",
      write: undefined,
      parse: PropertyParser.parseEnum.bind(null, "lighting", ["flat", "quad", "smooth", "both"], "flat"),
    },
    side: {
      doc: "Defines which side of faces will be rendered.",
      format: undefined,
      values: ["front","back","double"],
      completion: "double",
      base, basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "front",
      write: undefined,
      parse: PropertyParser.parseEnum.bind(null, "side", ["front", "back", "double"], "front"),
    },
    shadowSide: {
      doc: "Defines which side of faces cast shadows. Note, this is only applied to real lights, it is ignored for baked shadows!!",
      format: undefined,
      values: ["front","back","double"],
      completion: "double",
      base, basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseEnum.bind(null, "shadowSide", ["front", "back", "double"], undefined),
    },
    wireframe: {
      doc: "Render the material as wireframe.",
      format: undefined,
      values: ["true","false"],
      completion: "true",
      base, basic, lambert, phong, standard, physical, toon, normal,
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "wireframe", undefined),
    },        
    _surface: {
      doc: "Surface properties"
    },
    shininess: {
      doc: "A higher value (>1000) gives a sharper specular highlight.",
      format: "<shininess>",
      values: undefined,
      completion: "1000",
      base, phong, 
      dontWrite: "30",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "shininess", 30),
    },
    reflectivity: {
      doc: "Degree of reflectivity. Default is 0.5. For physical also changes refraction. Do not forget to set envmap for basic, lambert and phong materials!",
      format: "<reflectivity>",
      values: undefined,
      completion: "1",
      base, basic, lambert, phong, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "reflectivity", undefined),
    },
    combine: {
      doc: "How to combine the environment map, if any, with the diffuse color.",
      format: undefined,
      values: ["add","multiply","mix"],
      completion: 'add',
      base, basic, lambert, phong, 
      dontWrite: "mix",
      write: undefined,
      parse: PropertyParser.parseEnum.bind( null, "combine", ["multiply", "mix", "add"], "mix"),
    },
    roughness: {
      doc: "How rough the material appears. 0.0 means a smooth mirror reflection.",
      format: "<float>",
      values: undefined,
      completion: 0.5,
      base, standard, physical, 
      dontWrite: "1",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "roughness", 1),
    },
    metalness: {
      doc: "How much the material is like a metal. ",
      format: "<float>",
      values: undefined,
      completion: 0.5,
      base, standard, physical, 
      dontWrite: "0",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "metalness", 0),
    },
    _maps: {
      doc: "Maps"
    },
    map: {
      doc: "Model texture. An alpha channel should be combined with transparent or alphatest.",
      format: "<textureid:RGB>",
      values: undefined,
      completion: "",
      base, basic, lambert, phong, standard, physical, toon, matcap, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "map", undefined),
    },
    mapTransform: {
      doc: "Shift, scale or rotate textures.",
      format: "<width> <height> [<xoffset> <yoffset> [<rotation>]]",
      values: undefined,
      completion: "2 2 0.5 0.5 45",
      base, basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "-1 -1",
      write: (v) => PropertyWriter.writeMapTransform(v),
      parse: PropertyParser.parseMapTransform.bind(null, "maptransform"),
    },
    normalMap: {
      doc: "The texture to create a normal map (e.g. visual bumps or ridges). ",
      format: "<textureid:Normal>",
      values: undefined,
      completion: "",
      base, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "normalmap", undefined),
    },
    normalScale: {
      doc: "How much the normal map affects the material. Allows for two values.",
      format: "<scale>|<xscale> <yscale>",
      base, lambert, phong, standard, physical, toon, matcap, normal,
      values: undefined,
      completion: "1 1",
      dontWrite: "1 1",
      write: (v) => `${v.x} ${v.y}`,
      parse: PropertyParser.parseXYFloat.bind(null, "normalscale", true, 1, 1),
    },
    bumpMap: {
      doc: "The texture to create a bump map (e.g. visual bumps or ridges). ",
      format: "<textureid:Greyscale>",
      values: undefined,
      completion: "",
      base, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "bumpmap", undefined),
    },
    bumpScale: {
      doc: "How much the bump map affects the material.",
      format: "<float>",
      values: undefined,
      completion: "1",
      base, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "1",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "bumpscale", 1),
    },
    envMap: {
      doc: "The environment map. You must set this for basic, lambert and phong materials as it is only automatically set for standard and physical materials!",
      format: "<textureid:RGB>",
      values: undefined,
      completion: "env",
      base, basic, lambert, phong, standard, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "envmap", undefined),
    },
    envMapIntensity: {
      doc: "Scales the effect of the environment map by multiplying its color.",
      format: "<float>",
      values: undefined,
      completion: "1",
      base, standard, physical, 
      dontWrite: "1",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "envmapintensity", 1),
    },
    roughnessMap: {
      doc: "The green channel alters the roughness of the material (requires roughness > 0).",
      format: "<textureid:Green-channel>",
      values: undefined,
      completion: "",
      base, standard, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "roughnessmap", undefined),
    },
    metalnessMap: {
      doc: "The blue channel is used, multiplied by metalness (i.e. use metalness = 1)",
      format: "<textureid:Blue-channel>",
      values: undefined,
      completion: "",
      base, standard, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "metalnessmap", undefined),
    },
    matcap: {
      doc: "The matcap map. See https://observablehq.com/@makio135/matcaps",
      format: "<textureid:RGB>",
      values: undefined,
      completion: "",
      base, matcap, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "matcap", undefined),
    },
    _transparency:{
      doc: "Transparency properties"
    },
    opacity: {
      doc: "A value of 0.0 indicates fully transparent, 1.0 is fully opaque.",
      format: "<float>",
      values: undefined,
      completion: "1",
      base, basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "1",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "opacity", 1),
    },
    transparent: {
      doc: "Defines whether this material is transparent. Mostly set automatically.",
      format: undefined,
      values: ["true","false"],
      completion: true,
      base, basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "transparent", undefined),
    },
    alphaTest: {
      doc: "The material will not see through if the opacity in the map is lower than this value. ",
      format: "<float>",
      values: undefined,
      completion: "0.5",
      base, basic, lambert, phong, standard, physical, toon, matcap,
      dontWrite: "0",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "alphatest", 0),
    },
    alphaToCoverage: {
      doc: "Enable alpha to coverage to improve foliage transparency handling.",
      format: undefined,
      values: ["true","false"],
      completion: true,
      base, basic, lambert, phong, standard, physical, toon, matcap,
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "alphatocoverage", undefined),
    },
    alphaMap: {
      doc: "Controls the opacity (0: transparent; 255: opaque).",
      format: "<textureid:Green-channel>",
      values: undefined,
      completion: "",
      base, basic, lambert, phong, standard, physical, toon, matcap, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "alphamap", undefined),
    },
    _emissive: {
      doc: "Emissive properties"
    },
    emissive: {
      doc: "Emissive (light) color of the material.",
      format: "<#RGB|#RRGGBB>",
      values: undefined,
      completion: "#FFF",
      base, lambert, phong, standard, physical, toon, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseColor.bind(null, "emissive", undefined),
    },
    emissiveIntensity: {
      doc: "The intensity of the emissive light.",
      format: "<float>",
      values: undefined,
      completion: "1",
      base, lambert, phong, standard, physical, toon, 
      dontWrite: "1",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "emissiveintensity", 1),
    },
    emissiveMap: {
      doc: "Emissive (glow) map (requires emissive color not black and emissiveintensity > 0)",
      format: "<textureid:RGB>",
      values: undefined,
      completion: "",
      base, lambert, phong, standard, physical, toon, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "emissivemap", undefined),
    },
    _specular: {
      doc: "Specular properties"
    },
    specular: {
      doc: "Specular color of the material. Default is #111 (very dark grey).",
      format: "<#RGB|#RRGGBB>",
      values: undefined,
      completion: "#888",
      base, phong, 
      dontWrite: "#111",
      write: undefined,
      parse: PropertyParser.parseColor.bind(null, "specular", "#111"),
    },
    specularMap: {
      doc: "Specular map used by the material. Default is null.",
      format: "<textureid:Greyscale>",
      values: undefined,
      completion: "",
      base, basic, lambert, phong, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "specularmap", undefined),
    },
    specularColor: {
      doc: "Specular color of the material. Default is #FFF (white).",
      format: "<#RGB|#RRGGBB>",
      values: undefined,
      completion: "#FF0",
      base, physical, 
      dontWrite: "#FFF",
      write: undefined,
      parse: PropertyParser.parseColor.bind(null, "specular", "#FFF"),
    },
    specularColorMap: {
      doc: "The RGB channels of this texture are multiplied against .specularColor.",
      format: "<textureid:RGB>",
      values: undefined,
      completion: "",
      base, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "specularcolormap", undefined),
    },
    specularIntensity: {
      doc: "A float that scales the amount of specular reflection for non-metals only.",
      format: "<float>",
      values: undefined,
      completion: "1",
      base, physical, 
      dontWrite: "1",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "specularintensity", 1),
    },
    specularIntensityMap: {
      doc: "The alpha channel of this texture is multiplied against specularintensity.",
      format: "<textureid:Alpha-channel>",
      values: undefined,
      completion: "",
      base, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "specularintensitymap", undefined),
    },
    _refraction: {
      doc: "Refraction properties"
    },
    refractionRatio: {
      doc: "Index of refraction of air (~1) divided by the index of refraction of the material.",
      format: "<float>",
      values: undefined,
      completion: "0.9",
      base, basic, lambert, phong, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "refractionratio", undefined),
    },
    ior: {
      doc: "Index-of-refraction for non-metallic materials, from 1.0 to 2.333. Default is 1.5.",
      format: "<float>",
      values: undefined,
      completion: "1.5",
      base, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "ior", undefined),
    },
    thickness: {
      doc: "The thickness of the volume beneath the surface for refraction.",
      format: "<float>",
      values: undefined,
      completion: "1",
      base, physical, 
      dontWrite: "0",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "thickness", 0),
    },
    thicknessMap: {
      doc: "G channel defines the thickness. Multiplied by thickness.",
      format: "<textureid:Green-channel>",
      values: undefined,
      completion: "",
      base, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "thicknessmap", undefined),
    },
    transmission: {
      doc: "Degree of transmission (or optical transparency), from 0.0 to 1.0.",
      format: "<float>",
      values: undefined,
      completion: "0.5",
      base, physical, 
      dontWrite: "1",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "transmission", 1),
    },
    transmissionMap: {
      doc: "The red channel of this texture is multiplied against transmission.",
      format: "<textureid:Red-channel>",
      values: undefined,
      completion: "",
      base, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "transmissionmap", undefined),
    },
    attenuationColor: {
      doc: "The color that white light turns into due to absorption at the attenuation distance.",
      format: "<#RGB|#RRGGBB>",
      values: undefined,
      completion: "#F88",
      base, physical, 
      dontWrite: "#FFF",
      write: undefined,
      parse: PropertyParser.parseColor.bind(null, "attenuationcolor", "#FFF"),
    },
    attenuationDistance: {
      doc: "The average distance (related to the thickness value) that light travels before interacting with a particle.",
      format: "<float>",
      values: undefined,
      completion: "1",
      base, physical, 
      dontWrite: "Infinity",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "attenuationdistance", Infinity),
    },
    _clearcoat: {
      doc: "Clearcoat properties"
    },
    clearcoat: {
      doc: "The intensity of the clear coat layer, from 0.0 to 1.0. ",
      format: "<float>",
      values: undefined,
      completion: "1",
      base, physical, 
      dontWrite: "0",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "clearcoat", 0),
    },
    clearcoatMap: {
      doc: "The red channel of this texture is multiplied against clearcoat.",
      format: "<textureid:Red-channel>",
      values: undefined,
      completion: "",
      base, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "clearcoatmap", undefined),
    },
    clearcoatNormalMap: {
      doc: "Enables independent normals for the clear coat layer.",
      format: "<textureid:Normal>",
      values: undefined,
      completion: "",
      base, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "clearcoatnormalmap", undefined),
    },
    clearcoatNormalScale: {
      doc: "How much the clearcoatnormalmap affects the clear coat layer, from (0,0) to (1,1).",
      format: "<scale>|<xscale> <yscale>",
      values: undefined,
      completion: "1 1",
      base, physical, 
      dontWrite: "1 1",
      write: (v) => `${v.x} ${v.y}`,
      parse: PropertyParser.parseXYFloat.bind(null, "normalscale", true, 1, 1),
    },
    clearcoatRoughness: {
      doc: "Roughness of the clear coat layer, from 0.0 to 1.0. Default is 0.0.",
      format: "<float>",
      values: undefined,
      completion: "0.5",
      base, physical, 
      dontWrite: "0",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "clearcoatroughness", 0),
    },
    clearcoatRoughnessMap: {
      doc: "Requires clearcoatroughness > 1.",
      format: "<textureid:Green-channel>",
      values: undefined,
      completion: "",
      base, physical, 
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "clearcoatroughnessmap", undefined),
    },
    _displacement:{
      doc: "Displacement properties",
    },
    displacementMap: {
      doc: "White=high. Flat planes, a normalmap and simplify = false work best.",
      format: "<textureid:Greyscale>",
      values: undefined,
      completion: "",
      base, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseName.bind(null, "displacementmap", undefined),
    },
    displacementScale: {
      doc: "How much the displacement map affects the mesh.",
      format: "<float>",
      values: undefined,
      completion: "1",
      base, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "1",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "displacementscale", 1),
    },
    displacementBias: {
      doc: "The offset of the displacement map's values on the mesh's vertices. ",
      format: "<float>",
      values: undefined,
      completion: "0",
      base, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "0",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "displacementbias", 0),
    },
    _effects: {
      doc: "Effects properties"
    },
    blending: {
      doc: "Blending mode.",
      format: undefined,
      values: ["no","normal","additive","subtractive","multiply"],
      completion: "additive",
      base, basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "normal",
      write: undefined,
      parse: PropertyParser.parseEnum.bind(null, "blending", ["no", "normal", "additive", "subtractive", "multiply"], "normal"),
    },
    dithering: {
      doc: "Whether to apply dithering to remove the appearance of banding in slow gradients.",
      format: undefined,
      values: ["true","false"],
      completion: "true",
      base, basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "false",
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "dithering", false),
    },
    fog: {
      doc: "Whether the material is affected by fog in a scene. Default is true.",
      format: undefined,
      values: ["true","false"],
      completion: true,
      base, basic, lambert, phong, standard, physical, toon, matcap,
      dontWrite: "true",
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "fog", true),
    },
    lights: {
      doc: "Whether Smooth Voxel lights affect this surface.",
      format: undefined,
      values: ["true","false"],
      completion: false,
      basic, lambert, phong, standard, physical, toon, matcap, 
      dontWrite: "true",
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "lights", true),
    },
    castShadow: {
      doc: "Defines whether this material casts baked shadows (and ao!). Add castshadow = false to materials that have atvoxel lights.",
      format: undefined,
      values: ["true","false"],
      completion: "false",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "true",
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "castShadow", true),
    },
    receiveShadow: {
      doc: "Defines whether this material receives baked shadows (and ao!). By default materials receive baked shadows if a light with castshadow = true is present.",
      format: undefined,
      values: ["true","false"],
      completion: "false",
      basic, lambert, phong, standard, physical, toon, matcap,
      dontWrite: "true",
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "receiveShadow", true),
    },      
    ao: {
      doc: "Calculate ambient occlusion.",
      format: "<#RGB|#RRGGBB> <maxdistance> [<intensity>] [<angle>]",
      values: undefined,
      completion: "#400 5 0.5",
      basic, lambert, phong, standard, physical, toon, matcap, 
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeAo(v),
      parse: PropertyParser.parseAo.bind(null, "ao"),
    },
    quickAo: {
      doc: "Determines ambient occlusion by checking immediate neighboring voxels. Not suitable for deformed models. Overrules ao on the model.",
      format: "<#RGB|#RRGGBB> [<intensity>]",
      values: undefined,
      completion: "#400 0.5",
      basic, lambert, phong, standard, physical, toon, matcap, 
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeQuickAo(v),
      parse: PropertyParser.parseQuickAo.bind(null, "quickao"),
    },    
    shell: {
      doc: "Material shell or shells.",
      format: "[<colorId> <distance>]+",
      values: undefined,
      completion: "V 0.5 W 0.5",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeShell(v),
      parse: PropertyParser.parseShell.bind(null, "shell"),
    },
    _deformation: {
      doc: "Deformation properties"
    },
    deform: {
      doc: "Deforms the surface by repeated averaging of vertices.",
      format: "<int:count> <float:strength> <float:damping>",
      values: undefined,
      completion: "3 1",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeDeform(v),
      parse: PropertyParser.parseDeform.bind(null, "deform"),
    },
    warp: {
      doc: "Warps the voxels with an amplitude (distance in voxels) and frequency (in voxels). For ",
      format: "<float:ampl> [<float:freq>] OR <amplX> <amplY> <amplZ> [<freq>]",
      values: undefined,
      completion: "1 0.2",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeWarp(v),
      parse: PropertyParser.parseWarp.bind(null, "warp"),
    },
    scatter: {
      doc: "Scatters the vertices. Distance is in voxels",
      format: "<float>",
      values: undefined,
      completion: "0.5",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: "0",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "scatter", 0),
    },
    _planar: {
      doc: "Planar properties"
    },
    flatten: {
      doc: "Flattens as if a part is cut off. Note: uses material bounds, not model bounds.",
      format: "{ -x x +x -y y +y -z z +z | none }",
      values: undefined,
      completion: "-y",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarPlanes.bind(null, "flatten"),
    },
    clamp: {
      doc: "Flattens with peripendicular sides. Note: uses material bounds, not model bounds.",
      format: "{ -x x +x -y y +y -z z +z | none }",
      values: undefined,
      completion: "-y",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarPlanes.bind(null, "clamp"),
    },
    skip: {
      doc: "Faces are not created, do not influence other faces, do not have shells, etc. Note: uses material bounds, not model bounds.",
      format: "{ -x x +x -y y +y -z z +z | none }",
      values: undefined,
      completion: "-y",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarPlanes.bind(null, "skip"),
    },
    hide: {
      doc: "Faces are created, influence other faces, have shells, etc. but do not add ambient occlusion, and are not created in the mesh. Note: uses material bounds, not model bounds.",
      format: "{ -x x +x -y y +y -z z +z | none }",
      values: undefined,
      completion: "x y z",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarPlanes.bind(null, "hide"),
    },
    _shader: {
      doc: "Shader properties"
    },
    simplify: {
      doc: "By default faces are combined to reduce the model memory size, which may be unwanted for shaders.",
      format: undefined,
      values: ["true","false"],
      completion: "false",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "simplify", undefined),
    },
    data: {
      doc: "Vertex data for use in shaders. Names and values must match model data.",
      format: "[<attributename> <float1> ... <float4>]+ ",
      values: undefined,
      completion: "data 0.5 0.5",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeVertexData(v),
      parse: PropertyParser.parseData.bind(null, "data"),
    },
    _colors: {
      doc: "Color properties"
    },
    fade: {
      doc: "Whether colors in this material fade into each other",
      format: undefined,
      values: ["true","false"],
      completion: "true",
      basic, lambert, phong, standard, physical, toon, matcap, 
      dontWrite: "false",
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "fade", false),
    },
    colors: {
      doc: "Colors for this material. Use fade=true to fade between them.\nMagica voxel palette index will be added when (re)loading .vox files in the playground.",
      format: "[<colorid>:<#RGB|#RRGGBB>]+|\n[<colorid>(<magicavoxindex>):<#RGB|#RRGGBB>]+",
      values: undefined,
      completion: "V:#F80",
      basic, lambert, phong, standard, physical, toon, matcap, normal,
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeColors(v),
      parse: PropertyParser.parseColors.bind(null, "colors"),
    }
  };
  
  function setAllowedFor(definitions) {
    for (const property in definitions) {
      let def = definitions[property];
      let count = (def.basic?1:0)    + 
                  (def.lambert?1:0)  + 
                  (def.phong?1:0)    + 
                  (def.standard?1:0) + 
                  (def.physical?1:0) + 
                  (def.toon?1:0)     + 
                  (def.matcap?1:0)   + 
                  (def.normal?1:0);
      if (count === 8) {
        def.allowedFor = "Allowed for all materials"
      }
      else if (count <= 4) {
        def.allowedFor = "Allowed for "
        if (def.basic   ) def.allowedFor += "basic, ";
        if (def.lambert ) def.allowedFor += "lambert, ";
        if (def.phong   ) def.allowedFor += "phong, ";
        if (def.standard) def.allowedFor += "standard, ";
        if (def.physical) def.allowedFor += "physical, ";
        if (def.toon    ) def.allowedFor += "toon, ";
        if (def.matcap  ) def.allowedFor += "matcap, ";
        if (def.normal  ) def.allowedFor += "normal, "; 
        def.allowedFor = def.allowedFor.slice(0, -2);
      }        
      else {
        def.allowedFor = "NOT allowed for "
        if (!def.basic   ) def.allowedFor += "basic, ";
        if (!def.lambert ) def.allowedFor += "lambert, ";
        if (!def.phong   ) def.allowedFor += "phong, ";
        if (!def.standard) def.allowedFor += "standard, ";
        if (!def.physical) def.allowedFor += "physical, ";
        if (!def.toon    ) def.allowedFor += "toon, ";
        if (!def.matcap  ) def.allowedFor += "matcap, ";
        if (!def.normal  ) def.allowedFor += "normal, "; 
        def.allowedFor = def.allowedFor.slice(0, -2);
      }
      def.allowedFor += ".";
    }
  }
  
  setAllowedFor(SVOX.MATERIALDEFINITIONS);
})();

// =====================================================
// ../smoothvoxels/io/materialreader.js
// =====================================================

class MaterialReader {
  
  static read(parameters, modelName, noColors) {
    let definitions = SVOX.MATERIALDEFINITIONS;
    
    let settings = { 
      type: definitions.type.parse(parameters.type),
      base: {}
    };
    
    this._cleanupParameters(parameters, modelName, settings.type);
    
    // Parse only the properties for this material type
    try {     
      for (const property in definitions) {
        let def = definitions[property];      
        if (def[settings.type]) {
          let value = definitions[property].parse(parameters[property]);
          if (value !== undefined) {
            settings[property] = value;
          }
        }      
      }
    }
    catch (err) {
      throw { 
        name:err.name, 
        message:`(${modelName}) ${err.message}`
      };
    }

    this._validateSettings(settings, modelName, noColors);
    
    // Copy the base settings
    for (const property in definitions) {
      let def = definitions[property];      
      if (def[settings.type] && def.base) {
        settings.base[property] = settings[property];
      }
    }
    
    // Since the mesh generator reverses the faces a front and back side material are the same base material
    settings.base.side = (settings.side === SVOX.DOUBLE) ? SVOX.DOUBLE : SVOX.FRONT; 
    
    // SVOX.logWarning({ name:'TEST', message:MaterialWriter.write(settings) });
    
    return settings;
  }
  
  // Rename the (typically all lower case) svox properties to camelCase
  // Ensure only the relevant properties are there
  // Ensure that there are no unknown properties
  // Show which properties will be ignored because they do not belong to the material type
  // (but no error, as the user may just be experimenting with material types)
  static _cleanupParameters(parameters, modelName, type) {    
    let definitions = SVOX.MATERIALDEFINITIONS;
    
    let ignoredProperties = [];

    for(const property in parameters) {
      let found = false;

      for (const propertyName in definitions) {
        if (property.toLowerCase() === propertyName.toLowerCase()) {
          found = true;
          
          if (!definitions[propertyName][type]) {
            ignoredProperties.push(property);
          } 
          else {
            // Rename to normal javascript camelCasing if needed
            if (property !== propertyName) {
              parameters[propertyName] = parameters[property];
              delete parameters[property];
            }
          }
          
          break;
        }
      }

      if (!found) {
        throw {
            name: 'SyntaxError',
            message: `(${modelName}) Unknown property '${property}' found in material.`
        };                  
      }
    } 
    
    if (ignoredProperties.length === 1)
      SVOX.logWarning({ 
        name:'MaterialWarning', 
        message:`(${modelName}) The property '${ignoredProperties[0]}' will be ignored for material type '${type}'`
      });
    if (ignoredProperties.length > 1)
      SVOX.logWarning({ 
        name:'MaterialWarning', 
        message:`(${modelName}) The properties '${ignoredProperties.join('\', \'').replace(/,([^,]*)$/, ' and $1')}' will be ignored for material type '${type}'`
      });
  }
  
  // Validate / improve the settings where needed
  static _validateSettings(settings, modelName, noColors) {

    // Every material must have colors, unless we explicitly create a material without colors (e.g the errorMaterial, convertMagicaVoxel or convertImage)
    if (noColors) {
      settings.colors = [];
    }
    
    if (!settings.colors || (!noColors && settings.colors.length === 0)) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) Mandatory property 'colors' not set in material '${settings.type}'.`
      };    
    }
    
    if (settings.ao && settings.quickAo) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) The properties 'ao' and 'quickao' can not be used together in one material.`
      };    
    }     

    if (settings.type === SVOX.MATSTANDARD || settings.type === SVOX.MATPHYSICAL) {
      if (settings.metalness === undefined)
        settings.metalness = settings.metalnessmap ? 1 : 0;
    }
    
    if (settings.emissiveIntensity === undefined && (settings.emissive || settings.emissiveMap)) {
      settings.emissiveIntensity = 1;
    }
    
    if (settings.emissiveMap && !settings.emissive) {
      SVOX.logWarning({ 
        name: 'MaterialWarning', 
        message: `(${modelName}) Emissivemap only works in combination with emissive (e.g. emissive = #FFF) in material '${settings.type}'.` 
      });          
    }

    if (settings.transparent === undefined) {
      settings.transparent = settings.transparent || settings.opacity < 1.0 || settings.alphaMap;
    }
    
    if (!settings.metalness && settings.metalnessMap) {
      SVOX.logWarning({ 
        name: 'MaterialWarning',
        message: `(${modelName}) Metalnessmap only works in combination with a metalness > 0 in material '${settings.type}'.` 
      });          
    }

    if (!settings.roughness && settings.roughnessMap) {
      SVOX.logWarning({ 
        name: 'MaterialWarning', 
        message: `(${modelName}) Roughnessmap only works in combination with a roughness > 0 in material '${settings.type}'.` 
      });          
    }

    if (settings.clearcoatRoughnessMap && !settings.clearcoatRoughness) {
      SVOX.logWarning({ 
        name: 'MaterialWarning', 
        message: `(${modelName}) Clearcoatroughnessmap only works in combination with a clearcoatroughness > 0 in material '${settings.type}'.` 
      });          
    }

    if ((settings.type === SVOX.MATBASIC || settings.type === SVOX.MATLAMBERT || settings.type === SVOX.MATPHONG) && settings.reflectivity && !settings.envMap) {
      SVOX.logWarning({ 
        name: 'MaterialWarning', 
        message: `(${modelName}) Reflectivity only works in combination with envmap in material '${settings.type}'.` 
      });          
    }
  }
}

// =====================================================
// ../smoothvoxels/io/materialwriter.js
// =====================================================

class MaterialWriter { 
  
  static write(material) {
    let definitions = SVOX.MATERIALDEFINITIONS;
    
    let out = [];
    for (const property in material.settings) {
      let def = definitions[property];
      if (def !== undefined && material.settings[property] !== undefined) {
        let value = def.write ? def.write(material.settings[property]) : `${material.settings[property]}`;
        if (value !== def.dontWrite) {
          out.push(`${property.toLowerCase()} = ${value}`)
        }
      }
    }
    
    return 'material ' + out.join(', ');
  }
  
}

// =====================================================
// ../smoothvoxels/io/voxelreader.js
// =====================================================

class VoxelReader {
  
  /**
   * Creates all voxels in the model from the (RLE) Voxel Matrix
   * @param {Model} model The model in which the voxels will be set
   * @param {string} voxels The (RLE) voxel string
   */
  static createVoxels(model, modelName, voxels) {
      let colors = model.colors;

      let errorMaterial = null;

      // Split the voxel string in numbers, (repeated) single letters or _ , Longer color Id's or ( and ) 
      let chunks = [];
      if (voxels.matchAll)
        chunks = voxels.matchAll(/[0-9]+|[A-Z][a-z]*|-+|[()]/g);
      else {
        // In case this browser does not support matchAll, DIY match all
        let regex = RegExp('[0-9]+|[A-Z][a-z]*|-+|[()]', 'g');
        let chunk;
        while ((chunk = regex.exec(voxels)) !== null) {
          //console.log(chunk);
          chunks.push(chunk);
        }
        chunks = chunks[Symbol.iterator]();
      }

      let rleArray = this._unpackRle(chunks);

      // Check the voxel matrix size against the specified size in the settings
      let size = model.settings.size;
      let totalSize = size.x * size.y * size.z;
      let voxelLength = 0;
      for (let i = 0; i < rleArray.length; i++) {
          voxelLength += rleArray[i][1];
      }
      if (voxelLength !== totalSize) {
          throw {
              name: 'SyntaxError',
              message: `(${modelName}) The specified size is ${size.x} x ${size.y} x ${size.z} (= ${totalSize} voxels) but the voxel matrix contains ${voxelLength} voxels.`
          };
      }

      // Prepare the voxel creation context      
      let context = {
          minx: 0,
          miny: 0,
          minz: 0,
          maxx: size.x - 1,
          maxy: size.y - 1,
          maxz: size.z - 1,
          x: 0,
          y: 0,
          z: 0
      };

      // Create all chunks, using the context as cursor
      for (let i = 0; i < rleArray.length; i++) {
          let color = null;
          if (rleArray[i][0] !== '-') {
              color = colors[rleArray[i][0]];

              if (!color) {
                SVOX.logWarning({
                  name: 'ModelWarning',
                  message: `(${modelName}) Undefined color id '${rleArray[i][0]}' found in the voxel matrix.`,
                });
                // Oops, this is not a known color, create a purple 'error' color
                if (!errorMaterial) {
                  errorMaterial = model.materials.createMaterial(model, modelName, { type:SVOX.MATBASIC, lights:false, quickao: { color:Color.fromHex('#000'), strength:0.3 } }, true); 
                }
                color = errorMaterial.addColor(Color.fromHex('#F0F'));
                color.id = rleArray[i][0];
                colors[color.id] = color;
              }
          }

          this._setVoxels(model, color, rleArray[i][1], context);
      }
  }

  /**
   * Converts the Recursively Run Length Encoded chunks into simple RLE chunks.
   * @param {[][]} chunks An array or RLE chunks (containing Color ID and count or sub chunks and count)
   * @returns {[][]} An array of simple RLE chunks containing arrays with Color ID's and counts.
   */
  static _unpackRle(chunks) {
      let result = [];
      let count = 1;
      let chunk = chunks.next();
      while (!chunk.done) {
          let value = chunk.value[0];
          if (value[0] >= '0' && value[0] <= '9') {
              count = parseInt(value, 10);
          }
          else if (value === '(') {
              // Convert the chunk to normal RLE and add it to the result (repeatedly)
              let sub = this._unpackRle(chunks);
              for (let c = 0; c < count; c++) {
                  // Append to the sub array to the result
                  Array.prototype.push.apply(result, sub);
              }
              count = 1;
          }
          else if (value === ')') {
              return result;
          }
          else if (value.length > 1 && value[0] >= 'A' && value[0] <= 'Z' && value[1] === value[0]) {
              if (count > 1) {
                result.push([value[0], count]);
                result.push([value[0], value.length -1]);
              }
              else {
                result.push([value[0], value.length]);
              }
              count = 1;
          }
          else if (value.length > 1 && value[0] === '-' && value[1] === '-') {
              if (count > 1) {
                result.push(['-', count]);
                result.push(['-', value.length -1]);
              }
              else {
                result.push(['-', value.length]);
              }
              count = 1;
          }
          else {
              result.push([value, count]);
              count = 1;
          }
          chunk = chunks.next();
      }

      return result;
  }

  /**
   * Add one or more voxel of the same color to the model in the standard running order (x, y then z).
   * Each invocation automatically advances to the next voxel. 
   * @param {Model} model The model to which to add the voxel.
   * @param {Color} color The color to set for this voxel, or null for an empty voxel.
   * @param {int} count The number of voxels to set. 
   * @param {object} context The context which holds the current 'cursor' in the voxel array.
   */
  static _setVoxels(model, color, count, context) {
      while (count-- > 0) {
          if (color) 
            model.voxels.setVoxel(context.x, context.y, context.z, new Voxel(color));
          context.x++;
          if (context.x > context.maxx) {
              context.x = context.minx;
              context.y++;
          }
          if (context.y > context.maxy) {
              context.y = context.miny;
              context.z++;
          }
      }
  }
}

// =====================================================
// ../smoothvoxels/io/voxelwriter.js
// =====================================================

class VoxelWriter {
  
  /**
   * Serialize the voxels without runlength encoding.
   * This results in a recognizable manualy editable syntax
   * @param model The model data
   */
  static writeVoxels(model, repeat) {
    let voxels = model.voxels;
    
    // Find the longest color id, actually in use in a voxel (not just a shell)
    let maxIdLength = 1;
    voxels.forEach(function(voxel) {
      maxIdLength = Math.max(voxel.color.id.length, maxIdLength);
    });
   
    // If multi character color Id's (2 or 3 long) are used, use extra spaces for the '-' for empty voxels
    let voxelWidth = Math.min(maxIdLength, 3);
    
    let emptyVoxel = '-' + ' '.repeat(voxelWidth-1);
    let gutter = ' '.repeat(voxelWidth);
    let result = '';
    
    for (let z = voxels.minZ; z <= voxels.maxZ; z++) {
      for (let zr = 0; zr<repeat; zr++) {
        for (let y = voxels.minY; y <= voxels.maxY; y++) {
          for (let yr = 0; yr<repeat; yr++) {
            for (let x = voxels.minX; x <= voxels.maxX; x++) {
              let voxel = voxels.getVoxelForAnyGroup(x,y,z);
              for (let xr = 0; xr<repeat; xr++) {
                if (voxel) {
                  result += voxel.color.id;
                  let l = voxel.color.id.length;
                  while (l++<voxelWidth)
                    result += ' ';
                }
                else 
                  result += emptyVoxel;
              }
            }
            result += gutter;
          }
        }
        result += `\r\n`;
      }
    }

    return result;
  }
  
  /**
   * Serialize the voxels with runlength encoding.
   * Recognizing repeated patterns only in the compression window size
   * @param model The model data.
   * @param compressionWindow Typical values are from 10 to 100. 
   */
  static writeVoxelsRLE(model, compressionWindow) {
    let queue = [];
    let count = 0;
    let lastColor = undefined;
    
    // Loop over the model, RLE-ing subsequent same colors  
    model.voxels.forEachInBoundary(function(voxel) {
      let color = voxel ? voxel.color : null;
      if (color === lastColor) {
        count++;
      } 
      else {
        // Add this chunk to the RLE queue
        this._addRleChunk(queue, lastColor, count, compressionWindow);
        lastColor = color;
        count = 1;
      }
    }, this);
    
    // Add the last chunk to the RLE queue
    this._addRleChunk(queue, lastColor, count, compressionWindow);
    
    // Create the final result string
    let result = '';
    for (const item of queue) {
      result += this._rleToString(item);
    }
    
    return result;
  }

  /**
   * Add a chunk (repeat count + color ID, e.g. 13A, 24Aa or 35-) the RLE queue.
   * @param queue The RLE queue.
   * @param color The color to add.
   * @param count The number of times this color is repeated over the voxels.
   * @param compressionWindow Typical values are from 10 to 100.
   */
  static _addRleChunk(queue, color, count, compressionWindow) {
    if (count === 0) 
      return;
  
    // Add the chunk to the RLE queue
    let chunk = count > 1 ? count.toString() : '';
    chunk += color ? color.id : '-';
    queue.push([chunk, 1, chunk]);

    // Check for repeating patterns of length 1 to the compression window 
    for (let k = Math.max(0, queue.length - compressionWindow * 2); k <= queue.length-2; k++) {
      let item = queue[k][0];
      
      // First cherk if there is a repeating pattern
      for (let j = 1; j < compressionWindow; j++) {
        if (k + 2 * j > queue.length) 
          break; 
        let repeating = true;
        for (let i = 0; i <= j - 1; i++) {
          repeating = queue[k+i][2] === queue[k+i+j][2];
          if (!repeating) break;
        }
        if (repeating) {
          // Combine the repeating pattern into a sub array and remove the two occurences
          let arr = queue.splice(k, j);
          queue.splice(k, j-1);          
          queue[k] = [ arr, 2, null];
          queue[k][2] = JSON.stringify(queue[k]); // Update for easy string comparison
          k = queue.length;
          break;
        }
      }
    
      if (Array.isArray(item) && queue.length > k + item.length) {
        // This was already a repeating pattern, check if it repeats again
        let array = item;
        let repeating = true;
        for (let i = 0; i < array.length; i++) { 
          repeating = array[i][2] === queue[k + 1 + i][2];
          if (!repeating) break;
        }
        if (repeating) {
          // Eemove the extra pattern and increase the repeat count
          queue.splice(k+1, array.length);
          queue[k][1]++;
          queue[k][2] = null;
          queue[k][2] = JSON.stringify(queue[k]); // Update for easy string comparison
          k = queue.length;
        }
      }
    }
  }

  /**
   * Converts one (recursive RLE) chunk to a string.
   * @param chunk the entire RLE queue to start then recursivly the nested chunks.
   */
  static _rleToString(chunk) {
    let result = chunk[1] === 1 ? '' : chunk[1].toString();
    let value = chunk[0];
    if (Array.isArray(value))
    {
      result += '('; 
      for (let sub of value) {
        result += this._rleToString(sub);
      }
      result += ')';
    }    
    else {
      result += value;
    }

    return result;
  }
  
}

// =====================================================
// ../smoothvoxels/io/modeldefinitions.js
// =====================================================

(function() {
  
  SVOX.MODELDEFINITIONS = {
    
    // The order determines the write order

    _main: {
      doc: "Main properties"
    },
    size: {
      doc: "The size of the voxel matrix.",
      format: "<int:size> | <int:x> <int:y> <int:z>",
      values: undefined,
      completion: "10 10 10",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeIntXYZ(v, true),
      parse: PropertyParser.parseXYZInt.bind(null, "size", true, undefined, undefined, undefined),
    },
    scale: {
      doc: "The scale of the voxels in world units (1 = 1 meter).",
      format: "<float:scale> | <float:x> <float:y> <float:z>",
      values: undefined,
      completion: "1 1 1",
      dontWrite: "1 1 1",
      write: (v) => PropertyWriter.writeFloatXYZ(v, true),
      parse: PropertyParser.parseScale.bind(null, "scale", "1 1 1")
    },
    shape: {
      doc: "Reshapes the model to fit in this shape.",
      format: undefined,
      values: ["box","sphere","cylinder-x","cylinder-y","cylinder-z"],
      completion: "cylinder-y",
      dontWrite: "box",
      write: undefined,
      parse: PropertyParser.parseEnum.bind(null, "shape", ["box", "sphere", "cylinder-x", "cylinder-y", "cylinder-z"], "box"),
    },
    origin: {
      doc: "The origin for the model.",
      format: "{ -x x +x -y y +y -z z +z }",
      values: undefined,
      completion: "-y",
      dontWrite: "x y z",
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarPoint.bind(null, "origin", "x y z"),
    },      
    resize: {
      doc: "Compensates for size change due to deform, warp or scatter.",
      format: undefined,
      values: ["bounds","fit","fill"],
      completion: "fit",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseEnum.bind(null, "resize", ["bounds", "fit", "fill"], undefined),
    },    
    rotation: {
      doc: "The rotation of the model over the three axes.",
      format: "<x> <y> <z>",
      values: undefined,
      completion: "0 45 0",
      dontWrite: "0 0 0",
      write: (v) => PropertyWriter.writeFloatXYZ(v, false),
      parse: PropertyParser.parseXYZFloat.bind(null, "rotation", false, 0, 0, 0),
    },
    position: {
      doc: "The position of the group (in world coordinates from the origin).",
      format: "<x> <y> <z>",
      values: undefined,
      completion: "0 1 0",
      dontWrite: "0 0 0",
      write: (v) => PropertyWriter.writeFloatXYZ(v, false),
      parse: PropertyParser.parseXYZFloat.bind(null, "position", false, 0, 0, 0),
    },  
    wireframe: {
      doc: "Render the model as wireframe (excl. matcap materials).",
      format: undefined,
      values: ["true","false"],
      completion: "true",
      dontWrite: undefined,
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "wireframe", undefined),
    },
    _planar: {
      doc: "Planar properties"
    },
    flatten: {
      doc: "Flattens as if a part is cut off.",
      format: "{ -x x +x -y y +y -z z +z | none }",
      values: undefined,
      completion: "-y",
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarPlanes.bind(null, "flatten"),
    },
    clamp: {
      doc: "Flattens with peripendicular sides.",
      format: "{ -x x +x -y y +y -z z +z | none }",
      values: undefined,
      completion: "-y",
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarPlanes.bind(null, "clamp"),
    },
    skip: {
      doc: "Faces are not created, do not influence other faces, do not have shells, etc.. Use skip unless hide is needed, as skip is faster.",
      format: "{ -x x +x -y y +y -z z +z | none }",
      values: undefined,
      completion: "-y",
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarPlanes.bind(null, "skip"),
    },
    hide: {
      doc: "Faces are created, influence other faces, have shells, etc. but do not add ambient occlusion, and are not created in the mesh.",
      format: "{ -x x +x -y y +y -z z +z | none }",
      values: undefined,
      completion: "x y z",
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarPlanes.bind(null, "hide"),
    },
    tile: {
      doc: "Don't warp or scatter these model edges to allow tiling",
      format: "{ x y z|-x +x -y +y -z +z | none }",
      values: undefined,
      completion: "x z",
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarSides.bind(null, "tile"),
    },  
    _effects: {
      doc: "Effects properties"
    },
    ao: {
      doc: "Calculate ambient occlusion (not visible on normal materials). Max. distance in voxels.",
      format: "<#RGB|#RRGGBB> <maxdistance> [<intensity>] [<angle>]",
      values: undefined,
      completion: "#400 5 0.5",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeAo(v),
      parse: PropertyParser.parseAo.bind(null, "ao"),
    },
    quickAo: {
      doc: "Determines ambient occlusion by checking immediate neighboring voxels. Not suitable for deformed models.",
      format: "<#RGB|#RRGGBB> [<intensity>]",
      values: undefined,
      completion: "#400 0.5",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeQuickAo(v),
      parse: PropertyParser.parseQuickAo.bind(null, "quickao"),
    },
    aoSides: {
      doc: "The 'walls', 'floor' or 'ceiling' that occlude the model. Dependant on the bounds of the model (ignoring groups).",
      format: "{ -x +x -y +y -z +z | none }",
      values: undefined,
      completion: "-y",
      dontWrite: undefined,
      write: (v) => `${Planar.toString(v)}`,
      parse: PropertyParser.parsePlanarSides.bind(null, "aosides"),
    },    
    aoSamples: {
      doc: "The number of samples (default 50) used to calculate ao. Higher looks better but genreates slower.",
      format: "<integer>",
      values: undefined,
      completion: "200",
      dontWrite: "50",
      write: undefined,
      parse: PropertyParser.parseFloat.bind(null, "aosamples", 50),
    },      
    shell: {
      doc: "Material shell or shells.",
      format: "[<colorId> <distance>]+",
      values: undefined,
      completion: "V 0.5 W 0.5",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeShell(v),
      parse: PropertyParser.parseShell.bind(null, "shell"),
    },
    _shader: {
      doc: "Shader properties"
    },
    simplify: {
      doc: "By default faces are combined to reduce the model memory size, which may be unwanted for shaders.",
      format: undefined,
      values: ["true","false"],
      completion: "false",
      dontWrite: 'true',
      write: undefined,
      parse: PropertyParser.parseBoolean.bind(null, "simplify", true),
    },
    data: {
      doc: "Vertex data for use in shaders. Names and values in materials must match this definition.",
      format: "[<attributename> <float> <float> ...]+ ",
      values: undefined,
      completion: "data 0.5 0.5",
      dontWrite: undefined,
      write: (v) => PropertyWriter.writeVertexData(v),
      parse: PropertyParser.parseData.bind(null, "data"),
    }
  };
  
  (function processAllDefinitions() {
    processDefinitions(SVOX.TEXTUREDEFINITIONS);
    processDefinitions(SVOX.LIGHTDEFINITIONS);
    processDefinitions(SVOX.GROUPDEFINITIONS);
    processDefinitions(SVOX.MATERIALDEFINITIONS);
    processDefinitions(SVOX.MODELDEFINITIONS);
  })();  
  
  function processDefinitions(definitions) {
    for(const property in definitions) {
      let def = definitions[property];
      def.name = property;
      
      if (!def.format) {
        if (def.values)
          def.format =  `{ ${def.values.join(" | ")} }`
        else
          def.format = '';
      } 
    }
  }  
})();

// =====================================================
// ../smoothvoxels/io/modelreader.js
// =====================================================

class ModelReader {
  
  /**
   * Read the model from a string.
   * @param {string} modelString The string containing the model.
   * @param {string} modelName The name of the model, to be used in errors.
   * @returns {Model} The model.
   */
  static readFromString(modelString, modelName) {
    let definitions = SVOX.MODELDEFINITIONS;

    let lines = this._convertToSinglePropertyLines(modelString);
    let parameters = this._parse(lines, modelName);
    
    this._cleanupParameters(parameters, modelName);

    let settings = { 
      name: modelName
    };
    
    try {     
      for (const property in definitions) {
        let def = definitions[property];
        let value = parameters[property];
        if (def.parse) {
          value = def.parse(value);
        }
        if (value !== undefined) {
          settings[property] = value;
        }
      }
    }
    catch (err) {
      throw { 
        name:err.name, 
        message:`(${modelName}) ${err.message}`
      };
    }    
    
    this._validateSettings(settings, modelName);
    
    let model = new Model(settings);
    
    parameters.textures.forEach(function (textureData) {
      model.textures.createTexture(textureData, modelName);
    }, this);
  
    SVOX.groupIdCount = 1;
    parameters.groups.forEach(function (groupData) {
      model.groups.createGroup(groupData, modelName);
    }, this);
    
    if (parameters.lights.some((light) => light.size)) {
      // There are visible lights, so create a basic material for them with a dummy color
      let lightMaterial = model.materials.createMaterial(model, modelName, { type:SVOX.MATBASIC, lighting:SVOX.FLAT, colors:"_:#FFF" } );
      lightMaterial.usedForLights = true;
    }

    parameters.lights.forEach(function (lightData) {
      model.lights.createLight(lightData, modelName);
    }, this);

    parameters.materials.forEach(function (materialData) {
      let material = model.materials.createMaterial(model, modelName, materialData);
    }, this);

    // Retrieve all colors and Id's from all materials
    model.colors = {};
    model.materials.forEach(function (material) {
      material.colors.forEach(function (color) {
        if (model.colors[color.id]) {
          SVOX.logWarning({
            name: 'ModelWarning',
            message: `(${modelName}) Duplicate color id '${color.id}' found.`,
          });
        }    
          
        model.colors[color.id] = color;
      });
    });
    
    // Ensure the material data properties matches the model data property
    model.materials.forEach(function(material) {             
      this._compareVertexData(model.data, material.settings.data, 'material');    
    }, this);    

    // Ensure the light data properties match the model data property
    model.lights.forEach(function(light) {             
      this._compareVertexData(model.data, light.data, 'light');    
    }, this);    

    // Find the color (& material) for the shell(s)
    this._resolveShellColors(model.shell, model);
    model.materials.forEach(function (material) {
      this._resolveShellColors(material.shell, model);
    }, this);

    // Create all voxels
    if (!parameters.voxels && settings.size && (settings.size.x>0 || settings.size.y>0 || settings.size.z>0)) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) No voxels found in model.`
      };    
    }    
    VoxelReader.createVoxels(model, modelName, parameters.voxels);
    
    return model;
  }

  // Flatten the model string to an array of single property line (e.g. ['model', 'size = 10 10 10', 'resize = model', ...])
  static _convertToSinglePropertyLines(modelString) {

    const regex = {
        emptyLines: new RegExp(/^[ ]*\r?\n/, "gm"),
        linecontinuation: new RegExp(/_\s*[\r\n]/gm),
        defines: new RegExp(/^\s*(define .*)/, "gm"),
        modelparts: new RegExp(
                      /(;base64,.*$)\s*/.source + '|' +                                  // A base 64 texture out of place could give browser hanging on amounts of junk
                      /\/\/.*$/.source + '|' +                                           // Comments are removed later
                      /\s*(texture|light|model|group(?!\s*=)|material|voxels)\s+/.source + '|' + // SVOX Blocks (group but not group =)
                      /\s*([^=,\r\n]+=\s*data:image.*?base64,.*$)\s*/.source + '|' +     // Name = data:image/...;base64,iVBORw...
                      /\s*([^=,\r\n]+=[^\r\n=;,\/]+)\s*/.source + '|' +                  // Name = Value
                      /\s*(=[^\r\n=;,\/]+)\s*/.source + '|' +                            // If a comma is missing the next part will be: = Value
                      /\s*([A-Za-z \(\)\d -]+)\s*/.source,                               // Voxel matrix
                      "gm")
    };

    // Split the lines so every line contains:
    // - A block name (i.e. "texture"/"light"/"model"/"material"/"voxels")
    // - name = value (e.g. "emissive = #FFF 1")
    // - A line from the voxel matrix
    // while removing all comments

    // Remove all empty lines
    modelString = modelString.replaceAll(regex.emptyLines,'');

    // Concatenate all continuated lines
    modelString = modelString.replaceAll(regex.linecontinuation,' ');

    // Extract the define lines
    let defines = Array.from(modelString.matchAll(regex.defines), m => m[0].trim());
    modelString = modelString.replaceAll(regex.defines, '')

    // Replace the defines in reverse order in case a define is used in another define
    defines.reverse();

    // Replace all defines in the modelString for their definition
    defines.forEach(function replaceDefines(line) {
      
      // Remove any comment at the end of the define line
      line = line.split(/\/\//,1)[0];
      // Split the line in the name and a defintion part
      let parts = line.split(/\s+/);
      const name = parts[1];
      parts.shift();
      parts.shift();
      const definition = parts.join(' ');

      // Replace all occurences of the name by the definition
      modelString = modelString.replaceAll(new RegExp(`\\b${name}\\b`, "gm"), definition);
    }, this);
    
    let lines = modelString.split(/\r\n|\n|\r/).map(l => l.trim());
    
    // Remove all comments (more complex but much more performant that doing this using regex with a negative lookahead for data:image)
    for (let l=0; l < lines.length; l++) {
      let commentStart = lines[l].indexOf('//');
      if (commentStart >= 0) {
        let imageStart = lines[l].indexOf('data:image');
        if (imageStart >= 0 && commentStart < imageStart) {
          lines[l] = lines[l].substring(0, commentStart).trim();
        }
        else if (imageStart === -1 && commentStart >= 0) {
          lines[l] = lines[l].substring(0, commentStart).trim();        
        }
      }
    }
    
    lines = lines.flatMap(line => Array.from(line.matchAll(regex.modelparts), m => m[0].trim())).filter(line => line); 
    
    return lines;
  }  

  /**
   * Parse the model string into a modelData object which can be converted into a model
   * @param {string} modelString The string to be parsed
   * @returns {object} A simple object with the model data (not yet the actual model).
   */
  static _parse(lines, modelName) {
    let modelData = { lights:[], textures:[], groups:[], materials:[] };
    let parent = modelData;
    let voxelString = null;
    let modelFound = false;
   
    // Now convert the lines to a javascript object
    lines.filter(l => l).forEach(function (line) {

      if (line.startsWith('//')) {
          // Skip comments
      }
      else if (line === 'texture') {
          // New texture start
          parent = { };
          modelData.textures.push(parent);
      }
      else if (line === 'light') {
          // New light start
          parent = { };
          modelData.lights.push(parent);
      }
      else if (line === 'model') {
        // Model settings
        parent = modelData;
        modelFound = true;
      } 
      else if (line === 'group') {
          // New group
          parent = { };
          modelData.groups.push(parent);
      }
      else if (line === 'material') {
          // New material start
          parent = { };
          modelData.materials.push(parent);
      }
      else if (line === 'voxels') {
          // Voxels belong to the model
          parent = modelData; 
          voxelString = "";
      } 
      else if (voxelString !== null) {
          // We are in the voxel matrix, so just add the line to the voxel string
          voxelString += line.replace(/\s/g, '');
      } 
      else {
        // Handle one property assignment 
        let equalIndex = line.indexOf('=');
        if (equalIndex === -1) {
            throw {
                name: 'SyntaxError',
                message: `(${modelName}) Invalid definition '${line.length<=40 ? line : line.substring(0, 40)+'...'}'.`
            };
        }

        // Don't use split because image data contains '='
        let name  = line.substring(0, equalIndex).trim().toLowerCase();
        let value = line.substring(equalIndex+1).trim();

        if (value === '') {
            throw {
                name: 'SyntaxError',
                message: `(${modelName}) Invalid definition '${line.length<=40 ? line : line.substring(0, 40)+'...'}'.`
            };
        }

        // Set the property
        parent[name] = value;
      }
    }, this);

    if (!modelFound) {
      throw { name:'SyntaxError', message:`(${modelName}) Missing mandatory 'model' keyword.` };  
    }

    modelData.voxels = voxelString;

    return modelData;
  }
  
  // Rename the (typically all lower case) svox properties to camelCase
  // Ensure that there are no unknown properties
  static _cleanupParameters(parameters, modelName) {    
    let definitions = SVOX.MODELDEFINITIONS;
    
    for(const property in parameters) {
      let found = false || ['textures', 'lights', 'groups', 'materials', 'voxels'].includes(property);

      for (const propertyName in definitions) {
        if (property.toLowerCase() === propertyName.toLowerCase()) {
          found = true;
          
          // Rename to normal javascript camelCasing if needed
          if (property !== propertyName) {
            parameters[propertyName] = parameters[property];
            delete parameters[property];
          }
          
          break;
        }
      }

      if (!found) {
        throw {
            name: 'SyntaxError',
            message: `(${modelName}) ` +
                     (property === '' ? `Syntax error before value '${parameters[property]}', are you missing a comma?`
                                      : `Unknown property '${property}' found in model.`)
        };    
      }
    }
    
    // Check for circular groups
    parameters.groups.forEach(function(group) {
      if (group.clone && group.group) {
        let parents = [ group.id ];
        let parent = parameters.groups.find(g => g.id && g.id === group.group);
        while (parent) {

          if (parents.includes(parent.id)) {
            parents.unshift(parent.id);
            throw {
              name: 'ModelError',
              message: `(${modelName}) Group '${group.id}' cannot have itself as parent ( ${parents.join('->')} ).`
            }
          }

          parents.unshift(parent.id);
          if (parent.id === group.clone) {
            throw {
              name: 'ModelError',
              message: `(${modelName}) Group '${group.id}' cannot clone its parent group '${group.clone}' ( ${parents.join('->')} ).`
            }
          }
          
          parent = parameters.groups.find(g => g.id && g.id === parent.group);
        }
      }
    }, this);
    
    // Ensure no nested prefabs exist
    parameters.groups.forEach(function(group) {
      if (group.prefab) {
        this._checkForNestedPrefabs(modelName, parameters.groups, group.id, group.id);
      }
    }, this);          
  }
    
  static _checkForNestedPrefabs(modelName, groups, groupId, originalPrefabId) {
    groups.forEach(function(group) {
      if (groupId && group.group === groupId) {
        if (group.prefab === "true") {
          throw {
            name: "ModelError",
            message: `(${modelName}) Prefab group '${group.id}' cannot be nested in prefab '${originalPrefabId}'`
          }
        }
        this._checkForNestedPrefabs(modelName, groups, group.id, originalPrefabId);
      }
    }, this);
  }      

  // Validate / improve the settings where needed
  static _validateSettings(settings, modelName) {  
    if (!settings.size) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) Missing mandatory property 'size' in model.`
      };    
    }       
    
    settings.aoSamples = Math.max(8, Math.min(3000, parseInt(settings.aoSamples || 50, 10)));
    
    if (settings.ao && settings.quickAo) {
      throw {
          name: 'SyntaxError',
          message: `(${modelName}) The properties 'ao' and 'quickao' can not be used together in the model settings. Use materials to override the model settings.`
      };    
    }     
  }

  /**
   * Resolves the color ID of shell to a specific material
   * @param {object} shell The shell array containing objects with containing colorId and distance
   * @param {object} model The shell object containing colorId and distance
   * @param {string} modelName The name of the model for use in errors
   */
  static _resolveShellColors(shell, model, modelName) {
    if (!shell || shell.length === 0)
      return;

    shell.forEach(function (sh) {
      sh.color = model.colors[sh.colorId];
      if (!sh.color) {
        throw {
          name: 'SyntaxError',
          message: `(${modelName}) shell color ID '${sh.colorId}' not found in one of the materials.`
        };           
      }
    }, this);
  }
  
  /**
   * Compares the material vertex data to the model. They must match exactly
   * @param {object} modelData The vertex data of the model
   * @param {object} materialOrLightData The vertex data of the material or the light
   * @param {string} typeName 'material' or 'light'
   * @returns void
   * @throws Syntax error in case the model and material vertex data is different
   */
  static _compareVertexData(modelData, materialOrLightData, typeName) {
    let error = false;
    try {
      if ((modelData || materialOrLightData) && materialOrLightData) {
        error = materialOrLightData && !(modelData);
        let matData = [...materialOrLightData];
        materialOrLightData.length = 0;
        for (let i = 0; i < matData.length; i++) {
          let modData = modelData.find(data => data.name === matData[i].name);
          error = error || (!modData || modData.values.length !== matData[i].values.length);
        }
        for (let i = 0; i < modelData.length; i++) {    
          let modData = modelData[i];
          let data = matData.find(data => data.name === modData.name) || modData;
          materialOrLightData.push(data);
        } 
      }
    }
    catch (ex) {
      error = true;
    }    
    if (error) {
      throw {
        name: 'SyntaxError',
        message: `The data property of the ${typeName} can only contain names defined in the model data, with identical number of values.`
      };
    }
  };   
}

// =====================================================
// ../smoothvoxels/io/modelwriter.js
// =====================================================

class ModelWriter {

  /**
   * Serialize the model to a string. 
   * When repeat is used, compressed is ignored.
   * @param model The model data.
   * @param compressed Wether the voxels need to be compressed using Recursive Runlength Encoding.
   * @param repeat An integer specifying whether to repeat the voxels to double or tripple the size, default is 1. 
   */
  static writeToString(model, compressed, repeat) {
    repeat = Math.round(repeat || 1);
    
    
    if (repeat > 1) {
      if (model.warp) {
        model.warp.frequency /= repeat;
        model.warp.amplitude  *= repeat;
        model.warp.amplitudeX *= repeat;
        model.warp.amplitudeY *= repeat;
        model.warp.amplitudeZ *= repeat;
      }
      if (model.ao) {
        model.ao.maxDistance *= repeat; 
      }      
      model.groups.forEach((group) => {
        if (group.position) {
          group.position.x *= repeat;
          group.position.y *= repeat;
          group.position.z *= repeat;
        }
      });

      model.lights.forEach((light) => {
        if (light.position) {
          light.position.x *= repeat;
          light.position.y *= repeat;
          light.position.z *= repeat;
        }
        if (light.distance) {
          light.distance *= repeat;
        }
        if (light.size) {
          light.size *= repeat;
        }
        if (light.atVoxel) {
          light.intensity = (light.intensity / (repeat * repeat)).toFixed(5);
        }
      });
      
      model.materials.forEach((material) => {
        if (material.warp) {
          material.warp.frequency /= repeat;
          material.warp.amplitude  *= repeat;
          material.warp.amplitudeX *= repeat;
          material.warp.amplitudeY *= repeat;
          material.warp.amplitudeZ *= repeat;
        }
        if (material.ao && material.ao.maxDistance) {
          material.ao.maxDistance *= repeat; 
        }
        if (material.settings.mapTransform) {
          if (material.settings.mapTransform.uscale !== -1) material.settings.mapTransform.uscale *= repeat;
          if (material.settings.mapTransform.vscale !== -1) material.settings.mapTransform.vscale *= repeat;
        }
        if (material.settings.deform) {
          material.settings.deform.count += material.settings.deform.count * (repeat * repeat);
        }
        if (material.shell) {
          for (let s=0; s<material.shell.length; s++) {
            material.shell[s].distance *= repeat;
          }
        }
      });
    }

    // Prepare the model (count colors, recalculate bounding box, etc.)
    model.prepareForWrite();
    
    // Retrieve all colors
    let colors = [];
    let colorIds = {};
    
    let result = "";
    let newLine = compressed ? '' : '\r\n';
    
    // Add the textures to the result
    if (model.textures.length > 0) {
      model.textures.forEach(function(texture) {
        result += TextureWriter.write(texture) + '\r\n';
      });
      result += newLine;
    }
    
    // Add the lights to the result
    if (model.lights.length > 0) {
      model.lights.forEach(function(light) {
        result += LightWriter.write(light) + '\r\n';
      });
      result += newLine;
    }
    
    let definitions = SVOX.MODELDEFINITIONS;
    
    let out = [];
    for (const property in model.settings) {
      let def = definitions[property];
      if (def !== undefined && model.settings[property] !== undefined) {
        let value = def.write ? def.write(model.settings[property]) : `${model.settings[property]}`;
        if (value !== def.dontWrite) {
          out.push(`${property.toLowerCase()} = ${value}`)
        }
      }
    }
    
    if (repeat !== 1) {
      let sizeIndex = out.findIndex(p => p.substring(0,6) === 'size =');
      out[sizeIndex] = 'size = ' + SVOX.MODELDEFINITIONS.size.write( { x:model.size.x*repeat, 
                                                                       y:model.size.y*repeat, 
                                                                       z:model.size.z*repeat } );
      
      let scaleIndex = out.findIndex(p => p.substring(0,7) === 'scale =');
      if (scaleIndex === -1) {
        scaleIndex = 2;
        out.splice(scaleIndex, 0, "scale = 1 1 1");
      }
      out[scaleIndex] = 'scale = ' + SVOX.MODELDEFINITIONS.size.write( { x:parseFloat((model.scale.x/repeat).toFixed(4)), 
                                                                         y:parseFloat((model.scale.y/repeat).toFixed(4)),
                                                                         z:parseFloat((model.scale.z/repeat).toFixed(4)) } );
    }
    
    if (compressed)
      result += 'model ' + out.join(',') + '\r\n';
    else
      result += 'model\r\n' + out.join('\r\n') + '\r\n';

    result += newLine;

    // Add the groups to the result, except the '*' group
    if (model.groups.length > 1) {
      model.groups.forEach(function(group) {
        if (group.id !== '*') {
          result += GroupWriter.write(group) + '\r\n';
        }
      });
      result += newLine;
    }    

    // Add the materials and colors to the result
    model.materials.forEach(function(material) {  
      if (material.colorUsageCount > 0 && !material.usedForLights) {
        let line = MaterialWriter.write(material) + '\r\n';
        if (!compressed) {
          line = line.replace(', colors =', '\r\n  colors =')
        }
        result += line;
      }
    }, this);    

    result += newLine;
    
    if (compressed) {
      result = result.replaceAll(' = ', '=').replaceAll(', ', ',');
    }

    // Add the voxels to the result
    if (!compressed || repeat !== 1)
      result += 'voxels\r\n' + VoxelWriter.writeVoxels(model, repeat) + '\r\n';
    else  
      result += 'voxels ' + VoxelWriter.writeVoxelsRLE(model, 100);

    return result;
  }
  
  /**
   * Create shell string to write
   * @param shell array of shells
   */
  static _getShell(shell) {
    if (shell.length === 0)
      return  'none';
    
    let result = '';
    for (let sh = 0; sh < shell.length; sh++) {
      result += `${shell[sh].colorId} ${shell[sh].distance} `;
    }
    return result.trim();
  }
}

// =====================================================
// ../smoothvoxels/meshgenerator/matrix.js
// =====================================================

// Single Matrix class adapted from https://github.com/evanw/lightgl.js
// Simplified to only the parts needed

// Represents a 4x4 matrix stored in row-major order that uses Float32Arrays
// when available. Matrix operations can either be done using convenient
// methods that return a new matrix for the result or optimized methods
// that store the result in an existing matrix to avoid generating garbage.

let hasFloat32Array = (typeof Float32Array != 'undefined');

// ### new Matrix()
//
// This constructor creates an identity matrix.
class Matrix {
  
  constructor() {
    let m = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
    this.m = hasFloat32Array ? new Float32Array(m) : m;
  }

  // ### .transformPoint(point)
  //
  // Transforms the vector as a point with a w coordinate of 1. This
  // means translations will have an effect, for example.
  transformPoint(v) {
    let m = this.m;
    let div = m[12] * v.x + m[13] * v.y + m[14] * v.z + m[15];
    let x = ( m[0] * v.x + m[1] * v.y + m[2] * v.z + m[3] ) / div;
    let y = ( m[4] * v.x + m[5] * v.y + m[6] * v.z + m[7] ) / div;
    let z = ( m[8] * v.x + m[9] * v.y + m[10] * v.z + m[11] ) / div;
    v.x = x;
    v.y = y;
    v.z = z;
  }

  // ### .transformVector(vector)
  //
  // Transforms the vector as a vector with a w coordinate of 0. This
  // means translations will have no effect, for example.
  transformVector(v) {
    let m = this.m;
    let x = ( m[0] * v.x + m[1] * v.y + m[2] * v.z );
    let y = ( m[4] * v.x + m[5] * v.y + m[6] * v.z );
    let z = ( m[8] * v.x + m[9] * v.y + m[10] * v.z );
    v.x = x;
    v.y = y;
    v.z = z;
  }

  // ### Matrix.identity([result])
  //
  // Returns an identity matrix. You can optionally pass an existing matrix in
  // `result` to avoid allocating a new matrix. 
  static identity(result) {
    result = result || new Matrix();
    let m = result.m;
    m[0] = m[5] = m[10] = m[15] = 1;
    m[1] = m[2] = m[3] = m[4] = m[6] = m[7] = m[8] = m[9] = m[11] = m[12] = m[13] = m[14] = 0;
    return result;
  }

  // ### Matrix.multiply(left, right[, result])
  //
  // Returns the concatenation of the transforms for `left` and `right`. You can
  // optionally pass an existing matrix in `result` to avoid allocating a new
  // matrix. 
  static multiply(left, right, result) {
    result = result || new Matrix();
    let a = left.m, b = right.m, r = result.m;

    r[0] = a[0] * b[0] + a[1] * b[4] + a[2] * b[8] + a[3] * b[12];
    r[1] = a[0] * b[1] + a[1] * b[5] + a[2] * b[9] + a[3] * b[13];
    r[2] = a[0] * b[2] + a[1] * b[6] + a[2] * b[10] + a[3] * b[14];
    r[3] = a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3] * b[15];

    r[4] = a[4] * b[0] + a[5] * b[4] + a[6] * b[8] + a[7] * b[12];
    r[5] = a[4] * b[1] + a[5] * b[5] + a[6] * b[9] + a[7] * b[13];
    r[6] = a[4] * b[2] + a[5] * b[6] + a[6] * b[10] + a[7] * b[14];
    r[7] = a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7] * b[15];

    r[8] = a[8] * b[0] + a[9] * b[4] + a[10] * b[8] + a[11] * b[12];
    r[9] = a[8] * b[1] + a[9] * b[5] + a[10] * b[9] + a[11] * b[13];
    r[10] = a[8] * b[2] + a[9] * b[6] + a[10] * b[10] + a[11] * b[14];
    r[11] = a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11] * b[15];

    r[12] = a[12] * b[0] + a[13] * b[4] + a[14] * b[8] + a[15] * b[12];
    r[13] = a[12] * b[1] + a[13] * b[5] + a[14] * b[9] + a[15] * b[13];
    r[14] = a[12] * b[2] + a[13] * b[6] + a[14] * b[10] + a[15] * b[14];
    r[15] = a[12] * b[3] + a[13] * b[7] + a[14] * b[11] + a[15] * b[15];

    return result;
  }

  // ### Matrix.transpose(matrix[, result])
  //
  // Returns `matrix`, exchanging columns for rows. You can optionally pass an
  // existing matrix in `result` to avoid allocating a new matrix.
  static  transpose(matrix, result) {
    result = result || new Matrix();
    let m = matrix.m, r = result.m;
    r[0]  = m[0]; r[1]  = m[4]; r[2]  = m[8];  r[3]  = m[12];
    r[4]  = m[1]; r[5]  = m[5]; r[6]  = m[9];  r[7]  = m[13];
    r[8]  = m[2]; r[9]  = m[6]; r[10] = m[10]; r[11] = m[14];
    r[12] = m[3]; r[13] = m[7]; r[14] = m[11]; r[15] = m[15];
    return result;
  }

  // ### Matrix.inverse(matrix[, result])
  //
  // Returns the matrix that when multiplied with `matrix` results in the
  // identity matrix. You can optionally pass an existing matrix in `result`
  // to avoid allocating a new matrix. This implementation is from the Mesa
  // OpenGL function `__gluInvertMatrixd()` found in `project.c`.
  static inverse(matrix, result) {
    result = result || new Matrix();
    let m = matrix.m, r = result.m;

    r[0]  =  m[5]*m[10]*m[15] - m[5]*m[14]*m[11] - m[6]*m[9]*m[15] + m[6]*m[13]*m[11] + m[7]*m[9]*m[14] - m[7]*m[13]*m[10];
    r[1]  = -m[1]*m[10]*m[15] + m[1]*m[14]*m[11] + m[2]*m[9]*m[15] - m[2]*m[13]*m[11] - m[3]*m[9]*m[14] + m[3]*m[13]*m[10];
    r[2]  =  m[1]*m[6]*m[15]  - m[1]*m[14]*m[7]  - m[2]*m[5]*m[15] + m[2]*m[13]*m[7]  + m[3]*m[5]*m[14] - m[3]*m[13]*m[6];
    r[3]  = -m[1]*m[6]*m[11]  + m[1]*m[10]*m[7]  + m[2]*m[5]*m[11] - m[2]*m[9]*m[7]  - m[3]*m[5]*m[10]  + m[3]*m[9]*m[6];

    r[4]  = -m[4]*m[10]*m[15] + m[4]*m[14]*m[11] + m[6]*m[8]*m[15] - m[6]*m[12]*m[11] - m[7]*m[8]*m[14] + m[7]*m[12]*m[10];
    r[5]  =  m[0]*m[10]*m[15] - m[0]*m[14]*m[11] - m[2]*m[8]*m[15] + m[2]*m[12]*m[11] + m[3]*m[8]*m[14] - m[3]*m[12]*m[10];
    r[6]  = -m[0]*m[6]*m[15]  + m[0]*m[14]*m[7]  + m[2]*m[4]*m[15] - m[2]*m[12]*m[7]  - m[3]*m[4]*m[14] + m[3]*m[12]*m[6];
    r[7]  =  m[0]*m[6]*m[11]  - m[0]*m[10]*m[7]  - m[2]*m[4]*m[11] + m[2]*m[8]*m[7]   + m[3]*m[4]*m[10] - m[3]*m[8]*m[6];

    r[8]  =  m[4]*m[9]*m[15]  - m[4]*m[13]*m[11] - m[5]*m[8]*m[15] + m[5]*m[12]*m[11] + m[7]*m[8]*m[13] - m[7]*m[12]*m[9];
    r[9]  = -m[0]*m[9]*m[15]  + m[0]*m[13]*m[11] + m[1]*m[8]*m[15] - m[1]*m[12]*m[11] - m[3]*m[8]*m[13] + m[3]*m[12]*m[9];
    r[10] =  m[0]*m[5]*m[15]  - m[0]*m[13]*m[7]  - m[1]*m[4]*m[15] + m[1]*m[12]*m[7]  + m[3]*m[4]*m[13] - m[3]*m[12]*m[5];
    r[11] = -m[0]*m[5]*m[11]  + m[0]*m[9]*m[7]   + m[1]*m[4]*m[11] - m[1]*m[8]*m[7]   - m[3]*m[4]*m[9]  + m[3]*m[8]*m[5];

    r[12] = -m[4]*m[9]*m[14]  + m[4]*m[13]*m[10] + m[5]*m[8]*m[14] - m[5]*m[12]*m[10] - m[6]*m[8]*m[13] + m[6]*m[12]*m[9];
    r[13] =  m[0]*m[9]*m[14]  - m[0]*m[13]*m[10] - m[1]*m[8]*m[14] + m[1]*m[12]*m[10] + m[2]*m[8]*m[13] - m[2]*m[12]*m[9];
    r[14] = -m[0]*m[5]*m[14]  + m[0]*m[13]*m[6]  + m[1]*m[4]*m[14] - m[1]*m[12]*m[6]  - m[2]*m[4]*m[13] + m[2]*m[12]*m[5];
    r[15] =  m[0]*m[5]*m[10]  - m[0]*m[9]*m[6]   - m[1]*m[4]*m[10] + m[1]*m[8]*m[6]   + m[2]*m[4]*m[9]  - m[2]*m[8]*m[5];

    let det = m[0]*r[0] + m[1]*r[4] + m[2]*r[8] + m[3]*r[12];
    for (let i = 0; i < 16; i++) r[i] /= det;
    return result;
  }

  // ### Matrix.scale(x, y, z[, result])
  //
  // Create a scaling matrix. You can optionally pass an
  // existing matrix in `result` to avoid allocating a new matrix.
  static scale(x, y, z, result) {
    result = result || new Matrix();
    let m = result.m;

    m[0] = x;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;

    m[4] = 0;
    m[5] = y;
    m[6] = 0;
    m[7] = 0;

    m[8] = 0;
    m[9] = 0;
    m[10] = z;
    m[11] = 0;

    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;

    return result;
  }

  // ### Matrix.translate(x, y, z[, result])
  //
  // Create a translation matrix. You can optionally pass
  // an existing matrix in `result` to avoid allocating a new matrix.
  static translate(x, y, z, result) {
    result = result || new Matrix();
    let m = result.m;

    m[0] = 1;
    m[1] = 0;
    m[2] = 0;
    m[3] = x;

    m[4] = 0;
    m[5] = 1;
    m[6] = 0;
    m[7] = y;

    m[8] = 0;
    m[9] = 0;
    m[10] = 1;
    m[11] = z;

    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;

    return result;
  }

  // ### Matrix.rotate(a, x, y, z[, result])
  //
  // Create a rotation matrix that rotates by `a` degrees around the vector `x, y, z`.
  // You can optionally pass an existing matrix in `result` to avoid allocating
  // a new matrix. This emulates the OpenGL function `glRotate()`.
  static rotate(a, x, y, z, result) {
    if (!a || (!x && !y && !z)) {
      return Matrix.identity(result);
    }

    result = result || new Matrix();
    let m = result.m;

    let d = Math.sqrt(x*x + y*y + z*z);
    a *= Math.PI / 180; x /= d; y /= d; z /= d;
    let c = Math.cos(a), s = Math.sin(a), t = 1 - c;

    m[0] = x * x * t + c;
    m[1] = x * y * t - z * s;
    m[2] = x * z * t + y * s;
    m[3] = 0;

    m[4] = y * x * t + z * s;
    m[5] = y * y * t + c;
    m[6] = y * z * t - x * s;
    m[7] = 0;

    m[8] = z * x * t - y * s;
    m[9] = z * y * t + x * s;
    m[10] = z * z * t + c;
    m[11] = 0;

    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;

    return result;
  }

  // ### Matrix.lookAt(ex, ey, ez, cx, cy, cz, ux, uy, uz[, result])
  //
  // Returns a matrix that puts the camera at the eye point `ex, ey, ez` looking
  // toward the center point `cx, cy, cz` with an up direction of `ux, uy, uz`.
  // You can optionally pass an existing matrix in `result` to avoid allocating
  // a new matrix. This emulates the OpenGL function `gluLookAt()`.
  static lookAtORIGINAL(ex, ey, ez, cx, cy, cz, ux, uy, uz, result) {
    result = result || new Matrix();
    let m = result.m;

    // f = e.subtract(c).unit()
    let fx = ex-cx, fy = ey-cy, fz = ez-cz;
    let d = Math.sqrt(fx*fx + fy*fy + fz*fz);
    fx /= d; fy /= d; fz /= d;
    
    // s = u.cross(f).unit()
    let sx = uy * fz - uz * fy;
    let sy = uz * fx - ux * fz;
    let sz = ux * fy - uy * fx;
    d = Math.sqrt(sx*sx + sy*sy + sz*sz);
    sx /= d; sy /= d; sz /= d;
    
    // t = f.cross(s).unit()
    let tx = fy * sz - fz * sy;
    let ty = fz * sx - fx * sz;
    let tz = fx * sy - fy * sx;
    d = Math.sqrt(tx*tx + ty*ty + tz*tz);
    tx /= d; ty /= d; tz /= d;

    m[0] = sx;
    m[1] = sy;
    m[2] = sz;
    m[3] = -(sx*ex + sy*ey + sz*ez);  // -s.dot(e)

    m[4] = tx;
    m[5] = ty;
    m[6] = tz;
    m[7] = -(tx*ex + ty*ey + tz*ez);  // -t.dot(e)

    m[8] = fx;
    m[9] = fy;
    m[10] = fz;
    m[11] = -(fx*ex + fy*ey + fz*ez);  // -f.dot(e)

    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;

    return result;
  };
  
// ### Matrix.lookAt(ex, ey, ez, cx, cy, cz, ux, uy, uz[, result])
  //
  // Returns a matrix that puts the camera at the eye point `ex, ey, ez` looking
  // toward the center point `cx, cy, cz` with an up direction of `ux, uy, uz`.
  // You can optionally pass an existing matrix in `result` to avoid allocating
  // a new matrix. This emulates the OpenGL function `gluLookAt()`.
  static lookAtTRYOUT(nx, ny, nz, result) {
    result = result || new Matrix();
    let m = result.m;
   
    let len = Math.sqrt(nx*nx + nz*nz);
    
    m[0] =  nz / len;
    m[1] =  0;
    m[2] = -nx / len;
    m[3] =  0;  

    m[4] =  nx*ny / len;
    m[5] = -len;
    m[6] =  nz*ny / len;
    m[7] =  0;

    m[8]  = nx;
    m[9]  = ny;
    m[10] = nz;
    m[11] = 0; 

    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;

    return result;
  };
  
  static lookAt(nx, ny, nz, result) {
    result = result || new Matrix();
    let m = result.m;
   
    let len = Math.sqrt(nx*nx + nz*nz);
    
    /* Find cosθ and sinθ; if gimbal lock, choose (1,0) arbitrarily */
    let c2 = len ? nx / len : 1.0;
    let s2 = len ? nz / len : 0.0;

    m[0] = nx;
    m[1] = -s2;
    m[2] = -nz*c2;
    m[3] = 0;
    
    m[4] = ny;
    m[5] = 0;
    m[6] = len;
    m[7] = 0;
    
    m[8] = nz;
    m[9] = c2;
    m[10] = -nz*s2;
    m[11] = 0;
    
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;

    return result;
  };

}

// =====================================================
// ../smoothvoxels/meshgenerator/noise.js
// =====================================================

// http://mrl.nyu.edu/~perlin/noise/

// This is the Improved Noise from the examples of Three.js.
// It was adapted to change the permutation array from hard coded to generated.

SVOX.Noise = function () {

	let p = [];
  for ( let i = 0; i < 256; i ++ ) {
    p[i] = Math.floor(Math.random()*256);
		p[i + 256] = p[i];
	}

	function fade( t ) {
		return t * t * t * ( t * ( t * 6 - 15 ) + 10 );
	}

	function lerp( t, a, b ) {
		return a + t * ( b - a );
	}

	function grad( hash, x, y, z ) {
		let h = hash & 15;
		let u = h < 8 ? x : y, v = h < 4 ? y : h == 12 || h == 14 ? x : z;
		return ( ( h & 1 ) == 0 ? u : - u ) + ( ( h & 2 ) == 0 ? v : - v );
	}

	return {

		noise: function ( x, y, z ) {

			let floorX = Math.floor( x ), 
          floorY = Math.floor( y ), 
          floorZ = Math.floor( z );

			let X = floorX & 255, 
          Y = floorY & 255, 
          Z = floorZ & 255;

			x -= floorX;
			y -= floorY;
			z -= floorZ;

			let xMinus1 = x - 1, yMinus1 = y - 1, zMinus1 = z - 1;
			let u = fade( x ), v = fade( y ), w = fade( z );
			let  A = p[ X ] + Y, 
          AA = p[ A ] + Z, 
          AB = p[ A + 1 ] + Z, 
           B = p[ X + 1 ] + Y, 
          BA = p[ B ] + Z, 
          BB = p[ B + 1 ] + Z;

			return lerp( w, 
          lerp( v, 
                lerp( u, grad( p[ AA ], x, y, z ),
                         grad( p[ BA ], xMinus1, y, z ) ),
                lerp( u, grad( p[ AB ], x, yMinus1, z ),
                         grad( p[ BB ], xMinus1, yMinus1, z ) ) 
              ),
    			lerp( v, 
               lerp( u, grad( p[ AA + 1 ], x, y, zMinus1 ),
				                grad( p[ BA + 1 ], xMinus1, y, z - 1 ) ),
			         lerp( u, grad( p[ AB + 1 ], x, yMinus1, zMinus1 ),
				                grad( p[ BB + 1 ], xMinus1, yMinus1, zMinus1 ) ) 
              ) 
      );
		}
	};

};

// =====================================================
// ../smoothvoxels/meshgenerator/groupcloner.js
// =====================================================

class GroupCloner {
     
  static cloneGroups(model) {
    // Create a 'locked' prefab group for each prefab by making an empty group without any settings to clone
    model.groups.forEach(function(group) {
      if (group.prefab) {
        let prefabId = group.id + '_Prefab';
        let prefabGroup = { id:prefabId, group:group.group, prefab:true };
        group.group = prefabGroup.id;
        group.prefab = false;
        model.groups.createGroup(prefabGroup);
        model.groups.forEach(function(clone) {
          if (clone.clone === group.id) {
            clone.clone = prefabId;
            if (!clone.position && !clone.translation) {
              if (group.position)
                clone.position = { x:0, y:0, z:0 };
              else
                clone.translation = { x:0, y:0, z:0 };
            }
          }
        }, this);
      }
    }, this);

    // Fill in the missing properties from cloned groups and clone all subgroups (i.e. cloned nested groups)
    model.groups.forEach(function(group) {
      this._cloneGroup(model, group);
    }, this);

    // Propagate prefabs (i.e. every group that has a prefab as parent is itself marked as prefab)
    model.groups.forEach(function(group) {
      if (group.prefab) {
        this._propagatePrefab(model, group.id);
      }
    }, this); 
    
    // Create an extra set of voxel for every cloned group
    model.groups.forEach(function(group) {
      let colors = {};
      delete group.cloneProcessed;
      let toClone = group.clone ? model.groups.getById(group.clone) : null;
      
      if (toClone) {
        model.voxels.forEachInGroup(toClone.id,function(voxel) {
          
          let color = colors[voxel.color.id];
          if (!color) {
            // Recolor the voxel color if there is a recolor defined
            if (group.recolor) {
              color = group.recolor.find(c => c.id === voxel.color.id);
              if (color && !color.material) {
                voxel.color.material.addColor(color);
              }
            }
            color = color ?? voxel.color;
            colors[voxel.color.id] = color;
          }
          
          model.voxels.setVoxel(voxel.x, voxel.y, voxel.z, new Voxel(color, group));
        }, this);
      }
    }, this);
       
    // Now remove all prefab voxels so they are not instantiated
    model.groups.forEach(function(group) {
      if (group.prefab) {
        model.voxels.forEachInGroup(group.id, function(voxel) {
          model.voxels.clearVoxel(voxel.x, voxel.y, voxel.z, group.id);
        }, this);
      }
    }, this); 
    
    // Finally remove all prefab groups
    model.groups.removePrefabs()
  }  
  
  static _cloneGroup(model, group) {
    if (group.clone && !group.cloneProcessed) {
      group.cloneProcessed = true;
      let toClone = model.groups.getById(group.clone);
      this._cloneProperties(group, toClone);
      this._cloneSubGroups(model, toClone.id, group);
    }    
  }
  
  static _cloneProperties(group, toClone) {
    for (const property in toClone) {
      if (group[property] === undefined && property !== 'id' && property !== 'prefab' && property !== 'clone' && property !== 'cloneProcessed' && !property.endsWith('bounds')) {
        group[property] = toClone[property];
      }
    }
  }

  static _cloneSubGroups(model, groupId, newParent) {
    model.groups.forEach(function(group) {
      if (group.group === groupId) {
        let newGroupId = newParent.id + '_' + group.id;
        let clone = group.clone ?? group.id;
        let newGroup = { id:newGroupId, clone, group:newParent.id };
        this._cloneProperties(newGroup, group);
        newGroup.recolor = newGroup.recolor ?? newParent.recolor;
        model.groups.createGroup(newGroup);
        this._cloneSubGroups(model, clone, newGroup);
      }
    }, this);
  }

  static _propagatePrefab(model, groupId) {
    model.groups.forEach(function(group) {
      if (group.group === groupId) {
        group.prefab = true;
        this._propagatePrefab(model, group.id);
      }
    }, this);
  }
}

// =====================================================
// ../smoothvoxels/meshgenerator/facecreator.js
// =====================================================

class FaceCreator {
   
   static createAllFaces(model) {
    model.voxels.forEach(function createFaces(voxel) {
      let faceCount = 0;
      // Check which faces should be generated
      for (let f=0; f < SVOX._FACES.length; f++) {
        let faceName = SVOX._FACES[f];
        let offsets = SVOX._FACEOFFSETS[faceName];
        let face = this._createFace(model, voxel, faceName, 
                                    model.voxels.getVoxel(voxel.x+offsets.x, voxel.y+offsets.y, voxel.z+offsets.z, voxel.group.id));  
        
        if (face) {
          voxel.faces[faceName] = face;
          voxel.color.count++;
          faceCount++;
        }
      }
      
      voxel.visible = faceCount > 0;
    }, this, false);  // Incl. non visible since we are determining visibility here  
  }
  
  static _createFace(model, voxel, faceName, neighbor) {
    let voxelSkip    = voxel?.material?.skip;
    let neighborSkip = neighbor?.material?.skip;
    
    if (!voxel || !voxel.material || voxel.material.opacity === 0) {
      // No voxel, so no face
      return null;
    }
    else if (!neighbor || !neighbor.material) {
      // The voxel is next to an empty voxel, so create a face
    }
    else if (neighbor.material === voxel.material) {
      // Never create internal faces within one material
      return null;
    }
    else if (voxel.material.side !== SVOX.BACK && neighbor.material.side === SVOX.BACK) {
      // The voxel is next to a voxel for which the back side is used, the current voxel should be visible, so create the face
    }
    else if (!voxelSkip?.active && neighborSkip?.active && (neighborSkip?.x || neighborSkip?.y || neighborSkip?.z)) {
      // The voxel is next to a voxel for which one of the sides is missing so show this face.
      // Note: Don't do this for -x, +x, -y, +y, -z or +z because those are typically used to reduce face for unseen sides, which this would make impossible.
    }
    else if (voxel.material.transparent && neighbor.material.wireframe) {
      // Show a transparent material when there is a wireframe voxel against it
    }
    else if (!neighbor.material.transparent && !neighbor.material.wireframe) {
      // The neighbor is not see through, so skip this face
      return null;
    }
    else if (!voxel.material.transparent && !voxel.material.wireframe) {
      // The voxel is not see through, but the neighbor is, so create the face 
    }
    else {
      return null;
    }
    
    // Only create a face when it is not skipped
    if (this._isFacePlanar(model.voxels, voxel, faceName, voxel.material.skip, model.skip)) {
      return null;
    }

    let face = {
      
      vertices: [
        model.vertices.createVertex(voxel, faceName, 0),
        model.vertices.createVertex(voxel, faceName, 1),
        model.vertices.createVertex(voxel, faceName, 2),
        model.vertices.createVertex(voxel, faceName, 3)
      ],
      
      ao: [0, 0, 0, 0],
        
      uv: [null, null, null, null],  // When used will have {u,v} items
            
      flattened: this._isFacePlanar(model.voxels, voxel, faceName, voxel.material.flatten, model.flatten),
      clamped:   this._isFacePlanar(model.voxels, voxel, faceName, voxel.material.clamp, model.clamp),
      hidden:    this._isFacePlanar(model.voxels, voxel, faceName, voxel.material.hide, model.hide)
    };
    
    return face;
  } 
  
  static _isFacePlanar(voxels, voxel, faceName, materialPlanar, modelPlanar) {
    let material = voxel.material;
    
    let planar = materialPlanar;
    let bounds = material.bounds;
    if (!planar) {
      planar = modelPlanar;
      bounds = voxels.bounds;
    }
    
    if (!planar) {
      faceName = 'not';
    }
    
    switch(faceName) {
      case 'nx' : return planar.x || (planar.nx && voxel.x === bounds.minX);
      case 'px' : return planar.x || (planar.px && voxel.x === bounds.maxX);
      case 'ny' : return planar.y || (planar.ny && voxel.y === bounds.minY);
      case 'py' : return planar.y || (planar.py && voxel.y === bounds.maxY);
      case 'nz' : return planar.z || (planar.nz && voxel.z === bounds.minZ);
      case 'pz' : return planar.z || (planar.pz && voxel.z === bounds.maxZ);
      case 'not': return false;
      default: return false;
    }
  }   
}

// =====================================================
// ../smoothvoxels/meshgenerator/vertexlinker.js
// =====================================================

class VertexLinker {
   
  static linkVertices(voxels) {
    voxels.forEach(function linkVertices(voxel) {
      for (let f=0; f < SVOX._FACES.length; f++) {
        let faceName = SVOX._FACES[f];
        let face = voxel.faces[faceName]
        if (face) {
          let vertices = face.vertices;
          if (face.clamped) {
            // Do not link clamped face vertices so the do not pull in the sides on deform.
            // But now this leaves these vertices with only 3 links, which offsets the average.
            // Add the vertex itself to compensate the average.
            // This, for instance, results in straight 45 degree roofs when clamping the sides.
            // This is the only difference in handling flatten vs clamp.
            for (let v = 0; v < 4; v++) {
              let vertex = vertices[v];
              if (vertex.links.indexOf(vertex) === -1) {
                vertex.links.push(vertex);
                vertex.nrOfClampedLinks++;
              }
            }
          }
          else {
            // Link each vertex with its neighbor and back (so not diagonally)
            for (let v = 0; v < 4; v++) {
              let vertexFrom = vertices[v];
              let vertexTo   = vertices[v === 3 ? 0 : v+1];

              if (vertexFrom.links.indexOf(vertexTo) === -1)
                vertexFrom.links.push(vertexTo);
              if (vertexTo.links.indexOf(vertexFrom) === -1)
                vertexTo.links.push(vertexFrom);
            }
          }  
        }
      } 
    }, this);
    
    this._fixClampedLinks(voxels);
  }
  
  static _fixClampedLinks(voxels) {
    // Clamped sides are ignored when deforming so the clamped side does not pull in the adjacent sides.
    // This results in the adjacent sides ending up nice and peripendicular to the clamped sides.
    // However, this als makes all of the vertices of the clamped side not deform.
    // This then results in the corners of these sides sticking out sharply with high deform counts.

    // Find all vertices that are fully clamped (i.e. not at the edge of the clamped side)
    voxels.forEach(function(voxel) {

      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        if (!face.clamped)
          continue;

        for (let v = 0; v < 4; v++) {
          let vertex = face.vertices[v];
          vertex.fullyClamped = vertex.fullyClamped || (vertex.nrOfClampedLinks === vertex.links.length);
          if (vertex.fullyClamped)
            vertex.links = [];
        }

      }        
    }, this, true);

    // For these fully clamped vertices add links for normal deforming
    voxels.forEach(function(voxel) {
      
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        if (!face.clamped) 
          continue;
        
        for (let v = 0; v < 4; v++) {
          let vertexFrom = face.vertices[v];
          let vertexTo = face.vertices[(v+1) % 4];

          if (vertexFrom.fullyClamped && vertexFrom.links.indexOf(vertexTo) === -1) {
            vertexFrom.links.push(vertexTo);
          }
          if (vertexTo.fullyClamped && vertexTo.links.indexOf(vertexFrom) === -1) {
            vertexTo.links.push(vertexFrom);
          }
        }
      }
    }, this, true);
  }   
  
  static logLinks(voxels) {
    voxels.forEach(function(voxel) {      
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        
        let log = `VOXEL (${voxel.x},${voxel.y},${voxel.z}):${faceName}\r\n`;
        for (let v = 0; v < 4; v++) {
          let vertex = face.vertices[v];
          vertex.fullyClamped = vertex.fullyClamped || (vertex.nrOfClampedLinks === vertex.links.length);
          log += `    VERTEX (${vertex.x},${vertex.y},${vertex.z}):${vertex.fullyClampes?"fully":""} :`;
          for (let l = 0; l < vertex.links.length; l++) {
            let link = vertex.links[l];
            log += `(${link.x},${link.y},${link.z}) `;          
          }
          log += `\r\n`;
        }
        
        console.log(log);
      }
    }, this, true);
  }
  
}

// =====================================================
// ../smoothvoxels/meshgenerator/shapemodifier.js
// =====================================================

class ShapeModifier {
  
  static changeShape(model) {
    // Bounds were determined in model.determineBoundsForAllGroups
    
    let shapeFound = false;
    let groups = {};
    model.groups.forEach(function(group) {
      let parameters = null;
      switch (group.shape) {
        case 'sphere'     : parameters = { xStrength:1, yStrength:1, zStrength:1 }; break;
        case 'cylinder-x' : parameters = { xStrength:0, yStrength:1, zStrength:1 }; break;
        case 'cylinder-y' : parameters = { xStrength:1, yStrength:0, zStrength:1 }; break;
        case 'cylinder-z' : parameters = { xStrength:1, yStrength:1, zStrength:0 }; break;
        case 'box': break;
        default: break;
      }
      
      if (parameters) {
        parameters.xMid = (group.bounds.minX + group.bounds.maxX)/2;
        parameters.yMid = (group.bounds.minY + group.bounds.maxY)/2;
        parameters.zMid = (group.bounds.minZ + group.bounds.maxZ)/2;    
        shapeFound = true;
      }
      
      groups[group.id] = parameters;
      
      // Define the transformation in reverse order to how they are carried out
    }, this);  
    
    if (shapeFound) {
      this._circularDeform(model, groups);
    }
  }

  static _circularDeform(model, groups) {
    let group = null;
    model.vertices.forEach(function(vertex) {
      if (!group || group.id !== vertex.group.id)
        group = groups[vertex.group.id];
      
      if (group) {     
        let x = (vertex.x - group.xMid);
        let y = (vertex.y - group.yMid);
        let z = (vertex.z - group.zMid);
        let sphereSize = Math.max(
                            Math.abs(x * group.xStrength), 
                            Math.abs(y * group.yStrength), 
                            Math.abs(z * group.zStrength)
                          );
        let vertexDistance = Math.sqrt(x*x*group.xStrength + y*y*group.yStrength + z*z*group.zStrength);
        if (vertexDistance === 0) return;
        let factor = sphereSize / vertexDistance;
        vertex.newX = x*((1-group.xStrength) + (group.xStrength)*factor) + group.xMid;
        vertex.newY = y*((1-group.yStrength) + (group.yStrength)*factor) + group.yMid;
        vertex.newZ = z*((1-group.zStrength) + (group.zStrength)*factor) + group.zMid;
        vertex.newSet = true;
        vertex.ring = sphereSize;
      }
    }, this);

    this._repositionChangedVertices(model);
    
    this._markEquidistantFaces(model);
  }  
  
    
  static _markEquidistantFaces(model) {
    model.voxels.forEach(function(voxel) {      
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];

        let ring = face.vertices[0].ring;
        if (ring !== undefined) {
          face.equidistant = true;

          for (let v = 1; v < 4; v++) {
            let vertex = face.vertices[v];
            if (vertex.ring !== ring) {
              face.equidistant = false;
              break;
            }
          }
        }
      }
    }, this, true);
  }

  static _repositionChangedVertices(model, dontclamp) {
    
    // Add 0.5 to the min and max because vertices of voxel are 0 - +1  
    // I.e voxel (0,0,0) occupies the space (0,0,0) - (1,1,1) 
    let minX = model.voxels.minX + 0.5;
    let maxX = model.voxels.maxX + 0.5;
    let minY = model.voxels.minY + 0.5;
    let maxY = model.voxels.maxY + 0.5;
    let minZ = model.voxels.minZ + 0.5;
    let maxZ = model.voxels.maxZ + 0.5;
    
    // Move all vertices to their new position without clamping / flattening
    model.vertices.forEach(function(vertex) {
      if (vertex.newSet) {
        vertex.x = vertex.newX;
        vertex.y = vertex.newY;
        vertex.z = vertex.newZ;
        vertex.newSet = false;
      }
    }, this); 
  }
}

// =====================================================
// ../smoothvoxels/meshgenerator/deformer.js
// =====================================================

class Deformer {
  
  static maximumDeformCount(model) {
    let maximumCount = 0;
    model.materials.forEach(function(material) {
      if (material.deform)
        maximumCount = Math.max(maximumCount, material.deform.count)
    });
    return maximumCount;
  }
  
  static deform(model, maximumDeformCount) {
    
    for (let step = 0; step < maximumDeformCount; step++) {

      model.vertices.forEach(function(vertex) {
        
        if (vertex.deform && vertex.deform.count > step) {
          let links = vertex.links;

          if (links.length > 0) {
            // Average all connected vertices
            let x=0, y=0, z=0;
            for (let l=0; l < links.length; l++) {
              x += links[l].x;
              y += links[l].y;
              z += links[l].z;
            }
            
            // The offset is the average of the connected vertices
            let offsetX = x/links.length - vertex.x;
            let offsetY = y/links.length - vertex.y; 
            let offsetZ = z/links.length - vertex.z;
            
            let strength = Math.pow(vertex.deform.damping, step) * vertex.deform.strength;
            if (strength !== 0) {
              vertex.newX = vertex.x+offsetX*strength; 
              vertex.newY = vertex.y+offsetY*strength; 
              vertex.newZ = vertex.z+offsetZ*strength;
              vertex.newSet = true;
            } 
          }
        }
      }, this);

      this._repositionChangedVertices(model);
    }
  }
  
  static warpAndScatter(model) {
    let noise = SVOX.Noise().noise;
    let voxels = model.voxels;
    let tile = model.tile;
    
    model.vertices.forEach(function(vertex) {

      // In case of tiling, do not warp or scatter the edges
      if (tile && (
          (tile.nx && vertex.x < voxels.minX+0.1) || 
          (tile.px && vertex.x > voxels.maxX-0.1) ||
          (tile.ny && vertex.y < voxels.minY+0.1) || 
          (tile.py && vertex.y > voxels.maxY-0.1) ||
          (tile.nz && vertex.z < voxels.minZ+0.1) || 
          (tile.pz && vertex.z > voxels.maxZ-0.1)))
        return;
      
      let amplitudeX = vertex.warp ? vertex.warp.amplitudeX : 0;
      let amplitudeY = vertex.warp ? vertex.warp.amplitudeY : 0;
      let amplitudeZ = vertex.warp ? vertex.warp.amplitudeZ : 0;
      let frequency  = vertex.warp ? vertex.warp.frequency  : 0;
      let frequencyX = amplitudeX !== 0 ? frequency : 0;
      let frequencyY = amplitudeY !== 0 ? frequency : 0;
      let frequencyZ = amplitudeZ !== 0 ? frequency : 0;
      let scatter    = vertex.scatter || 0;
      
      let xOffset = 0, yOffset = 0, zOffset = 0;
      if (((amplitudeX || amplitudeY || amplitudeZ) && frequency !== 0)) {
        xOffset = noise( (vertex.x+0.19) * frequencyX, vertex.y * frequencyY, vertex.z * frequencyZ) * amplitudeX;
        yOffset = noise( (vertex.y+0.17) * frequencyY, vertex.z * frequencyZ, vertex.x * frequencyX) * amplitudeY;
        zOffset = noise( (vertex.z+0.13) * frequencyZ, vertex.x * frequencyX, vertex.y * frequencyY) * amplitudeZ;
      }
      
      if (scatter) {
        xOffset += (Math.random() * 2 - 1) * scatter;
        yOffset += (Math.random() * 2 - 1) * scatter;
        zOffset += (Math.random() * 2 - 1) * scatter;
      }

      if (xOffset !==0 || yOffset!= 0 || zOffset !== 0) {
        vertex.newX = vertex.x + xOffset;
        vertex.newY = vertex.y + yOffset;
        vertex.newZ = vertex.z + zOffset;
        vertex.newSet = true;
      }
    }, this);

    this._repositionChangedVertices(model);
  }

  static _repositionChangedVertices(model) {
    
    // Add 0.5 to the min and max because vertices of voxel are 0 - +1  
    // I.e voxel (0,0,0) occupies the space (0,0,0) - (1,1,1) 
    let minX = model.voxels.minX + 0.5;
    let maxX = model.voxels.maxX + 0.5;
    let minY = model.voxels.minY + 0.5;
    let maxY = model.voxels.maxY + 0.5;
    let minZ = model.voxels.minZ + 0.5;
    let maxZ = model.voxels.maxZ + 0.5;
    
    // Move all vertices to their new position clamping / flattening as required
    model.vertices.forEach(function(vertex) {
      if (vertex.newSet) {
        vertex.x = (vertex.flatten.x || vertex.clamp.x) ? vertex.x : vertex.newX;
        vertex.y = (vertex.flatten.y || vertex.clamp.y) ? vertex.y : vertex.newY;
        vertex.z = (vertex.flatten.z || vertex.clamp.z) ? vertex.z : vertex.newZ;
        vertex.newSet = false;
      }          
    }, this); 
  }
}

// =====================================================
// ../smoothvoxels/meshgenerator/vertextransformer.js
// =====================================================

class VertexTransformer {
         
  static transformVertices(model) {
    // See model.determineBoundsForAllGroups for vertexRescale, originOffset, etc.
    
    model.groups.forEach(function(group) {
      let groups = this.getGroupHierarchy(group, model.groups);
      
      let lastPosition = 0;
      for (let g = groups.length-1; g >= 0; g--) {
        if (!groups[g].translation) {
          lastPosition = g;
        }
        else {
          break;
        }
      }
      
      // Determine the transformations needed for each group
      let transformations = [];      
      
      // First move the group to the origin (0,0,0) as the starting point for all calculations
      let center = group.bounds.getCenter();
      //console.log(`${group.id} - ${JSON.stringify(group.bounds)} - ${JSON.stringify(center)}`)
      transformations.push( { type:'translate', x:-center.x, y:-center.y, z:-center.z } );
      
      for (let g = 0; g < groups.length; g++) {
        let current = groups[g];
        let parent = { scale: { x:1, y:1, z:1 } };
        if (current.id !== '*') {
          parent = model.groups.getById(current.group);
        }

        // The resize property only applies to the group, not its children
        if (current.id === group.id) {
          transformations.push( { type:'scale', x:current.vertexRescale.x, y:current.vertexRescale.y, z:current.vertexRescale.z } );
        }

        // Now scale the group
        if (current.scale) {
          transformations.push( { type:'scale', x:current.scale.x, y:current.scale.y, z:current.scale.z } );
        }

        if (g === 0) {
          // And move it as specified by the origin property
          transformations.push( { type:'translate', x:current.originOffset.x*(current?.scale?.x ?? 1), 
                                                    y:current.originOffset.y*(current?.scale?.y ?? 1), 
                                                    z:current.originOffset.z*(current?.scale?.z ?? 1) } );
        }

        // Then rotate the group
        if (current.rotation) {
          transformations.push( { type:'rotate', x:current.rotation.x, y:current.rotation.y, z:current.rotation.z } );
        }
                
        // Finaly translate the group to the correct location, depending on the translation or the position properties
        if (current.position) {
          transformations.push( { type:'translate', x:current.position.x, y:current.position.y, z:current.position.z } );
        }          
        else if (current.translation) {
          transformations.push( { type:'translate', x:current.translation.x, y:current.translation.y, z:current.translation.z } );
        }             

        if (g === 0) {
          if (group.translation) {
            let center = group.bounds.getCenter();
            // Anchor is the last non-translation (i.e. non relative but) absolute positioned group
            let anchor       = groups[lastPosition].bounds.getCenter();
            let anchorOffset = groups[lastPosition].originOffset;
            transformations.push( { type:'translate', x:center.x - anchor.x + anchorOffset.x, 
                                                      y:center.y - anchor.y + anchorOffset.y, 
                                                      z:center.z - anchor.z + anchorOffset.z } );
          }   
        }
      }
 
      this.logTransformations(group.id, transformations);
      
      // Convert the list of translations to a transformation matrix
      group.vertexTransform = this.getTransformationMatrix(transformations);

      // Convert the vertex transform matrix in a normal transform matrix 
      group.normalTransform = Matrix.transpose(group.vertexTransform);
      group.normalTransform = Matrix.inverse(group.normalTransform);
      
      
    }, this);   

    // Now move all vertices to their new position and transform the average normals
    model.vertices.forEach(function(vertex) {      
      vertex.group.vertexTransform.transformPoint(vertex)
    }, this); 
         
    // Transform all normals
    model.voxels.forEach(function transformNormals(voxel) {
      const normalTransform = voxel.group.normalTransform;
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        if (face) {
          for (let n = 0; n<face.normals.length; n++) {
            if (!face.flatNormals[n].transformed) {
              normalTransform.transformVector(face.flatNormals[n]);
              model._normalize(face.flatNormals[n]);
              face.flatNormals[n].transformed = true;
            }
            if (!face.smoothNormals[n].transformed) {
              normalTransform.transformVector(face.smoothNormals[n]);
              model._normalize(face.smoothNormals[n]);
              face.smoothNormals[n].transformed = true;
            }
            if (!face.bothNormals[n].transformed) {
              normalTransform.transformVector(face.bothNormals[n]);
              model._normalize(face.bothNormals[n]);
              face.bothNormals[n].transformed = true;
            }
          }
        }
      }
    }, this, true);
  }
  
  static getGroupHierarchy(group, groups, hierarchy = []) {
    hierarchy.push(group);
    if (group.group) {
      let parent = groups.getById(group.group);
      if (hierarchy.some(g => g.id === parent.id)) {
        let parentLoop = hierarchy.reduce(function (result, parent) {
          return result + parent.id + ' > ';
        }, '') + parent.id;
        throw {
          name: 'ModelError',
          message: `The groups ${parentLoop} are circularly nested.`
        }
      }
      this.getGroupHierarchy(parent, groups, hierarchy);
    } 
       
    return hierarchy;
  }
  
  static logTransformations(groupId, transformations) {
    //console.log(`===== ${groupId} =====`);
    for (let t = 0; t < transformations.length; t++) {
      let transformation = transformations[t];
      //console.log(`${transformation.type} : ( ${transformation.x}, ${transformation.y}, ${transformation.z} )`);
    }
  }  
  
  static getTransformationMatrix(transformations) {
    let transformationMatrix = new Matrix(); 

    // To calculate the transformation matrix, process all transformations in reverse oder
    for (let t = transformations.length-1; t>=0; t--) {
      let transformation = transformations[t];
      switch (transformation.type) {
        case 'translate':
          transformationMatrix = Matrix.multiply(transformationMatrix, Matrix.translate(transformation.x, transformation.y, transformation.z));                    
          break;
        case 'rotate':
          transformationMatrix = Matrix.multiply(transformationMatrix, Matrix.rotate(transformation.z, 0, 0, 1));
          transformationMatrix = Matrix.multiply(transformationMatrix, Matrix.rotate(transformation.y, 0, 1, 0));
          transformationMatrix = Matrix.multiply(transformationMatrix, Matrix.rotate(transformation.x, 1, 0, 0)); 
          break;
        case 'scale':
          transformationMatrix = Matrix.multiply(transformationMatrix, Matrix.scale(transformation.x, transformation.y, transformation.z));                    
          break;
      }
    }
    
    return transformationMatrix;
  }
}

// =====================================================
// ../smoothvoxels/meshgenerator/normalscalculator.js
// =====================================================

class NormalsCalculator {
 
  static calculateNormals(model) {
    let tile = model.tile;
    let voxels = model.voxels;
    
    voxels.forEach(function computeNormals(voxel) {
      
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        if (face.skipped) 
          continue;
        
        face.smooth = (voxel.material.lighting === SVOX.SMOOTH || voxel.material.lighting === SVOX.BOTH) &&
                      (face.equidistant === true || (face.equidistant === undefined && !face.flattened && !face.clamped));
        
        let vmid = { 
          x: (face.vertices[0].x + face.vertices[1].x + face.vertices[2].x + face.vertices[3].x) / 4,
          y: (face.vertices[0].y + face.vertices[1].y + face.vertices[2].y + face.vertices[3].y) / 4,
          z: (face.vertices[0].z + face.vertices[1].z + face.vertices[2].z + face.vertices[3].z) / 4
        };

        face.flatNormals   = [null, null, null, null];
        face.smoothNormals = [null, null, null, null];
        face.bothNormals   = [null, null, null, null];        
        
        // Per vertex calculate the normal by means of the cross product
        // using the previous vertex and the quad midpoint.
        // This prevents (most) flipped normals when one vertex moves over the diagonal.
        for (let v = 0; v < 4; v++) {
          let vertex = face.vertices[v];
          let vprev = face.vertices[(v+3) % 4];
          
          if (faceName === 'pz' && v === 2) {
            let stop = true;
          }
          
          vertex.smoothNormal = vertex.smoothNormal || { x:0, y:0, z:0 };
          vertex.bothNormal   = vertex.bothNormal   || { x:0, y:0, z:0 };
          
          // Subtract vectors
          let e1X = vprev.x - vertex.x, e1Y = vprev.y - vertex.y, e1Z = vprev.z - vertex.z;
          let e2X = vmid.x  - vertex.x, e2Y = vmid.y  - vertex.y, e2Z = vmid.z  - vertex.z;
                   
          // Calculate normal via the cross product
          let normal = {
            x: e1Y * e2Z - e1Z * e2Y,
            y: e1Z * e2X - e1X * e2Z,
            z: e1X * e2Y - e1Y * e2X
          }
          
          let clamp = voxel.material.clamp ?? model.clamp;
          let flatten = voxel.material.flatten ?? model.flatten;

          let peripendicularNX = ((tile && tile.nx) || (clamp && (clamp.x || clamp.nx))) && vertex.x < voxels.minX+0.0001;
          let peripendicularPX = ((tile && tile.px) || (clamp && (clamp.x || clamp.px))) && vertex.x > voxels.maxX-0.0001;
          let peripendicularNY = ((tile && tile.ny) || (clamp && (clamp.y || clamp.ny))) && vertex.y < voxels.minY+0.0001;
          let peripendicularPY = ((tile && tile.py) || (clamp && (clamp.y || clamp.py))) && vertex.y > voxels.maxY-0.0001;
          let peripendicularNZ = ((tile && tile.nz) || (clamp && (clamp.z || clamp.nz))) && vertex.z < voxels.minZ+0.0001;
          let peripendicularPZ = ((tile && tile.pz) || (clamp && (clamp.z || clamp.pz))) && vertex.z > voxels.maxZ-0.0001;

          // In case of tiling or clamped sides, make normals peripendicular on edges
          if ((peripendicularNX || peripendicularPX) && 
              (faceName === 'ny' || faceName === 'py' || faceName === 'nz' || faceName === 'pz')) {
            normal.x = 0;
          }
          if ((peripendicularNY || peripendicularPY) && 
              (faceName === 'nx' || faceName === 'px' || faceName === 'nz' || faceName === 'pz')) {
            normal.y = 0;
          }
          if ((peripendicularNZ || peripendicularPZ) && 
              (faceName === 'nx' || faceName === 'px' || faceName === 'ny' || faceName === 'py')) {
            normal.z = 0;
          }
          
          // Flattened or clamped sides, make normals peripendicular to the side
          if (voxel.material.type === SVOX.BOTH) {
            if (faceName === 'nx' && (peripendicularNX || (clamp && (clamp.x || clamp.nx)) || (flatten && (flatten.x || flatten.nx)))) {
              normal.x = -1; normal.y = 0; normal.z = 0;
            } 
            if (faceName === 'px' && (peripendicularPX || (clamp && (clamp.x || clamp.px)) || (flatten && (flatten.x || flatten.px)))) {
              normal.x = 1; normal.y = 0; normal.z = 0;
            } 
            if (faceName === 'ny' && (peripendicularNY || (clamp && (clamp.y || clamp.ny)) || (flatten && (flatten.y || flatten.ny)))) {
              normal.x = 0; normal.y = -1; normal.z = 0;
            } 
            if (faceName === 'py' && (peripendicularPY || (clamp && (clamp.y || clamp.py)) || (flatten && (flatten.y || flatten.py)))) {
              normal.x = 0; normal.y = 1; normal.z = 0;
            } 
            if (faceName === 'nz' && (peripendicularNZ || (clamp && (clamp.z || clamp.nz)) || (flatten && (flatten.z || flatten.nz)))) {
              normal.x = 0; normal.y = 0; normal.z = -1;
            } 
            if (faceName === 'pz' && (peripendicularPZ || (clamp && (clamp.z || clamp.pz)) || (flatten && (flatten.z || flatten.pz)))) {
              normal.x = 0; normal.y = 0; normal.z = 1;
            } 
          }
           
          // Clean up vertex normals which are almost level, and make them level. (not really needed, but makes for a cleaner model)
          if (Math.abs(normal.x)<0.0001) normal.x = 0;
          if (Math.abs(normal.y)<0.0001) normal.y = 0;
          if (Math.abs(normal.z)<0.0001) normal.z = 0;
          
          model._normalize(normal);
          
          // Store the normal for all 4 vertices (used for flat lighting)
          face.flatNormals[v] = normal;
                                
          // Always count towards the smoothNormal
          vertex.smoothNormal.x += normal.x;
          vertex.smoothNormal.y += normal.y;
          vertex.smoothNormal.z += normal.z;
          
          // But only add this normal to bothNormal when the face uses smooth lighting
          if (face.smooth) {            
            vertex.bothNormal.x += normal.x;
            vertex.bothNormal.y += normal.y;
            vertex.bothNormal.z += normal.z;
          }
        }
      }
    }, this, true);
      
    // Then normalize the vertex normals
    model.vertices.forEach(function normalizeNormals(vertex) { 
      model._normalize(vertex.smoothNormal);
      model._normalize(vertex.bothNormal);
    }, this);    
    
    
    let nonManifoldCount = 0;
    model.voxels.forEach(function calculateNormals(voxel) {
      
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        if (face.skipped) 
          continue;
        
        // Store all the different normals (needed for the shell)
        
        // face.flatNormals is already set

        face.smoothNormals[0] = face.vertices[0].smoothNormal;
        face.smoothNormals[1] = face.vertices[1].smoothNormal;
        face.smoothNormals[2] = face.vertices[2].smoothNormal;
        face.smoothNormals[3] = face.vertices[3].smoothNormal;
        
        face.bothNormals[0] = !face.smooth || model._isZero(face.vertices[0].bothNormal) ? face.flatNormals[0] : face.vertices[0].bothNormal;
        face.bothNormals[1] = !face.smooth || model._isZero(face.vertices[1].bothNormal) ? face.flatNormals[1] : face.vertices[1].bothNormal;
        face.bothNormals[2] = !face.smooth || model._isZero(face.vertices[2].bothNormal) ? face.flatNormals[2] : face.vertices[2].bothNormal;
        face.bothNormals[3] = !face.smooth || model._isZero(face.vertices[3].bothNormal) ? face.flatNormals[3] : face.vertices[3].bothNormal;
        
        // Now set the actual normals for this face
        switch (voxel.material.lighting) {
          case SVOX.SMOOTH:
            face.normals = face.smoothNormals;
            break;
          case SVOX.BOTH:
            face.normals = face.bothNormals; 
            break;
          default:
            face.normals = face.flatNormals;
            break;
        }
                
        // If the vertex is used by opposite faces it is non manifold, wich gives bad normals on smooth voxels
        if ((voxel.material.lighting === SVOX.SMOOTH || voxel.material.lighting === SVOX.BOTH) && this._isNonManifold(face)) {

          for (let v=0;v<4;v++) {
            if (face.vertices[v].nonManifold) {              
              face.normals[v] = face.flatNormals[v];          
              nonManifoldCount++;
            }
          }
        }        
        
      }
    }, this, true);
    
    if (nonManifoldCount > 0) {
      SVOX.logInfo({ name:'ModelHint', message:`Non manifold vertices detected. Smooth Voxels replaced ${nonManifoldCount} bad smooth normals with flat normals. When possible try to avoid non manifold models with smooth lighting for better results.` }, model.name);
    }
              
    
  } 
  
  static _isNonManifold(face) {
    let nonManifold = false
    for (let v=0; v<4; v++) {
      let vertex = face.vertices[v];
        let count = 0;
        if (vertex.faces.px === true && vertex.faces.nx === true) count++;
        if (vertex.faces.py === true && vertex.faces.ny === true) count++;
        if (vertex.faces.pz === true && vertex.faces.nz === true) count++;
        vertex.nonManifold = count >= 2;
        nonManifold = nonManifold || vertex.nonManifold;
    }
    return nonManifold;
  }
}

// =====================================================
// ../smoothvoxels/meshgenerator/octree.js
// =====================================================

class Octree {
  
  // Failed optimization attempts:
  // - Binary tree instead of octree: marginally slower
  // - Pre filter the octree by checking if the samples-sphere hits the box at all: much slower 
  //   (probably because a only very small percentage of the boxes are hit by a sample, and the rest are already skipped)
  // - in triangleDistance first do a check if origin and end are both smaller/larger than the min/max of x, y & z (similar to hit box): slower
  // - change the triangles array from [ [ {v1x,v1y,v1z}, {v2z,v2y,v2z}, {v3x,v3y,v3z} ], ... ] to [ v1x,v1y,v1z, v2z,v2y,v2z, v3x,v3y,v3z, ... ]: only marginally faster
    
  constructor(model) {
    const scale = Math.min(model.scale.x, model.scale.y, model.scale.z);
    const BIAS     = 0.1 * scale;
    
    let triangles = this._getAllFaceTriangles(model); 
    this.octree = this._trianglesToOctree(triangles);
    if (model.aoSides)
      this.octree = this._aoSidesToOctree(model, this.octree, BIAS);    
  }
  
  _getAllFaceTriangles(model) {
    let triangles = [];
    model.voxels.forEach(function(voxel) {
      if (voxel.material.opacity < 0.75) return;
      if (!voxel.material.castShadow) return;

      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        
        // Hidden faces cannot occulude 
        if (face.hidden) 
          continue;
        
        triangles.push([face.vertices[2], face.vertices[1], face.vertices[0]]);
        triangles.push([face.vertices[0], face.vertices[3], face.vertices[2]]);        
      }
    }, this, true); // Visible only
        
    return triangles;
  }
  
  _trianglesToOctree(triangles) {
    let length = triangles.length;

    if (length <= 9) { // Tested optimal for the Hello SVOX model AO & Shadow
      return this._trianglesToPartition(triangles);      
    }
    else {
      
      let midx = 0, midy = 0, midz = 0;
      for(let t=0; t<length; t++) {
        let triangle = triangles[t];
        midx += triangle[0].x + triangle[1].x + triangle[2].x;
        midy += triangle[0].y + triangle[1].y + triangle[2].y;
        midz += triangle[0].z + triangle[1].z + triangle[2].z;
      }
      midx /= length;   // Don't divide by 3 so we don't have to do that below
      midy /= length;
      midz /= length;
      
      let partitions = []
      for(let t=0; t<length; t++) {
        let triangle = triangles[t];
        let x = (triangle[0].x + triangle[1].x + triangle[2].x) < midx ? 0 : 1;
        let y = (triangle[0].y + triangle[1].y + triangle[2].y) < midy ? 0 : 1;
        let z = (triangle[0].z + triangle[1].z + triangle[2].z) < midz ? 0 : 1;
        let index = x + y*2 + z*4;
        if (partitions[index])
          partitions[index].push(triangle);
        else
          partitions[index] = [ triangle ];
      }
        
      // Remove empty partitions
      for (let index = 7; index >= 0; index--) {
        if (!partitions[index]) 
          partitions.splice(index, 1);
      }
      
      if (partitions.length === 1) {
        // We could not split this partition further. This happens when there are 
        // duplicate triangles, which can happen if the scale has a 0 component.
        // This would otherwise result in an endless loop / stack overflow
        return this._trianglesToPartition(triangles);
      }

      let partition = {
        minx: Number.MAX_VALUE, miny: Number.MAX_VALUE, minz: Number.MAX_VALUE,
        maxx: -Number.MAX_VALUE, maxy: -Number.MAX_VALUE, maxz: -Number.MAX_VALUE,  
        partitions: partitions
      };
      
      for (let index = 0; index < partitions.length; index++) {
        partitions[index] = this._trianglesToOctree(partitions[index]);
        partition.minx = Math.min(partition.minx, partitions[index].minx);
        partition.miny = Math.min(partition.miny, partitions[index].miny);
        partition.minz = Math.min(partition.minz, partitions[index].minz);
        partition.maxx = Math.max(partition.maxx, partitions[index].maxx);
        partition.maxy = Math.max(partition.maxy, partitions[index].maxy);
        partition.maxz = Math.max(partition.maxz, partitions[index].maxz);
      }
        
      return partition;        
    }
  } 
  
  _trianglesToPartition(triangles) {    
    let partition = { 
      minx: Number.MAX_VALUE, miny: Number.MAX_VALUE, minz: Number.MAX_VALUE,
      maxx: -Number.MAX_VALUE, maxy: -Number.MAX_VALUE, maxz: -Number.MAX_VALUE,
      triangles: triangles
    }

    let length = triangles.length;
    for(let t=0; t<length; t++) {
      let triangle = triangles[t];
      partition.minx = Math.min(partition.minx, triangle[0].x, triangle[1].x, triangle[2].x);
      partition.miny = Math.min(partition.miny, triangle[0].y, triangle[1].y, triangle[2].y);
      partition.minz = Math.min(partition.minz, triangle[0].z, triangle[1].z, triangle[2].z);
      partition.maxx = Math.max(partition.maxx, triangle[0].x, triangle[1].x, triangle[2].x);
      partition.maxy = Math.max(partition.maxy, triangle[0].y, triangle[1].y, triangle[2].y);
      partition.maxz = Math.max(partition.maxz, triangle[0].z, triangle[1].z, triangle[2].z);
    }
    
    return partition;    
  }
    
  _aoSidesToOctree(model, octree, BIAS) {
    let bounds = model.groups.getById('*').vertexBounds;
    
    let sideTriangles = [];
    
    // Add the sides twice. 
    // First add the exact plane so adjacent faces have the same look as if the side was made of voxels.
    // Secondly add a plane offset so that rays from the occluded side hit something (as rays are offset from the voxel the origin is already beyond the plane)
    for (let b = 0; b <=1; b++) {
      const bias = BIAS * 2 * b;
      
      if (model.aoSides.nx) 
        sideTriangles.push ( [ { x:bounds.minX-bias, y:  1000000, z:-1000000 }, 
                               { x:bounds.minX-bias, y:  1000000, z: 1000000 }, 
                               { x:bounds.minX-bias, y:-10000000, z:       0 } ] );
      if (model.aoSides.px) 
        sideTriangles.push ( [ { x:bounds.maxX+bias, y: 1000000,  z: 1000000 }, 
                               { x:bounds.maxX+bias, y: 1000000,  z:-1000000 }, 
                               { x:bounds.maxX+bias, y:-10000000, z:       0 } ] );
      if (model.aoSides.ny) 
        sideTriangles.push ( [ { x: 1000000, y:bounds.minY-bias, z:-1000000 }, 
                               { x:-1000000, y:bounds.minY-bias, z:-1000000 }, 
                               { x:       0, y:bounds.minY-bias, z:10000000 } ] );
      if (model.aoSides.py) 
        sideTriangles.push ( [ { x:-1000000, y:bounds.maxY+bias, z:-1000000 }, 
                               { x: 1000000, y:bounds.maxY+bias, z:-1000000 }, 
                               { x:       0, y:bounds.maxY+bias, z:10000000 } ] );
      if (model.aoSides.nz) 
        sideTriangles.push ( [ { x: 1000000, y: 1000000,  z:bounds.minZ-bias }, 
                               { x:-1000000, y: 1000000,  z:bounds.minZ-bias }, 
                               { x:       0, y:-10000000, z:bounds.minZ-bias } ] );
      if (model.aoSides.pz) 
        sideTriangles.push ( [ { x:-1000000, y: 1000000,  z:bounds.maxZ+bias }, 
                               { x: 1000000, y: 1000000,  z:bounds.maxZ+bias }, 
                               { x:       0, y:-10000000, z:bounds.maxZ+bias } ] );    
    }
    
    if (sideTriangles.length > 0) {
      let sideOctree = this._trianglesToOctree(sideTriangles);
      octree = { 
          minx: -Number.MAX_VALUE, miny: -Number.MAX_VALUE, minz: -Number.MAX_VALUE,
          maxx: Number.MAX_VALUE, maxy: Number.MAX_VALUE, maxz: Number.MAX_VALUE,
          
          // Combine the sideOctree with the octree
          partitions: [ octree, sideOctree ]
        }
    }
    
    return octree;
  } 
  
  _hitsOctree(origin, direction, max, end, face, octree = null) {
    octree = octree ?? this.octree;
        
    if (!this._hitsBox(origin.x, origin.y, origin.z, end.x, end.y, end.z, octree))
      return false;

    if (octree.triangles) {
      return this._hitsTriangles(octree.triangles, origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, max);
    }
    
    for (let p=0; p < octree.partitions.length; p++) { 
      if (this._hitsOctree(origin, direction, max, end, face, octree.partitions[p]))
        return true;
    }
    return false;    
  }  
  
  _distanceToOctree(origin, direction, max, end, face, octree = null) {
    octree = octree ?? this.octree;
        
    if (!this._hitsBox(origin.x, origin.y, origin.z, end.x, end.y, end.z, octree))
      return null;

    if (octree.triangles) {
      return this._distanceToTriangles(octree.triangles, origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, max);
    }

    let minDistance = null;
    for (let p=0; p < octree.partitions.length; p++) { 
      let distance = this._distanceToOctree(origin, direction, max, end, face, octree.partitions[p]);
      if (distance) {
        minDistance = Math.min(minDistance ?? max, distance);
      }      
    }
    return minDistance;    
  }

  // Algorithm copied from https://www.gamedev.net/zakwayda
  // https://www.gamedev.net/forums/topic/338987-aabb-line-segment-intersection-test/3209917/
  // Rewritten for js and added the quick tests at the top, and removed divisions to improve speed
  _hitsBox(originX, originY, originZ, endX, endY, endZ, box) {
    
    // Check if the entire line is fully outside of the box planes
    if (originX < box.minx && endX < box.minx) return false;
    if (originX > box.maxx && endX > box.maxx) return false;
    if (originY < box.miny && endY < box.miny) return false;
    if (originY > box.maxy && endY > box.maxy) return false;
    if (originZ < box.minz && endZ < box.minz) return false;
    if (originZ > box.maxz && endZ > box.maxz) return false;
    
    let dx = (endX-originX);
    let dy = (endY-originY);
    let dz = (endZ-originZ);
    let ex = (box.maxx-box.minx);
    let ey = (box.maxy-box.miny);
    let ez = (box.maxz-box.minz);
    let cx = (originX*2 + dx) - (box.minx + box.maxx);
    let cy = (originY*2 + dy) - (box.miny + box.maxy);
    let cz = (originZ*2 + dz) - (box.minz + box.maxz);
    let adx = Math.abs(dx);
    let ady = Math.abs(dy);
    let adz = Math.abs(dz);

    if (Math.abs(cx) > ex + adx)
        return false;
    if (Math.abs(cy) > ey + ady)
        return false;
    if (Math.abs(cz) > ez + adz)
        return false;
    if (Math.abs(dy * cz - dz * cy) > ey * adz + ez * ady + Number.EPSILON)
        return false;
    if (Math.abs(dz * cx - dx * cz) > ez * adx + ex * adz + Number.EPSILON)
        return false;
    if (Math.abs(dx * cy - dy * cx) > ex * ady + ey * adx + Number.EPSILON) 
       return false;        
    
    return true;
  }  
  
  _hitsTriangles(triangles, originX, originY, originZ, directionX, directionY, directionZ, max) {  

    for (let t=0; t < triangles.length; t++) {
      let triangle = triangles[t];
      
      let distance = this._triangleDistance(triangle[0], triangle[1], triangle[2], originX, originY, originZ, directionX, directionY, directionZ);
      if ((distance ?? max) < max)
        return true
    }
    
    return false;    
  }  
  
  _distanceToTriangles(triangles, originX, originY, originZ, directionX, directionY, directionZ, max) {  
    let minDistance = null;
    
    for (let t=0; t < triangles.length; t++) {
      let triangle = triangles[t];
      
      let distance = this._triangleDistance(triangle[0], triangle[1], triangle[2], originX, originY, originZ, directionX, directionY, directionZ);
      if (distance) {
        minDistance = Math.min(minDistance || max, distance);
      }     
    }
    
    return minDistance;    
  }
  
  // Ray - triangle Möller–Trumbore intersection algorithm
  // https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
  // Adapted to return distance and minimize object allocations
  // Note: direction must be normalized.
  _triangleDistance(vertex0, vertex1, vertex2, originX, originY, originZ, directionX, directionY, directionZ) {   
    let edge1x = vertex1.x - vertex0.x;
    let edge1y = vertex1.y - vertex0.y;
    let edge1z = vertex1.z - vertex0.z;
    let edge2x = vertex2.x - vertex0.x;
    let edge2y = vertex2.y - vertex0.y;
    let edge2z = vertex2.z - vertex0.z;
    
    // Compute the normal of the triangle.
    let normalx = edge1y * edge2z - edge1z * edge2y;
    let normaly = edge1z * edge2x - edge1x * edge2z;
    let normalz = edge1x * edge2y - edge1y * edge2x;

    // Compute the dot product between the normal and the direction of the ray.
    // This sometimes looks better, sometimes worse, so I decided to leave it out.
    //let dot = normalx * direction.x + normaly * direction.y + normalz * direction.z;
    //if (dot > 0) {
    //  // The ray intersects the triangle from the back.
    //  return null;
    //}     

    // h = crossProduct(direction, edge2)
    let h0 = directionY * edge2z - directionZ * edge2y;
    let h1 = directionZ * edge2x - directionX * edge2z; 
    let h2 = directionX * edge2y - directionY * edge2x;
    
    // a = dotProduct(edge1, h)
    let a = edge1x * h0 + edge1y * h1 + edge1z * h2;
    if (a > -Number.EPSILON && a < Number.EPSILON)
        return null;    // This ray is parallel to this triangle.
    
    let f = 1.0/a;
    let sx = originX - vertex0.x;
    let sy = originY - vertex0.y;
    let sz = originZ - vertex0.z;
    
    // u = f * dotProduct(s, h);
    let u = f * (sx * h0 + sy * h1 + sz * h2);
    if (u < 0.0 || u > 1.0)
        return null;
    
    // q = crossProduct(s, edge1)
    let q0 = sy * edge1z - sz * edge1y;
    let q1 = sz * edge1x - sx * edge1z;
    let q2 = sx * edge1y - sy * edge1x;
    
    // v = f * dotProduct(direction, q);
    let v = f * (directionX * q0 + directionY * q1 + directionZ * q2);
    if (v < 0.0 || u + v > 1.0)
        return null;
    
    // At this stage we can compute t to find out where the intersection point is on the line.
    // t = f * dotProduct(edge2, q)
    let t = f * (edge2x * q0 + edge2y * q1 + edge2z * q2);
    if (t <= Number.EPSILON) 
        return null;  // This means that there is a line intersection but not a ray intersection.
      
    // Ray intersection is at:
    // { x:originX + rayVector.x * t, y:originY + rayVector.y * t, z:originZ + rayVector.z * t }
    // But we're only interested in the distance (t)
    
    // Discard the face of origin
    //if (t < 0.001)
    // return null;
    
    //console.log(`a:${a} u:${u} v:${v} t:${t}`);   
   
    return t;
  }  
}

// =====================================================
// ../smoothvoxels/meshgenerator/aocalculator.js
// =====================================================

class AOCalculator {
  
  static calculateAmbientOcclusion(model) {
    let doAo = model.ao || model.materials.find(function(m) { return m.ao; } );
    if (!doAo) 
      return;

    let octree = new Octree(model);
    
    let nrOfSamples = model.aoSamples;
    let samples = this._generateFibonacciSamples(nrOfSamples);
    
    let cache = {};
    let origin = { x:0, y:0, z:0 };
    let end    = { x:0, y:0, z:0 };
    
    const scale = Math.min(model.scale.x, model.scale.y, model.scale.z);
    const BIAS     = 0.1 * scale;
    const ONE_BIAS = 1 - BIAS;
    
    model.voxels.forEach(function calculateAO(voxel) {
      let ao = voxel.material.ao || (voxel.material.lights ? model.ao : undefined);
      if (voxel.material.quickAo || !ao || ao.maxDistance === 0 || ao.intensity === 0 || ao.angle < 1 || voxel.material.opacity === 0)
        return;

      let max = ao.maxDistance * scale;
      let intensity = ao.intensity;
      let angle = Math.cos(ao.angle / 180 * Math.PI);

      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        if (face.hidden)
          continue;
        
        face.ao[0] = 0; face.ao[1] = 0; face.ao[2] = 0; face.ao[3] = 0;
        //console.log('----------');  
        for (let v = 0; v<4; v++) {

          let vertex = face.vertices[v];
          let normal = face.normals[v]; 
          //console.log(JSON.stringify( {x:normal.x, y:normal.y, z:normal.z} ));
          
          let cacheKey = `${vertex.x}|${vertex.y}|${vertex.z}|${normal.x}|${normal.y}|${normal.z}`;
          let cachedAo = cache[cacheKey];
          if (cachedAo) {
            face.ao[v] = cachedAo;
            continue;
          }    
                              
          // Move the ray origin out of the corner and out of the plane.
          let opposite = face.vertices[(v+2) % 4];
          origin.x = vertex.x * ONE_BIAS + opposite.x * BIAS + normal.x * BIAS;
          origin.y = vertex.y * ONE_BIAS + opposite.y * BIAS + normal.y * BIAS;
          origin.z = vertex.z * ONE_BIAS + opposite.z * BIAS + normal.z * BIAS;
          
          let total = 0;
          let count = 0;

          for (let s = 0; s < nrOfSamples; s++) {
            let direction = samples[s];
            let dot = direction.x*normal.x + direction.y*normal.y + direction.z*normal.z;
            if (dot <= angle) continue;
            
            end.x = origin.x + direction.x * max;
            end.y = origin.y + direction.y * max;
            end.z = origin.z + direction.z * max;
            
            let distance = octree._distanceToOctree(origin, direction, max, end, face);
                                    
            total += (distance ?? max); 
            count++;
          }
          
          if (count === 0)
            face.ao[v] = 0;
          else {
            total = Math.max(Math.min(total/max/count, 1), 0);
            
            face.ao[v] = 1 - Math.pow(total, intensity);  
          }
          
          cache[cacheKey] = face.ao[v];

        }
      }
    }, this, true);  // true == visible voxels only 
  }
    
  // Generate the samples using a Fibonacci Spiral
  // https://bduvenhage.me/geometry/2019/07/31/generating-equidistant-vectors.html
  static _generateFibonacciSamples(count) {
    let samples = [];
   
    let gr = (Math.sqrt(5.0) + 1.0) / 2.0;  // golden ratio = 1.6180339887498948482
    let ga = (2.0 - gr) * (2.0*Math.PI);    // golden angle = 2.39996322972865332

    for (let i=1; i <= count; ++i) {
        let lat = Math.asin(-1.0 + 2.0 * i / (count+1));
        let lon = ga * i;

        let x = Math.cos(lon)*Math.cos(lat);
        let y = Math.sin(lat);
        let z = Math.sin(lon)*Math.cos(lat);

        //samples.push( { x:x, y:y*1.25+0.5, z:z } ); // Elongate and move up for light from above
        samples.push( { x:x, y:y, z:z } );
    }
    
    return samples;
  }
  
}

// =====================================================
// ../smoothvoxels/meshgenerator/lightscalculator.js
// =====================================================

class LightsCalculator {
  
  static calculateLights(model) {

    if (model.lights.length === 0)
      return;
    
    const scale = Math.min(model.scale.x, model.scale.y, model.scale.z);
    const BIAS     = 0.1 * scale;
    const ONE_BIAS = 1 - BIAS;
    let octree = new Octree(model);
    
    // To calculate the transformation matrix, process all transformations in reverse oder
    let positionTransformationMatrix = new Matrix(); 
    positionTransformationMatrix = Matrix.multiply(positionTransformationMatrix, Matrix.translate(model.position.x, model.position.y, model.position.z));
    positionTransformationMatrix = Matrix.multiply(positionTransformationMatrix, Matrix.rotate(model.rotation.z, 0, 0, 1));
    positionTransformationMatrix = Matrix.multiply(positionTransformationMatrix, Matrix.rotate(model.rotation.y, 0, 1, 0));
    positionTransformationMatrix = Matrix.multiply(positionTransformationMatrix, Matrix.rotate(model.rotation.x, 1, 0, 0));
    positionTransformationMatrix = Matrix.multiply(positionTransformationMatrix, Matrix.scale(model.scale.x, model.scale.y, model.scale.z));                    

    let directionTransformationMatrix = new Matrix(); 
    directionTransformationMatrix = Matrix.multiply(directionTransformationMatrix, Matrix.rotate(model.rotation.z, 0, 0, 1));
    directionTransformationMatrix = Matrix.multiply(directionTransformationMatrix, Matrix.rotate(model.rotation.y, 0, 1, 0));
    directionTransformationMatrix = Matrix.multiply(directionTransformationMatrix, Matrix.rotate(model.rotation.x, 1, 0, 0));
    directionTransformationMatrix = Matrix.multiply(directionTransformationMatrix, Matrix.scale(model.scale.x, model.scale.y, model.scale.z));                    

    model.actualLights = [];
    
    model.lights.forEach(function(light) {      
      if (light.atVoxel) {
        this.addLightsAtVoxel(model, model.actualLights, light);
      }
      else {
        let lightCopy = { 
            color:      light.color,
            intensity:  light.intensity,
            distance:   light.distance * (model.scale.x + model.scale.y + model.scale.z)/3,
            size:       light.size * (model.scale.x + model.scale.y + model.scale.z)/3,
            detail:     light.detail,
            castShadow: light.castShadow,
            data:       light.data
        };          
        
        if (light.direction) {
          lightCopy.direction = { x: light.direction.x, 
                                  y: light.direction.y, 
                                  z: light.direction.z 
                                };                                                            
          directionTransformationMatrix.transformPoint(lightCopy.direction)
          lightCopy.normalizedDirection = model._normalize(lightCopy.direction);
        }
      
        if (light.position) {
          lightCopy.position = { x: light.position.x, 
                                 y: light.position.y, 
                                 z: light.position.z 
                               };
          positionTransformationMatrix.transformPoint(lightCopy.position)
        }
        
        model.actualLights.push(lightCopy);       
      }
    }, this);
    
    let origin = { x:0, y:0, z:0 };
    let end = { x:0, y:0, z:0 };
    let direction = { x:0, y:0, z:0 };

    let cache = {};

    model.voxels.forEach(function(voxel) {
      
      // If this material is not affected by lights, no need to calculate the lights
      if (!voxel.material.lights)
        return; 
      
      let minX =  Number.MAX_VALUE;
      let minY =  Number.MAX_VALUE;
      let minZ =  Number.MAX_VALUE;
      let maxX = -Number.MAX_VALUE;
      let maxY = -Number.MAX_VALUE;
      let maxZ = -Number.MAX_VALUE;
      
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        minX = Math.min(minX, face.vertices[0].x, face.vertices[1].x, face.vertices[2].x, face.vertices[3].x);
        maxX = Math.max(maxX, face.vertices[0].x, face.vertices[1].x, face.vertices[2].x, face.vertices[3].x);
        minY = Math.min(minY, face.vertices[0].y, face.vertices[1].y, face.vertices[2].y, face.vertices[3].y);
        maxY = Math.max(maxY, face.vertices[0].y, face.vertices[1].y, face.vertices[2].y, face.vertices[3].y);
        minZ = Math.min(minZ, face.vertices[0].z, face.vertices[1].z, face.vertices[2].z, face.vertices[3].z);
        maxZ = Math.max(maxZ, face.vertices[0].z, face.vertices[1].z, face.vertices[2].z, face.vertices[3].z);
      }      
    
      // Create the light results in each face
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];      
        face.light = [ ];
      }
                    
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];

        //console.log(`${faceName} (${face.vertices[0].x}, ${face.vertices[0].y}, ${face.vertices[0].z})  (${face.vertices[1].x}, ${face.vertices[1].y}, ${face.vertices[1].z})  (${face.vertices[2].x}, ${face.vertices[2].y}, ${face.vertices[2].z})  (${face.vertices[3].x}, ${face.vertices[3].y}, ${face.vertices[3].z})`);

        for (let v = 0; v<4; v++) {
          let vertex = face.vertices[v];
          let normal = face.normals[v];

          let cacheKey = `${vertex.x}|${vertex.y}|${vertex.z}|${normal.x}|${normal.y}|${normal.z}`;
          let cachedLight = cache[cacheKey];
          if (!cachedLight) {
            cachedLight = { r:0, g:0, b:0, c:0 };
            cache[cacheKey] = cachedLight;
          } 
          cachedLight.c++;
          face.light[v] = cachedLight;
            
          model.actualLights.forEach(function(light) {

            if (light.position && light.distance) {
              // Check for early bailout if the light is too far away
              if ((minX - light.distance >= light.position.x) || (maxX + light.distance <= light.position.x)) return;
              if ((minY - light.distance >= light.position.y) || (maxY + light.distance <= light.position.y)) return;
              if ((minZ - light.distance >= light.position.z) || (maxZ + light.distance <= light.position.z)) return;
            }

            let exposure = light.intensity ?? 1;
            let normalizedDirectionX = light.normalizedDirection?.x;
            let normalizedDirectionY = light.normalizedDirection?.y;
            let normalizedDirectionZ = light.normalizedDirection?.z;
            let length = Number.MAX_VALUE;
            if (light.position) {
              let vectorX = light.position.x - vertex.x;
              let vectorY = light.position.y - vertex.y;
              let vectorZ = light.position.z - vertex.z;
              length = Math.sqrt( vectorX * vectorX + vectorY * vectorY + vectorZ * vectorZ );
              if (Math.abs(length) < 0.000001) {
                length = 1;
              }
              normalizedDirectionX = vectorX/length;
              normalizedDirectionY = vectorY/length;
              normalizedDirectionZ = vectorZ/length;
            }
            
            if (typeof normalizedDirectionX === 'number') {
              exposure = light.intensity * 
                         Math.max(normal.x*normalizedDirectionX + 
                                  normal.y*normalizedDirectionY + 
                                  normal.z*normalizedDirectionZ, 0.0);
            }
            if (light.position && light.distance) {
              exposure = exposure * (1 - Math.min(length / light.distance, 1));
            }

            if (light.position || light.direction) {
              // Move the ray origin out of the corner and out of the plane.
              let opposite = face.vertices[(v+2) % 4];
              
              origin.x = vertex.x * 0.75 + opposite.x * 0.25 + normal.x * scale * 0.25;
              origin.y = vertex.y * 0.75 + opposite.y * 0.25 + normal.y * scale * 0.25;
              origin.z = vertex.z * 0.75 + opposite.z * 0.25 + normal.z * scale * 0.25;
              
              if (light.position) {
                end.x = light.position.x;
                end.y = light.position.y;
                end.z = light.position.z;
              }
              else {
                end.x = light.direction.x * 10000;
                end.y = light.direction.y * 10000;
                end.z = light.direction.z * 10000;                
              }

              direction.x = end.x - origin.x;
              direction.y = end.y - origin.y;
              direction.z = end.z - origin.z;
                
              length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
              direction.x /= length;
              direction.y /= length;
              direction.z /= length;

              let dot = direction.x*normal.x + direction.y*normal.y + direction.z*normal.z;
              if (dot > 0) {
                // Light comes from the front
                
                if (!light.castShadow || !voxel.material.receiveShadow || !octree._hitsOctree(origin, direction, length, end, face)) {
                  cachedLight.r += light.color.r * exposure;
                  cachedLight.g += light.color.g * exposure;
                  cachedLight.b += light.color.b * exposure;
                }
              }
            } 
            else {
              cachedLight.r += light.color.r * exposure;
              cachedLight.g += light.color.g * exposure;
              cachedLight.b += light.color.b * exposure;
            }            
          }, this);
        }
      }
    }, this, true);  // true == visible voxels only 
    
    for (const cacheKey in cache) {
      let cachedLight = cache[cacheKey];
      cachedLight.r /= cachedLight.c;
      cachedLight.g /= cachedLight.c;      
      cachedLight.b /= cachedLight.c;      
    }
  }  
  
  static addLightsAtVoxel(model, lights, light) {
    let colorId    = light.atVoxel;
    let color      = light.color;
    let intensity  = light.intensity;
    let distance   = light.distance * (model.scale.x + model.scale.y + model.scale.z)/3;
    let size       = light.size * (model.scale.x + model.scale.y + model.scale.z)/3;
    let detail     = light.detail;
    let castShadow = light.castShadow;
    let data       = light.data;
    
    model.voxels.forEach(function(voxel) {
      if (voxel.color.id == colorId) {
        let light = { colorId, color, intensity, distance, size, detail, castShadow, data };
        if (this.determineLightPositionAtVoxelCenter(voxel, light))
          lights.push(light);
      }
    }, this);
  }
                         
  static determineLightPositionAtVoxelCenter(voxel, light) {
    let x = 0;
    let y = 0;
    let z = 0;
    let count = 0;
    for (let faceName in voxel.faces) {
      let face = voxel.faces[faceName];      

      for (let v = 0; v<4; v++) {  
        let vertex = face.vertices[v];
        x += vertex.x;
        y += vertex.y;
        z += vertex.z;
        count++;
      }
    }
    if (count > 0) {
      light.position = { x:x/count, y:y/count, z:z/count };
      return true;
    }
    else
      return false;
  }
}

// =====================================================
// ../smoothvoxels/meshgenerator/quickaocalculator.js
// =====================================================

class QuickAOCalculator {
  
  static calculateQuickAmbientOcclusion(model) {
    let doAo = model.quickAo || model.materials.find(function(m) { return m.quickAo; } );
    if (!doAo) 
      return;
  
    model.voxels.forEach(function calculateAO(voxel) {
      let quickAo = voxel.material.quickAo || (voxel.material.lights ? model.quickAo : undefined );
      if (voxel.material.ao || !quickAo || quickAo.intensity === 0)
        return;

      let groupId = voxel.group.id;
      let intensity = quickAo.intensity;

      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        if (face.hidden)
          continue;

        let neighbors   = SVOX._AONEIGHBORS[faceName];
        let top         = this._isObstructed(model, groupId, neighbors.top.faces,         voxel.x+neighbors.top.x,         voxel.y+neighbors.top.y,         voxel.z+neighbors.top.z);
        let topRight    = this._isObstructed(model, groupId, neighbors.topRight.faces,    voxel.x+neighbors.topRight.x,    voxel.y+neighbors.topRight.y,    voxel.z+neighbors.topRight.z);
        let right       = this._isObstructed(model, groupId, neighbors.right.faces,       voxel.x+neighbors.right.x,       voxel.y+neighbors.right.y,       voxel.z+neighbors.right.z);
        let bottomRight = this._isObstructed(model, groupId, neighbors.bottomRight.faces, voxel.x+neighbors.bottomRight.x, voxel.y+neighbors.bottomRight.y, voxel.z+neighbors.bottomRight.z);
        let bottom      = this._isObstructed(model, groupId, neighbors.bottom.faces,      voxel.x+neighbors.bottom.x,      voxel.y+neighbors.bottom.y,      voxel.z+neighbors.bottom.z);
        let bottomLeft  = this._isObstructed(model, groupId, neighbors.bottomLeft.faces,  voxel.x+neighbors.bottomLeft.x,  voxel.y+neighbors.bottomLeft.y,  voxel.z+neighbors.bottomLeft.z);
        let left        = this._isObstructed(model, groupId, neighbors.left.faces,        voxel.x+neighbors.left.x,        voxel.y+neighbors.left.y,        voxel.z+neighbors.left.z);
        let topLeft     = this._isObstructed(model, groupId, neighbors.topLeft.faces,     voxel.x+neighbors.topLeft.x,     voxel.y+neighbors.topLeft.y,     voxel.z+neighbors.topLeft.z);
        
        let ao0 = 1 - Math.min(1, bottom + left  + bottomLeft ) * 0.45;  // 0.45 to get similar results as normal ao
        let ao1 = 1 - Math.min(1, top    + left  + topLeft    ) * 0.45;
        let ao2 = 1 - Math.min(1, top    + right + topRight   ) * 0.45;
        let ao3 = 1 - Math.min(1, bottom + right + bottomRight) * 0.45;
        face.ao[0] = 1 - Math.pow(ao0, intensity);
        face.ao[1] = 1 - Math.pow(ao1, intensity);
        face.ao[2] = 1 - Math.pow(ao2, intensity);
        face.ao[3] = 1 - Math.pow(ao3, intensity);
      }
    }, this, true);  // true == visible voxels only 
  }
  
  static _isObstructed(model, groupId, faces, x,y,z) {
    if (model.aoSides) {
      let bounds = model.voxels.bounds;
      if (x < bounds.minX   && model.aoSides.nx) return 1;
      if (x > bounds.maxX-1 && model.aoSides.px) return 1;
      if (y < bounds.minY   && model.aoSides.ny) return 1;
      if (y > bounds.maxY-1 && model.aoSides.py) return 1;
      if (z < bounds.minZ   && model.aoSides.nz) return 1;
      if (z > bounds.maxZ-1 && model.aoSides.pz) return 1;
    }
    
    let voxel = model.voxels.getVoxel(x, y, z, groupId);
    let value = 0;
    if (voxel) {
      let face0 = voxel.faces[faces[0]];
      if (face0 && !face0.hidden) value += 1;
      let face1 = faces[1] ? voxel.faces[faces[1]] : null;
      if (face1 && !face1.hidden) value += 1;
      value /= faces.length;
    }
    return value;
  }
}

// =====================================================
// ../smoothvoxels/meshgenerator/colorcombiner.js
// =====================================================

class ColorCombiner {
  
  static combineColors(model) {
    // No need to fade colors when there is no material with fade
    let fade = model.materials.find(m => m.colors.length > 1 && m.fade) ? true : false;
    
    model.voxels.forEach(function combine(voxel) {
      let fadeVoxel = (fade && voxel.material.fade && voxel.material.colors.length > 1);

      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        if (face) {
          
          if (!fadeVoxel) {
            // No fading, so no per vertex colors
            delete face.vertexColors;
          }
          else {
            // Fade the colors
            if (SVOX.colorManagement) {
              this._fadeFaceColorsManaged(voxel, face);
            }
            else {
              this._fadeFaceColors(voxel, face);
            }
          }   
          
          // Combine AO + Lights + Face color(s)
          this._combineFaceColors(model, voxel, face);                   
        }  
      }
    }, this, true);
  }
  
  static _fadeFaceColorsManaged(voxel, face) {
    // See: https://www.youtube.com/watch?v=LKnqECcg6Gw&t=247s
    face.vertexColors = [ null, null, null, null ];
    for (let v = 0; v < 4; v++) {
      let vert = face.vertices[v];
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;    

      for (let c = 0; c < vert.colors.length; c++) {
        let col = vert.colors[c];
        if (col.material === voxel.material) {
          r += col.r * col.r; 
          g += col.g * col.g; 
          b += col.b * col.b; 
          count++;
        }
      }

      face.vertexColors[v] = Color.fromRgb(Math.sqrt(r / count), Math.sqrt(g / count), Math.sqrt(b / count));
    }    
  }
       
  static _fadeFaceColors(voxel, face) {
    face.vertexColors = [ null, null, null, null ];
    for (let v = 0; v < 4; v++) {
      let vert = face.vertices[v];
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;    

      for (let c = 0; c < vert.colors.length; c++) {
        let col = vert.colors[c];
        if (col.material === voxel.material) {
          r += col.r; 
          g += col.g; 
          b += col.b; 
          count++;
        }
      }

      face.vertexColors[v] = Color.fromRgb(r / count, g / count, b / count);
    }    
  }
  
  static _combineFaceColors(model, voxel, face) {
    if (voxel.material.colorCount === 1 && !voxel.material.ao && !model.ao && !voxel.material.quickAo && !model.quickAo && model.lights.length === 0) {
      // Color is set in the material
    }
    else if (voxel.material.colorCount > 1 && !voxel.material.ao && !model.ao && !voxel.material.quickAo && !model.quickAo && model.lights.length === 0 && !face.vertexColors) {
        // Face colors
        face.color  = voxel.color;
    }
    else {

      // The combined result is stored in the vertexColors
      face.vertexColors = face.vertexColors || [ voxel.color.clone(), voxel.color.clone(), voxel.color.clone(), voxel.color.clone() ];      

      let colors = face.vertexColors;
      let light = face.light || [ {r:1, g:1, b:1}, {r:1, g:1, b:1}, {r:1, g:1, b:1}, {r:1, g:1, b:1} ];
      let ao = face.ao;

      // Calculate the vertex colors including Ambient Occlusion (when used)
      for (let v = 0; v < 4; v++) {
        let vColor = colors[v];
        let vLight = light[v];
        let vAo = ao[v];
        let vAoColor = (voxel.material.quickAo || voxel.material.ao || model.quickAo || model.ao)?.color || vColor;

        vColor.r = vLight.r * (1 - vAo) * vColor.r + vAoColor.r * vAo; 
        vColor.g = vLight.g * (1 - vAo) * vColor.g + vAoColor.g * vAo; 
        vColor.b = vLight.b * (1 - vAo) * vColor.b + vAoColor.b * vAo; 
      }      
    }    
  }
  
}

// =====================================================
// ../smoothvoxels/meshgenerator/uvassigner.js
// =====================================================

class UVAssigner {
  
  static assignUVs(model) {
    
    let size         = { x:0, y:0 };
    let mapTransform = { x:0, y:0 };

    model.voxels.forEach(function(voxel) {

      // We're always calculating UV's since even when the voxel does not use them, the shell might need them        
      let cube = false;
      let uscale = 1;
      let vscale = 1;
      let offsetU = 0;
      let offsetV = 0;
      let bounds = voxel.group.bounds;
      let boundsSize = Math.max(voxel.group.bounds.size.x, voxel.group.bounds.size.y, voxel.group.bounds.size.z)-1;

      let material = voxel.material.settings;
      
      if (!cube && material.mapTransform && material.mapTransform.uscale !== -1) {
        mapTransform.uscale = material.mapTransform.uscale;
        mapTransform.vscale = material.mapTransform.vscale;
      }
      else {
        mapTransform.uscale = 1;
        mapTransform.vscale = 1;
      }
      
      let mapId = material.map || material.normalMap || material.roughnessMap || material.metalnessMap ||  
                  material.displacementMap || material.alphaMap || material.emissiveMap ||  
                  material.thicknessMap || material.transmissionMap || material.specularColorMap || material.specularIntensityMap ||
                  material.specularMap || material.clearcoatMap || material.clearcoatNormalMap || material.clearcoatRoughnessMap;
      
      if (mapId) {
        let texture = model.textures.getById(mapId);
        let borderOffset = texture?.borderOffset ?? 0.5;
        if (texture?.size) {
          size.x = texture.size.x;
          size.y = texture.size.y;
        }
        else {
          size.x = 1024;
          size.y = 1024;
        }
        offsetU = 1 / size.x * borderOffset * mapTransform.uscale;  // Pixel offset to prevent bleeding
        offsetV = 1 / size.y * borderOffset * mapTransform.vscale;  

        if ((material.map && model.textures.getById(material.map).cube) || 
            (material.normalMap && model.textures.getById(material.normalMap).cube) ||
            (material.roughnessMap && model.textures.getById(material.roughnessMap).cube) ||
            (material.metalnessMap && model.textures.getById(material.metalnessMap).cube) ||
            (material.displacementMap && model.textures.getById(material.displacementMap).cube) ||
            (material.alphaMap && model.textures.getById(material.alphaMap).cube) ||
            (material.emissiveMap && model.textures.getById(material.emissiveMap).cube) ||
            (material.thicknessMap && model.textures.getById(material.thicknessMap).cube) || 
            (material.transmissionMap && model.textures.getById(material.transmissionMap).cube) ||
            (material.specularColorMap && model.textures.getById(material.specularColorMap).cube) ||
            (material.specularIntensityMap && model.textures.getById(material.specularIntensityMap).cube) ||
            (material.specularMap && model.textures.getById(material.specularMap).cube) ||
            (material.clearcoatMap && model.textures.getById(material.clearcoatMap).cube) || 
            (material.clearcoatNormalMap && model.textures.getById(material.clearcoatNormalMap).cube) || 
            (material.clearcoatRoughnessMap && model.textures.getById(material.clearcoatRoughnessMap).cube)) {
          cube = true;
          uscale = 1 / 4 / boundsSize;  // The cube texture is 4 x 2
          vscale = 1 / 2 / boundsSize;
          offsetU = 4 / size.x * borderOffset * boundsSize;  // Pixel offset to prevent bleeding
          offsetV = 2 / size.y * borderOffset * boundsSize;  
        }
      }

      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];

        let uvDefs = SVOX._FACEUVDEFS[faceName];
        face.uv = [];
        
        let u = voxel[uvDefs.udir] - bounds[uvDefs.uminbound];
        let v = voxel[uvDefs.vdir] - bounds[uvDefs.vminbound];

        // At the edges of planes of adjacent voxels with the same material, add a slight offset to prevent pixel bleed from texture wrap around / the next tile in a texture atlas
        let offsetTop    = this.adjacentVoxelIsDifferentMaterial(model, voxel, uvDefs.top   ) ? offsetV : 0;
        let offsetRight  = this.adjacentVoxelIsDifferentMaterial(model, voxel, uvDefs.right ) ? offsetU : 0;
        let offsetBottom = this.adjacentVoxelIsDifferentMaterial(model, voxel, uvDefs.bottom) ? offsetV : 0;
        let offsetLeft   = this.adjacentVoxelIsDifferentMaterial(model, voxel, uvDefs.left  ) ? offsetU : 0;

        let uLeft   = (cube ? uvDefs.cubeu : 0) + (u + offsetLeft     ) * uscale * uvDefs.usign;
        let uRight  = (cube ? uvDefs.cubeu : 0) + (u - offsetRight + 1) * uscale * uvDefs.usign;
        let vTop    = (cube ? uvDefs.cubev : 0) + (v - offsetTop   + 1) * vscale * uvDefs.vsign;
        let vBottom = (cube ? uvDefs.cubev : 0) + (v + offsetBottom   ) * vscale * uvDefs.vsign;
 
        if (!cube) {
          if (uLeft + uRight < 0) {
            uLeft  = -uLeft;
            uRight = -uRight;
          }
          if (vTop + vBottom < 0) {
            vTop    = -vTop;
            vBottom = -vBottom;
          }
        } 
        
        face.uv[uvDefs.order[0]] = { u:uLeft,  v:vBottom }; 
        face.uv[uvDefs.order[1]] = { u:uLeft,  v:vTop    }; 
        face.uv[uvDefs.order[2]] = { u:uRight, v:vTop    }; 
        face.uv[uvDefs.order[3]] = { u:uRight, v:vBottom };
      }
    }, this, true);  
  }
  
  static adjacentVoxelIsDifferentMaterial(model, voxel, adjacent) {
    let adjacentVoxel = model.voxels.getVoxel(voxel.x+adjacent.x, voxel.y+adjacent.y, voxel.z+adjacent.z, voxel.group.id);
    return adjacentVoxel?.material.baseId !== voxel.material.baseId;
  }
}

// =====================================================
// ../smoothvoxels/meshgenerator/simplifier.js
// =====================================================

class Simplifier {
  
  // Combine all faces which are coplanar, have the same normals, colors, etc.
  static simplify(model) {
    // Only simplify within the same group
    model.groups.forEach(function(group) {
      
      let simplify = model.simplify || model.materials.find(function(m) { return m.simplify; } );

      if (!simplify) 
        return;

      let context1 = { model };
      let context2 = { model };
      let context3 = { model };
      let context4 = { model };

      let clearContexts = function() {
        context1.lastVoxel = null;
        context2.lastVoxel = null;
        context3.lastVoxel = null;
        context4.lastVoxel = null;      
      }

      // Combine nx, px, nz and pz faces vertical up
      for (let x = model.voxels.minX; x <= model.voxels.maxX; x++) {
        for (let z = model.voxels.minZ; z <= model.voxels.maxZ; z++) {
          for (let y = model.voxels.minY; y <= model.voxels.maxY; y++) {
            let voxel = model.voxels.getVoxel(x,y,z, group.id); 
            if (voxel) {
              this._mergeFaces(context1, voxel, 'x', 'z', 'y', 'nx', 0, 1, 2, 3);
              this._mergeFaces(context2, voxel, 'x', 'z', 'y', 'px', 0, 1, 2, 3);
              this._mergeFaces(context3, voxel, 'x', 'z', 'y', 'nz', 0, 1, 2, 3);
              this._mergeFaces(context4, voxel, 'x', 'z', 'y', 'pz', 0, 1, 2, 3);
            }
            else
               clearContexts();
          }
        }
      }

      // Combine nx, px, ny and py faces from back to front
      clearContexts();
      for (let x = model.voxels.minX; x <= model.voxels.maxX; x++) {
        for (let y = model.voxels.minY; y <= model.voxels.maxY; y++) {
          for (let z = model.voxels.minZ; z <= model.voxels.maxZ; z++) {
            let voxel = model.voxels.getVoxel(x,y,z, group.id); 
            if (voxel) {
              this._mergeFaces(context1, voxel, 'x', 'y', 'z', 'nx', 1, 2, 3, 0);
              this._mergeFaces(context2, voxel, 'x', 'y', 'z', 'px', 3, 0, 1, 2);
              this._mergeFaces(context3, voxel, 'x', 'y', 'z', 'ny', 0, 1, 2, 3);
              this._mergeFaces(context4, voxel, 'x', 'y', 'z', 'py', 2, 3, 0, 1);
            }
            else
              clearContexts();
          }
        }
      }

      // Combine ny, py, nz and pz faces from left to right
      clearContexts();
      for (let y = model.voxels.minY; y <= model.voxels.maxY; y++) {
        for (let z = model.voxels.minZ; z <= model.voxels.maxZ; z++) {
          for (let x = model.voxels.minX; x <= model.voxels.maxX; x++) {
            let voxel = model.voxels.getVoxel(x,y,z, group.id); 
            if (voxel) {
              this._mergeFaces(context1, voxel, 'y', 'z', 'x', 'ny', 1, 2, 3, 0);
              this._mergeFaces(context2, voxel, 'y', 'z', 'x', 'py', 1, 2, 3, 0);
              this._mergeFaces(context3, voxel, 'y', 'z', 'x', 'nz', 3, 0, 1, 2);
              this._mergeFaces(context4, voxel, 'y', 'z', 'x', 'pz', 1, 2, 3, 0);
            }
            else
              clearContexts();
          }
        }
      }
    }, this);
  }
  
  // axis 3 is the movement direction
  // v1, v2 of the last face are candidates for removal
  static _mergeFaces(context, voxel, axis1, axis2, axis3, faceName, v0, v1, v2, v3) {
    let face = null;
    if (voxel)
      face = voxel.faces[faceName];

    if (voxel && context.lastVoxel && 
        (voxel.material.simplify === true || (voxel.material.simplify === undefined && context.model.simplify === true)) && 
        face && context.lastFace &&
        voxel.color === context.lastVoxel.color &&
        voxel[axis1] === context.lastVoxel[axis1] &&
        voxel[axis2] === context.lastVoxel[axis2]) {
        
        let faceNormals = face.normals;
        let lastFaceNormals = context.lastFace.normals;
        let faceVertexColors = face.vertexColors;
        let lastFaceVertexColors = context.lastFace.vertexColors;
        let faceVertices = face.vertices;
        let lastFaceVertices = context.lastFace.vertices;
        let faceAo = face.ao; 
        let lastFaceAo = context.lastFace.ao; 
      
        // Calculate the ratio between the face length and the total face length (in case they are combined)
        let faceLength = Math.sqrt(
                          (faceVertices[v1].x - faceVertices[v0].x) * (faceVertices[v1].x - faceVertices[v0].x) +
                          (faceVertices[v1].y - faceVertices[v0].y) * (faceVertices[v1].y - faceVertices[v0].y) +
                          (faceVertices[v1].z - faceVertices[v0].z) * (faceVertices[v1].z - faceVertices[v0].z)
                        );
        let totalLength = Math.sqrt(
                          (faceVertices[v1].x - lastFaceVertices[v0].x) * (faceVertices[v1].x - lastFaceVertices[v0].x) +
                          (faceVertices[v1].y - lastFaceVertices[v0].y) * (faceVertices[v1].y - lastFaceVertices[v0].y) +
                          (faceVertices[v1].z - lastFaceVertices[v0].z) * (faceVertices[v1].z - lastFaceVertices[v0].z)
                        ); 
        let ratio = faceLength / totalLength;
      
        if ((voxel.material.type === SVOX.MATBASIC ||  // In case of basic material, ignore the normals
            (this._normalEquals(faceNormals[0], lastFaceNormals[0])  && 
             this._normalEquals(faceNormals[1], lastFaceNormals[1])  && 
             this._normalEquals(faceNormals[2], lastFaceNormals[2])  && 
             this._normalEquals(faceNormals[3], lastFaceNormals[3]))) &&
            ( 
              (!faceVertexColors && !lastFaceVertexColors) || (
                this._colorEquals(faceVertexColors[0], lastFaceVertexColors[0]) &&
                this._colorEquals(faceVertexColors[1], lastFaceVertexColors[1]) &&
                this._colorEquals(faceVertexColors[2], lastFaceVertexColors[2]) &&
                this._colorEquals(faceVertexColors[3], lastFaceVertexColors[3]) 
              )
            ) && 
            faceAo[0] === lastFaceAo[0] &&
            faceAo[1] === lastFaceAo[1] &&
            faceAo[2] === lastFaceAo[2] &&
            faceAo[3] === lastFaceAo[3] &&
            
            (false || (
              Math.abs(lastFaceVertices[v1][axis1] - (1-ratio) * faceVertices[v1][axis1] - ratio * lastFaceVertices[v0][axis1]) <= Number.EPSILON * 10 &&
              Math.abs(lastFaceVertices[v1][axis2] - (1-ratio) * faceVertices[v1][axis2] - ratio * lastFaceVertices[v0][axis2]) <= Number.EPSILON * 10 &&
              Math.abs(lastFaceVertices[v1][axis3] - (1-ratio) * faceVertices[v1][axis3] - ratio * lastFaceVertices[v0][axis3]) <= Number.EPSILON * 10 &&
              Math.abs(lastFaceVertices[v2][axis1] - (1-ratio) * faceVertices[v2][axis1] - ratio * lastFaceVertices[v3][axis1]) <= Number.EPSILON * 10 &&
              Math.abs(lastFaceVertices[v2][axis2] - (1-ratio) * faceVertices[v2][axis2] - ratio * lastFaceVertices[v3][axis2]) <= Number.EPSILON * 10 &&
              Math.abs(lastFaceVertices[v2][axis3] - (1-ratio) * faceVertices[v2][axis3] - ratio * lastFaceVertices[v3][axis3]) <= Number.EPSILON * 10 ))
           ) 
        {
          // Everything checks out, so add this face to the last one
          //console.log(`MERGE: ${this._faceVerticesToString(lastFaceVertices)}`);
          //console.log(`  AND: ${this._faceVerticesToString(faceVertices)}`);
          lastFaceVertices[v1] = faceVertices[v1];
          lastFaceVertices[v2] = faceVertices[v2];          
          //console.log(`   TO: ${this._faceVerticesToString(lastFaceVertices)}`);
          
          context.lastFace.uv[v1] = face.uv[v1];
          context.lastFace.uv[v2] = face.uv[v2];
          
          context.lastFace.flatNormals[v1] = face.flatNormals[v1];
          context.lastFace.flatNormals[v2] = face.flatNormals[v2];
          context.lastFace.smoothNormals[v1] = face.smoothNormals[v1];
          context.lastFace.smoothNormals[v2] = face.smoothNormals[v2];
          context.lastFace.bothNormals[v1] = face.bothNormals[v1];
          context.lastFace.bothNormals[v2] = face.bothNormals[v2];
          
          // And remove this face
          delete voxel.faces[faceName];
          return;
        }
    }

    context.lastVoxel = voxel;
    context.lastFace = face;
  }
  
  
  static _normalEquals(vector1, vector2) {
    return Math.abs(vector1.x - vector2.x) < 0.01 && // Allow for minimal differences
           Math.abs(vector1.y - vector2.y) < 0.01 && 
           Math.abs(vector1.z - vector2.z) < 0.01;
  }
  
  static _colorEquals(color1, color2) {
    return color1.r === color2.r &&
           color1.g === color2.g &&
           color1.b === color2.b;
  }  
  
  static _faceVerticesToString(vertices) {
    return `[`+
           `${this._vertexToString(vertices[0],0)},` +
           `${this._vertexToString(vertices[1],0)},` +
           `${this._vertexToString(vertices[2],0)},` +
           `${this._vertexToString(vertices[3],0)}` +
           `]`;
  }
  
  static _vertexToString(vertex, decimals) {
    return `{${vertex.x.toFixed(decimals)},${vertex.y.toFixed(decimals)},${vertex.z.toFixed(decimals)}}`;
  }
    
}

// =====================================================
// ../smoothvoxels/meshgenerator/facealigner.js
// =====================================================

class FaceAligner {
     
  // Align all 'quad' diagonals to the center, making most models look more symmetrical
  static alignFaceDiagonals(model) {
    
    model.vertices.forEach(function(vertex) { 
      vertex.count = 0;
    }, this);
    
    let maxDist = 0.1 * Math.min(model.scale.x, model.scale.y, model.scale.z);
    maxDist *= maxDist; // No need to use sqrt for the distances
    
    model.voxels.forEach(function(voxel) {
      for (let faceName in voxel.faces) {
        let face = voxel.faces[faceName];
        if (face.hidden)
          continue;

        face.vertices[0].count++; 
        face.vertices[1].count++; 
        face.vertices[2].count++; 
        face.vertices[3].count++; 

        // Determine the diagonal for v0 - v2 mid point and the distances from v1 and v3 to that mid point 
        let mid02X = (face.vertices[0].x + face.vertices[2].x)/2;
        let mid02Y = (face.vertices[0].y + face.vertices[2].y)/2;
        let mid02Z = (face.vertices[0].z + face.vertices[2].z)/2;
        let distance1toMid = (face.vertices[1].x - mid02X) * (face.vertices[1].x - mid02X) + 
                             (face.vertices[1].y - mid02Y) * (face.vertices[1].y - mid02Y) + 
                             (face.vertices[1].z - mid02Z) * (face.vertices[1].z - mid02Z); 
        let distance3toMid = (face.vertices[3].x - mid02X) * (face.vertices[3].x - mid02X) + 
                             (face.vertices[3].y - mid02Y) * (face.vertices[3].y - mid02Y) + 
                             (face.vertices[3].z - mid02Z) * (face.vertices[3].z - mid02Z); 

        // Determine the diagonal for v1 - v3 mid point and the distances from v0 and v2 to that mid point 
        let mid13X = (face.vertices[1].x + face.vertices[3].x)/2;
        let mid13Y = (face.vertices[1].y + face.vertices[3].y)/2;
        let mid13Z = (face.vertices[1].z + face.vertices[3].z)/2;
        let distance0toMid = (face.vertices[0].x - mid13X) * (face.vertices[0].x - mid13X) + 
                             (face.vertices[0].y - mid13Y) * (face.vertices[0].y - mid13Y) + 
                             (face.vertices[0].z - mid13Z) * (face.vertices[0].z - mid13Z); 
        let distance2toMid = (face.vertices[2].x - mid13X) * (face.vertices[2].x - mid13X) + 
                             (face.vertices[2].y - mid13Y) * (face.vertices[2].y - mid13Y) + 
                             (face.vertices[2].z - mid13Z) * (face.vertices[2].z - mid13Z); 

        // NOTE: The check below is not an actual check for concave quads but 
        // checks whether one of the vertices is close to the midpoint of te other diagonal.
        // This can happen in certain cases when deforming, when the vertex itself is not moved, 
        // but two vertices it is dependant on are moved in the 'wrong' direction, resulting 
        // in a concave quad. Since deforming should not make the quad very badly concave
        // this seems enough to prevent ugly artefacts in these edge cases.

        if (distance1toMid < maxDist || distance3toMid < maxDist) {
          // If v1 or v3 is close to the mid point we may have a rare concave quad.
          // Switch the default triangles so this does not show up
          face.vertices.push(face.vertices.shift());
          face.flatNormals.push(face.flatNormals.shift());
          face.smoothNormals.push(face.smoothNormals.shift());
          face.bothNormals.push(face.bothNormals.shift());
          face.ao.push(face.ao.shift());
          face.uv.push(face.uv.shift());
          if (face.vertexColors)
              face.vertexColors.push(face.vertexColors.shift());
        } 
        else if (distance0toMid < maxDist || distance2toMid < maxDist) {
          // If v0 or v2 is close to the mid point we may have a rare concave quad.
          // Keep the default triangles so this does not show up.
        }
        else if (face.ao && 
                 Math.min(face.ao[0], face.ao[1], face.ao[2], face.ao[3]) !==
                 Math.max(face.ao[0], face.ao[1], face.ao[2], face.ao[3])) {
          // This is a 'standard' quad but with an ao gradient 
          // Rotate the vertices so they connect the highest contrast 
          let ao02 = Math.abs(face.ao[0] - face.ao[2]);
          let ao13 = Math.abs(face.ao[1] - face.ao[3]);
          if (ao02 < ao13) {
            face.vertices.push(face.vertices.shift());
            face.flatNormals.push(face.flatNormals.shift());
            face.smoothNormals.push(face.smoothNormals.shift());
            face.bothNormals.push(face.bothNormals.shift());
            face.ao.push(face.ao.shift());
            face.uv.push(face.uv.shift());
            if (face.vertexColors)
              face.vertexColors.push(face.vertexColors.shift());
          }                        
        }
        else {
          // This is a 'standard' quad, relatively flat. 
          // Rotate the vertices so they align to the center
          // For axis aligned symmetric models this improves the end result
          let min = this._getVertexSum(face.vertices[0]);
          while (this._getVertexSum(face.vertices[1]) < min || 
                 this._getVertexSum(face.vertices[2]) < min || 
                 this._getVertexSum(face.vertices[3]) < min) {
            face.vertices.push(face.vertices.shift());
            face.flatNormals.push(face.flatNormals.shift());
            face.smoothNormals.push(face.smoothNormals.shift());
            face.bothNormals.push(face.bothNormals.shift());
            face.ao.push(face.ao.shift());
            face.uv.push(face.uv.shift());              
            if (face.vertexColors)
              face.vertexColors.push(face.vertexColors.shift());
            min = this._getVertexSum(face.vertices[0]);
          }            
        }
      
      }
    }, this, true);
  }
  
  static _getVertexSum(vertex) {
    //let center = vertex.group.vertexCenter;
    let center = vertex.group.originOffset;
    return Math.abs(vertex.x-center.x) + Math.abs(vertex.y-center.y) + Math.abs(vertex.z-center.z);
  }  
   
}

// =====================================================
// ../smoothvoxels/meshgenerator/meshgenerator.js
// =====================================================

// Generates a clean js mesh data model, which serves as the basis for transformation in the SvoxToThreeMeshConverter or the SvoxToAFrameConverter
class SvoxMeshGenerator {

  static generate(model) {
  
    let mesh = {
      materials: [],
      groups: [],
      indices: [],
      positions: [],
      normals: [],
      colors: [],
      uvs: null,
      data: null
    };

    model.prepareForWrite(false);

    let generateUVs = false;
    model.materials.baseMaterials.forEach(function(material) {
      generateUVs = generateUVs || material.hasMap;
    }, this);
    
    this.calculateAll(model, generateUVs);
    
    generateUVs = false;
    model.materials.baseMaterials.forEach(function(material) {
      if (material.colorUsageCount > 0) {
        material.index = mesh.materials.length;
        mesh.materials.push(SvoxMeshGenerator._generateMaterial(material.settings, model));
        generateUVs = generateUVs || material.hasMap;
      }
    }, this);

    if (generateUVs) {
      mesh.uvs = [];
    }
    
    if (model.data) {
      mesh.data = [];
      for (let d=0; d<model.data.length; d++) {
        mesh.data.push( { name: model.data[d].name,
                          width:model.data[d].values.length,
                          values: [] } );
      }
    }
    
    SvoxMeshGenerator._generateAll(model, mesh);
    
    SvoxMeshGenerator._generateLights(model, mesh);
    
    mesh = SvoxMeshGenerator._toIndexed(mesh);

    return mesh;
  }
      
  static calculateAll(model, generateUVs) {
    
    GroupCloner.cloneGroups(model);   
  
    FaceCreator.createAllFaces(model);
      
    let maximumDeformCount = Deformer.maximumDeformCount(model);

    // Only link the vertices when needed
    if (maximumDeformCount > 0) {

      VertexLinker.linkVertices(model.voxels); 
      
      //VertexLinker.logLinks(this.voxels);
    }
    
    model.determineBoundsForAllGroups();

    ShapeModifier.changeShape(model);
       
    Deformer.deform(model, maximumDeformCount);
    
    Deformer.warpAndScatter(model);
    
    NormalsCalculator.calculateNormals(model);   
    
    model.determineBoundsForAllGroups(true); // prepareForResize
    
    VertexTransformer.transformVertices(model); 
        
    model.determineBoundsForAllGroups();

    LightsCalculator.calculateLights(model);
    
    AOCalculator.calculateAmbientOcclusion(model);
    
    QuickAOCalculator.calculateQuickAmbientOcclusion(model);
    
    ColorCombiner.combineColors(model);

    if (generateUVs) {
      UVAssigner.assignUVs(model);
    }
    
    Simplifier.simplify(model);
    
    model.determineBoundsForAllGroups();

    //FaceAligner.alignFaceDiagonals(model);
    
    //logObjectStructure(model.voxels.getVoxel(0,0,0, '*'));
  }  
  
  static _toIndexed(mesh) {
    
    let hasColors = mesh.colors && mesh.colors.length > 0;
    let hasUvs    = mesh.uvs && mesh.uvs.length > 0;
    let hasData   = !!mesh.data;
    
    let vCount = this._determineIndices(mesh, hasColors, hasUvs, hasData);
    
    let newMesh = {
      materials: mesh.materials,
      groups: mesh.groups,
      indices: new Uint32Array(mesh.indices.length),
      positions: new Float32Array(vCount * 3),
      normals: new Float32Array(vCount * 3),
      colors: hasColors ? new Float32Array(vCount * 3) : null,
      uvs: hasUvs ? new Float32Array(vCount * 2) : null,
      data: hasData ? [] : null
    };
    
    if (mesh.data) {
      for (let d=0;d<mesh.data.length;d++) {
        let data = mesh.data[d];
        newMesh.data.push( {name:data.name, width:data.width, values:new Float32Array(vCount * data.width) } );
      }
    }

    let index = 0;
    for (let i=0; i < mesh.indices.length; i++) {
      newMesh.indices[i] = mesh.indices[i];
      if (mesh.indices[i] === index) {
        newMesh.positions[index*3+0] = mesh.positions[i*3+0];
        newMesh.positions[index*3+1] = mesh.positions[i*3+1];
        newMesh.positions[index*3+2] = mesh.positions[i*3+2];
        newMesh.normals[index*3+0] = mesh.normals[i*3+0];
        newMesh.normals[index*3+1] = mesh.normals[i*3+1];
        newMesh.normals[index*3+2] = mesh.normals[i*3+2];
        if (hasColors) {
          newMesh.colors[index*3+0] = mesh.colors[i*3+0];
          newMesh.colors[index*3+1] = mesh.colors[i*3+1];
          newMesh.colors[index*3+2] = mesh.colors[i*3+2];
        }
        if (hasUvs) {
          newMesh.uvs[index*2+0] = mesh.uvs[i*2+0];
          newMesh.uvs[index*2+1] = mesh.uvs[i*2+1];
        }
        if (hasData) {
          for (let d=0;d<mesh.data.length;d++) {
            let data = mesh.data[d];
            let newData = newMesh.data[d];
            for (let v=0; v<data.width; v++) {
              newData.values[index*data.width+v] = data.values[i*data.width+v];
            }
          }          
        }
        
        index++;
      }
    }
    
   // console.log(`Indexed Geometry: From ${mesh.positions.length / 3} verts to ${index+1}`);
    
    return newMesh;
  }
   
  static _determineIndices(mesh, hasColors, hasUvs, hasData) {
    let ids = {};
    let lastIndex = -1;
    let count = 0;

    let length = mesh.positions.length / 3;
    for (let i=0; i < length; i++) {
      let i2 = i*2;
      let i3 = i*3;
      let id = `${mesh.positions[i3]}|${mesh.positions[i3+1]}|${mesh.positions[i3+2]}|${mesh.normals[i3]}|${mesh.normals[i3+1]}|${mesh.normals[i3+2]}`;
      if (hasColors)
        id += `|${mesh.colors[i3]}|${mesh.colors[i3+1]}|${mesh.colors[i3+2]}`;
      if (hasUvs)
        id += `|${mesh.uvs[i2]}|${mesh.uvs[i2+1]}`;
      if (hasData) {
        for (let d=0;d<mesh.data.length;d++) {
          let data = mesh.data[d];
          for (let v=0; v<data.width; v++)
            id += `|${data.values[i*data.width+v]}`;
        }
      }
      let index = ids[id];
      if (index === undefined) {
        ids[id] = ++lastIndex;
        index = lastIndex; 
        count++;
      }
      mesh.indices[i] = index;
    }
    
    return count;
  }

  static _generateMaterial(definition, modeldefinition) { 
    
    // Oculus GO does not support structured clone
    let material;
    if (typeof structuredClone === 'function') {
      material = structuredClone(definition);
    }
    else {
      material = JSON.parse(JSON.stringify(definition));
    }    
    
    material.wireframe = material.wireframe ?? modeldefinition.wireframe;
    material.vertexColors = false;

    if (material.type !== SVOX.MATNORMAL) {
      // All materials except normal material support colors
      
      // TODO: When none of the materials needs VertexColors, we should just set the material colors instead of using vertex colors.
      //if (material.colorCount === 1 && !material.aoActive && !modeldefinition.ao && modeldefinition.lights.length === 0) {
      //  material.vertexColors = 'NoColors';
      //  material.color = definition.colors[0].toString();
      //}
      //else {
      //  material.vertexColors = 'VertexColors';
      //}
      material.vertexColors = true;
      material.color = this._createColor(Color.fromHex("#FFF"));
    }
        
    let textures = modeldefinition.textures;
    let modelSize = Math.max(modeldefinition.size.x, modeldefinition.size.y, modeldefinition.size.z)-1;
    
    for (const property in material) {
      let value = material[property];
      if (!material[property] || (value === undefined)) 
        continue;
      
      if (property === 'emissive' || property === 'specular' || property === 'specularColor' || property === 'attenuationColor') {
        material[property] = this._createColor(value);
      }
      else if (property === 'envMap' || property === 'matcap') {
        material[property] = this._createMap(material[property], null, textures, modelSize);
      }
      else if (property === 'map' || property.endsWith('Map')) {
        material[property] = this._createMap(material[property], material.mapTransform, textures, modelSize);
      }
    }
    
    delete material.mapTransform;
            
    return material;
  }
  
  static _createMap(imageName, mapTransform, textures, modelSize) {
    let texture = textures.getById(imageName);

    if (texture.cube) {
      return { image:    texture.image, 
               uscale:   1, 
               vscale:   1,
               uoffset:  0, 
               voffset:  0,
               rotation: 0 };    
    }
    else if (mapTransform) {
      return { image:    texture.image, 
               uscale:   mapTransform.uscale === -1 ? modelSize : mapTransform.uscale, 
               vscale:   mapTransform.vscale === -1 ? modelSize : mapTransform.vscale,
               uoffset:  mapTransform.uoffset, 
               voffset:  mapTransform.voffset,
               rotation: mapTransform.rotation };    
    }
    else {
      return { image: texture.image };
    }
  }
  
  static _generateLights(model, mesh) {
    if (model.lights.visible) {
      
      // The octahedron that will be subdivided depending on the light.detail
      let vTop      = { x: 0, y: 1, z: 0 };
      let vFront    = { x: 0, y: 0, z:-1 };
      let vRight    = { x: 1, y: 0, z: 0 };
      let vBack     = { x: 0, y: 0, z: 1 };
      let vLeft     = { x:-1, y: 0, z: 0 };
      let vBottom   = { x: 0, y:-1, z: 0 };

      let start = mesh.positions.length;
      model.actualLights.forEach(function(light) {
        let position = light.position;
        if (position && light.size > 0) {
          let scale = light.size / 2;
          let detail = light.detail;
          let data = light.data ?? model.data;
          
          // If color management convert to linear
          let lightColor = this._createColor(light.color);

          SvoxMeshGenerator._generateLightFace(light.position, lightColor, scale, detail, data, vFront, vRight,  vTop  , mesh);
          SvoxMeshGenerator._generateLightFace(light.position, lightColor, scale, detail, data, vRight, vBack,   vTop  , mesh);
          SvoxMeshGenerator._generateLightFace(light.position, lightColor, scale, detail, data, vBack,  vLeft,   vTop  , mesh);
          SvoxMeshGenerator._generateLightFace(light.position, lightColor, scale, detail, data, vLeft,  vFront,  vTop  , mesh);
          SvoxMeshGenerator._generateLightFace(light.position, lightColor, scale, detail, data, vFront, vBottom, vRight, mesh);
          SvoxMeshGenerator._generateLightFace(light.position, lightColor, scale, detail, data, vRight, vBottom, vBack , mesh);
          SvoxMeshGenerator._generateLightFace(light.position, lightColor, scale, detail, data, vBack,  vBottom, vLeft , mesh);
          SvoxMeshGenerator._generateLightFace(light.position, lightColor, scale, detail, data, vLeft,  vBottom, vFront, mesh);
        }
      }, this);
      let end = mesh.positions.length;
      
      // Add the group for the lights (it always uses the first material, so index 0)
      mesh.groups.push( { start: start/3, count: (end-start)/3, materialIndex: 0 } );           
    }
  }
  
  static _generateLightFace(position, color, scale, divisions, data, v0, v1, v2, mesh) {
    if (divisions === 0) {
      mesh.positions.push(position.x + v2.x * scale, position.y + v2.y * scale, position.z + v2.z * scale); 
      mesh.positions.push(position.x + v1.x * scale, position.y + v1.y * scale, position.z + v1.z * scale); 
      mesh.positions.push(position.x + v0.x * scale, position.y + v0.y * scale, position.z + v0.z * scale); 

      mesh.normals.push(0.0, 0.0, 1.0);
      mesh.normals.push(0.0, 0.0, 1.0);
      mesh.normals.push(0.0, 0.0, 1.0);

      mesh.colors.push(color.r, color.g, color.b);
      mesh.colors.push(color.r, color.g, color.b);
      mesh.colors.push(color.r, color.g, color.b);

      if (mesh.uvs) {
        mesh.uvs.push(0.0, 0.0);
        mesh.uvs.push(0.0, 0.0);
        mesh.uvs.push(0.0, 0.0);
      }   
      
      if (mesh.data) {
        for (let vertex=0;vertex<3;vertex++) {
          for (let d=0;d<data.length;d++) {
            for (let v=0;v<data[d].values.length;v++) {
              mesh.data[d].values.push(data[d].values[v]);
            }
          }
        }
      }
    }
    else {
      // Recursively subdivide untill we have the number of divisions we need
      let v10 = SvoxMeshGenerator._normalize( { x:(v1.x+v0.x)/2, y:(v1.y+v0.y)/2, z:(v1.z+v0.z)/2 } );  
      let v12 = SvoxMeshGenerator._normalize( { x:(v1.x+v2.x)/2, y:(v1.y+v2.y)/2, z:(v1.z+v2.z)/2 } );
      let v02 = SvoxMeshGenerator._normalize( { x:(v0.x+v2.x)/2, y:(v0.y+v2.y)/2, z:(v0.z+v2.z)/2 } );
      SvoxMeshGenerator._generateLightFace(position, color, scale, divisions-1, data, v10, v1,  v12, mesh);
      SvoxMeshGenerator._generateLightFace(position, color, scale, divisions-1, data, v0,  v10, v02, mesh);
      SvoxMeshGenerator._generateLightFace(position, color, scale, divisions-1, data, v02, v12, v2,  mesh);
      SvoxMeshGenerator._generateLightFace(position, color, scale, divisions-1, data, v10, v12, v02, mesh);
    }
  }
  
  static _generateAll(model, mesh) {
    let shells = SvoxMeshGenerator._getAllShells(model);

    // Add all vertices to the geometry     
    model.materials.baseMaterials.forEach(function(material) {
      if (material.colorUsageCount > 0) {

        let start = mesh.positions.length;

        model.voxels.forEach(function(voxel) {
                   
          if (voxel.material.index === material.index) {
            SvoxMeshGenerator._generateVoxel(model, voxel, mesh);
          }
          
          shells.forEach(function (shell) {
            if (shell.material.index === material.index &&
                shell.voxelMaterial === voxel.color.material) {
              
              // Note that the shell.color is already corrected for color management in _getAllShells()             
              SvoxMeshGenerator._generateVoxelShell(model, voxel, mesh, shell);
            }
          }, this);
          
        }, this, true);
        
        // Add the group for this material
        let end = mesh.positions.length;
        if (start !== end)
          mesh.groups.push( { start:start/3, count: (end-start)/3, materialIndex:material.index } );       
        
      }      
    }, this);       
  }

  static _generateVoxel(model, voxel, mesh) {
    for (let f = 0; f < SVOX._FACES.length; f++) {
      let face = voxel.faces[SVOX._FACES[f]];
      if (face && !face.hidden) {
        SvoxMeshGenerator._generateVoxelFace(model, voxel, face, mesh);
      }  
    }
  }

  static _generateVoxelFace(model, voxel, face, mesh) {
    let vert0, vert1, vert2, vert3;
    let norm0, norm1, norm2, norm3;
    let col0, col1, col2, col3;
    let uv0, uv1, uv2, uv3;
    let id = '';
    
    vert0 = face.vertices[0];
    vert1 = face.vertices[1];
    vert2 = face.vertices[2];
    vert3 = face.vertices[3];
        
    norm0 = face.normals[0];
    norm1 = face.normals[1];
    norm2 = face.normals[2];
    norm3 = face.normals[3];
    
    if (face.vertexColors) {
      col0 = this._createColor(face.vertexColors[0]);
      col1 = this._createColor(face.vertexColors[1]);
      col2 = this._createColor(face.vertexColors[2]);
      col3 = this._createColor(face.vertexColors[3]);
    }
    
    if (mesh.uvs) {
      uv0 = face.uv[0] ?? { u:0, v:0 };
      uv1 = face.uv[1] ?? { u:0, v:0 };
      uv2 = face.uv[2] ?? { u:0, v:0 };
      uv3 = face.uv[3] ?? { u:0, v:0 };
    }
        
    if (voxel.color.material.side === 'back') {
      let swap;
      swap = vert0; vert0 = vert2; vert2 = swap;
      swap = norm0; norm0 = norm2; norm2 = swap;
      swap =  col0;  col0 =  col2;  col2 = swap;
      swap =   uv0;   uv0 =   uv2;   uv2 = swap;
    }
        
    // Face 1
    mesh.positions.push(vert2.x, vert2.y, vert2.z); 
    mesh.positions.push(vert1.x, vert1.y, vert1.z); 
    mesh.positions.push(vert0.x, vert0.y, vert0.z); 
    
    // Face 2
    mesh.positions.push(vert0.x, vert0.y, vert0.z); 
    mesh.positions.push(vert3.x, vert3.y, vert3.z); 
    mesh.positions.push(vert2.x, vert2.y, vert2.z); 
    
    if (voxel.material.lighting === SVOX.SMOOTH || (voxel.material.lighting === SVOX.BOTH && face.smooth)) {
      // Face 1
      mesh.normals.push(norm2.x, norm2.y, norm2.z);
      mesh.normals.push(norm1.x, norm1.y, norm1.z);
      mesh.normals.push(norm0.x, norm0.y, norm0.z);

      // Face 2
      mesh.normals.push(norm0.x, norm0.y, norm0.z);
      mesh.normals.push(norm3.x, norm3.y, norm3.z);
      mesh.normals.push(norm2.x, norm2.y, norm2.z);
    }
    else {
      // Average the normals to get the flat normals
      let normFace1 = model._normalize({ x:norm2.x+norm1.x+norm0.x, y:norm2.y+norm1.y+norm0.y, z:norm2.z+norm1.z+norm0.z});
      let normFace2 = model._normalize({ x:norm0.x+norm3.x+norm2.x, y:norm0.y+norm3.y+norm2.y, z:norm0.z+norm3.z+norm2.z});
      if (voxel.material.lighting === SVOX.QUAD) {
        normFace1 = model._normalize({ x:normFace1.x+normFace2.x, y:normFace1.y+normFace2.y, z:normFace1.z+normFace2.z});
        normFace2 = normFace1;
      }
      
      // Face 1
      mesh.normals.push(normFace1.x, normFace1.y, normFace1.z);
      mesh.normals.push(normFace1.x, normFace1.y, normFace1.z);
      mesh.normals.push(normFace1.x, normFace1.y, normFace1.z);

      // Face 2
      mesh.normals.push(normFace2.x, normFace2.y, normFace2.z);
      mesh.normals.push(normFace2.x, normFace2.y, normFace2.z);
      mesh.normals.push(normFace2.x, normFace2.y, normFace2.z);
    }
    
    if (face.vertexColors) {     

      // TODO: move to prepare for render, now it is done multiple times
      if (SVOX.clampColors) {
        this._clampColor(col0);
        this._clampColor(col1);
        this._clampColor(col2);
        this._clampColor(col3);
      }
      
      // Face 1
      mesh.colors.push(col2.r, col2.g, col2.b); 
      mesh.colors.push(col1.r, col1.g, col1.b); 
      mesh.colors.push(col0.r, col0.g, col0.b); 

      // Face 2
      mesh.colors.push(col0.r, col0.g, col0.b); 
      mesh.colors.push(col3.r, col3.g, col3.b); 
      mesh.colors.push(col2.r, col2.g, col2.b); 
    }
    else {
      if (face.color) {
        col0 = this._createColor(face.color);
      }
      else {
        col0 = this._createColor(voxel.color);
      }
      
      for (let v=0; v<6; v++) {
        mesh.colors.push(col0.r, col0.g, col0.b);
      }
    }
      
    if (mesh.uvs) {
     
      // Face 1
      mesh.uvs.push(uv2.u, uv2.v);
      mesh.uvs.push(uv1.u, uv1.v);
      mesh.uvs.push(uv0.u, uv0.v);

      // Face 1
      mesh.uvs.push(uv0.u, uv0.v);
      mesh.uvs.push(uv3.u, uv3.v);
      mesh.uvs.push(uv2.u, uv2.v);
    }
    
    if (mesh.data) {
      let data = voxel.material.data ?? model.data;
      for (let vertex=0;vertex<6;vertex++) {
        for (let d=0;d<data.length;d++) {
          for (let v=0;v<data[d].values.length;v++) {
            mesh.data[d].values.push(data[d].values[v]);
          }
        }
      }
    }
  }
  
  static _clampColor(color) {
    //let max = Math.max(color.r, color.g, color.b);
    //if (max > 1) {
    //  color.r /= max;
    //  color.g /= max;
    //  color.b /= max;
    //}
    color.r = Math.max(color.r, 0);
    color.g = Math.max(color.g, 0);
    color.b = Math.max(color.b, 0);
    color.r = Math.min(color.r, 1);
    color.g = Math.min(color.g, 1);
    color.b = Math.min(color.b, 1);
  }
  
  static _getAllShells(model) {
   
    let shells = [];
    
    model.materials.forEach(function (material) {    
      
      let shell = undefined
      if (model.shell && model.shell.length > 0 && !material.shell)
        shell = model.shell;
      if (material.shell && material.shell.length > 0)
        shell = material.shell;
      
      if (shell) {
        shell.forEach(function (sh) {
          shells.push({
            material: sh.color.material,
            voxelMaterial: material,
            side: sh.color.material.side,
            color: this._createColor(sh.color),
            lighting: sh.color.material.lighting,
            distance: sh.distance
          });
        }, this);
      }
    }, this);
    
    shells.sort(function(a,b) {
      let v = a.material.index - b.material.index;
    });
    
    return shells;
  };
  
  static _generateVoxelShell(model, voxel, mesh, shell) {
    for (let f = 0; f < SVOX._FACES.length; f++) {
      let face = voxel.faces[SVOX._FACES[f]];
      if (face) {
        // Note that hidden faces DO generate shells!
        SvoxMeshGenerator._generateVoxelShellFace(model, voxel, face, mesh, shell);
      }  
    }
  }

  static _generateVoxelShellFace(model, voxel, face, mesh, shell) {
    let vert0, vert1, vert2, vert3;
    let shellDirection0, shellDirection1, shellDirection2, shellDirection3;
    let norm0, norm1, norm2, norm3;
    let uv0, uv1, uv2, uv3;
    
    vert0 = face.vertices[0];
    vert1 = face.vertices[1];
    vert2 = face.vertices[2];
    vert3 = face.vertices[3];
    
    shellDirection0 = vert0.smoothNormal; //shellDirection;
    shellDirection1 = vert1.smoothNormal; //shellDirection;
    shellDirection2 = vert2.smoothNormal; //shellDirection;
    shellDirection3 = vert3.smoothNormal; //shellDirection;

    // Now set the actual normals for this face
    let normals = null;
    switch (shell.lighting) {
      case SVOX.SMOOTH:
        normals = face.smoothNormals;
        break;
      case SVOX.BOTH:
        normals = face.bothNormals;
        break;
      default:
        normals = face.flatNormals;
        break;
    }    

    norm0 = normals[0];
    norm1 = normals[1];
    norm2 = normals[2];
    norm3 = normals[3];
    
    if (mesh.uvs) {
      uv0 = face.uv[0] ?? { u:0.0001, v:0.0001 };
      uv1 = face.uv[1] ?? { u:0.0001, v:0.9999 };
      uv2 = face.uv[2] ?? { u:0.9999, v:0.9999 };
      uv3 = face.uv[3] ?? { u:0.9999, v:0.0001 };
    }
        
    if (shell.side === 'back') {
      let swap;
      swap = vert0; vert0 = vert2; vert2 = swap;
      swap = norm0; norm0 = norm2; norm2 = swap;
      swap = shellDirection0; shellDirection0 = shellDirection2; shellDirection2 = swap;
      swap =   uv0;   uv0 =   uv2;   uv2 = swap;
    }
    
    // Push out the vertices according to the average normals
    let vert0x = vert0.x + shellDirection0.x * shell.distance * model.scale.x;
    let vert0y = vert0.y + shellDirection0.y * shell.distance * model.scale.y;
    let vert0z = vert0.z + shellDirection0.z * shell.distance * model.scale.z;
    let vert1x = vert1.x + shellDirection1.x * shell.distance * model.scale.x;  
    let vert1y = vert1.y + shellDirection1.y * shell.distance * model.scale.y;
    let vert1z = vert1.z + shellDirection1.z * shell.distance * model.scale.z;
    let vert2x = vert2.x + shellDirection2.x * shell.distance * model.scale.x;  
    let vert2y = vert2.y + shellDirection2.y * shell.distance * model.scale.y;
    let vert2z = vert2.z + shellDirection2.z * shell.distance * model.scale.z;
    let vert3x = vert3.x + shellDirection3.x * shell.distance * model.scale.x;  
    let vert3y = vert3.y + shellDirection3.y * shell.distance * model.scale.y;
    let vert3z = vert3.z + shellDirection3.z * shell.distance * model.scale.z;
            
    // Face 1
    mesh.positions.push(vert2x, vert2y, vert2z); 
    mesh.positions.push(vert1x, vert1y, vert1z); 
    mesh.positions.push(vert0x, vert0y, vert0z); 
    
    // Face 2
    mesh.positions.push(vert0x, vert0y, vert0z); 
    mesh.positions.push(vert3x, vert3y, vert3z); 
    mesh.positions.push(vert2x, vert2y, vert2z);  

    if (shell.lighting === SVOX.SMOOTH || (shell.lighting === SVOX.BOTH && face.smooth)) {
      // Face 1
      mesh.normals.push(norm2.x, norm2.y, norm2.z);
      mesh.normals.push(norm1.x, norm1.y, norm1.z);
      mesh.normals.push(norm0.x, norm0.y, norm0.z);

      // Face 2
      mesh.normals.push(norm0.x, norm0.y, norm0.z);
      mesh.normals.push(norm3.x, norm3.y, norm3.z);
      mesh.normals.push(norm2.x, norm2.y, norm2.z);
    }
    else {
      // Average the normals to get the flat normals
      let normFace1 = model._normalize({ x:norm2.x+norm1.x+norm0.x, y:norm2.y+norm1.y+norm0.y, z:norm2.z+norm1.z+norm0.z});
      let normFace2 = model._normalize({ x:norm0.x+norm3.x+norm2.x, y:norm0.y+norm3.y+norm2.y, z:norm0.z+norm3.z+norm2.z});
      if (voxel.material.lighting === SVOX.QUAD) {
        normFace1 = model._normalize({ x:normFace1.x+normFace2.x, y:normFace1.y+normFace2.y, z:normFace1.z+normFace2.z});
        normFace2 = normFace1;
      }
      
      // Face 1
      mesh.normals.push(normFace1.x, normFace1.y, normFace1.z);
      mesh.normals.push(normFace1.x, normFace1.y, normFace1.z);
      mesh.normals.push(normFace1.x, normFace1.y, normFace1.z);

      // Face 2
      mesh.normals.push(normFace2.x, normFace2.y, normFace2.z);
      mesh.normals.push(normFace2.x, normFace2.y, normFace2.z);
      mesh.normals.push(normFace2.x, normFace2.y, normFace2.z);
    }

    for (let v=0; v<6; v++) {
      mesh.colors.push(shell.color.r, shell.color.g, shell.color.b);
    }
      
    if (mesh.uvs) {     
      // Face 1
      mesh.uvs.push(uv2.u, uv2.v);
      mesh.uvs.push(uv1.u, uv1.v);
      mesh.uvs.push(uv0.u, uv0.v);

      // Face 1
      mesh.uvs.push(uv0.u, uv0.v);
      mesh.uvs.push(uv3.u, uv3.v);
      mesh.uvs.push(uv2.u, uv2.v);
    }
    
    if (mesh.data) {
      let data = shell.material.data ?? model.data;
      for (let vertex=0;vertex<6;vertex++) {
        for (let d=0;d<data.length;d++) {
          for (let v=0;v<data[d].values.length;v++) {
            mesh.data[d].values.push(data[d].values[v]);
          }
        }
      }
    }    
  }
  
  static _normalize(v) {
    let l = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
    v.x /= l; 
    v.y /= l; 
    v.z /= l;
    return v;
  } 
  
  static _createColor(col) {
    if (col) {
      return {
        hex: col.toString(),
        r: SVOX.colorManagement ? this._SRGBToLinear(col.r) : col.r,
        g: SVOX.colorManagement ? this._SRGBToLinear(col.g) : col.g,
        b: SVOX.colorManagement ? this._SRGBToLinear(col.b) : col.b
      }
    }
    else
      return undefined;
  }
  
  static _SRGBToLinear(c) {
    return ( c < 0.04045 ) ? c * 0.0773993808 : Math.pow( c * 0.9478672986 + 0.0521327014, 2.4 );
  }  
}

// =====================================================
// ../smoothvoxels/aframe/svoxtothreemeshconverter.js
// =====================================================

class SvoxToThreeMeshConverter {
   
  static generate(model) {

    let materials = [];
    
    model.materials.forEach(function(material) {
      materials.push(SvoxToThreeMeshConverter._generatethreeMaterial(material));
    }, this);

    let geometry = new THREE.BufferGeometry();
    
    // Set the geometry attribute buffers from the model 
    geometry.setAttribute( 'position', new THREE.BufferAttribute(model.positions, 3) );
    geometry.setAttribute( 'normal', new THREE.BufferAttribute(model.normals, 3) );
    if (model.colors)
      geometry.setAttribute( 'color', new THREE.BufferAttribute(model.colors, 3) );
    if (model.uvs)
      geometry.setAttribute( 'uv', new THREE.BufferAttribute(model.uvs, 2) );
    
    if (model.data) {
      for (let d=0; d<model.data.length; d++) {
        geometry.setAttribute( model.data[d].name, new THREE.BufferAttribute(model.data[d].values, model.data[d].width) );
      }
    }
    
    geometry.setIndex(new THREE.BufferAttribute(model.indices, 1));

    // Add the groups for each threeMaterial
    model.groups.forEach(function(group) {
      geometry.addGroup(group.start, group.count, group.materialIndex); 
    }, this);
    
    geometry.computeBoundingBox();
    geometry.uvsNeedUpdate = true;
    
    let mesh = new THREE.Mesh(geometry, materials);
    
    if (SVOX.showNormals && THREE.VertexNormalsHelper) {
      return new THREE.VertexNormalsHelper(mesh, 0.1);
    }
    
    return mesh;
  }

  static _generatethreeMaterial(material) {
    
    // Oculus Go does not support structuredClone
    if (typeof structuredClone === 'function') {
      material = structuredClone(material);
    }
    else {
      material = JSON.parse(JSON.stringify(material));
    } 

    switch(material.side) {
      case 'front':  material.side = THREE.FrontSide;  break;
      case 'back':   material.side = THREE.BackSide;   break;  // Should never occur, faces are reversed instead  
      case 'double': material.side = THREE.DoubleSide; break;    
      default: throw { name: 'RenderError', message: `Unknown side value '${material.side}'.` };
    }   
    
    if (material.shadowSide) {
      switch(material.shadowSide) {
        case 'front':  material.shadowSide = THREE.FrontSide;  break;
        case 'back':   material.shadowSide = THREE.BackSide;   break; 
        case 'double': material.shadowSide = THREE.DoubleSide; break;
        default: throw { name: 'RenderError', message: `Unknown shadowside value '${material.side}'.` };
      }   
    }

    switch(material.combine) {
      case 'multiply': material.combine = THREE.MultiplyOperation; break;    
      case 'mix':      material.combine = THREE.MixOperation;      break;    
      case 'add':      material.combine = THREE.AddOperation;      break;    
      case undefined: break;    
      default: throw { name: 'RenderError', message: `Unknown combine value '${material.combine}'.` };
    }   

    switch(material.blending) {
      case 'no':          material.blending = THREE.NoBlending;          break;    
      case 'normal':      material.blending = THREE.NormalBlending;      break;    
      case 'additive':    material.blending = THREE.AdditiveBlending;    break;    
      case 'subtractive': material.blending = THREE.SubtractiveBlending; break;    
      case 'multiply':    material.blending = THREE.MultiplyBlending;    break;    
      case undefined: break;    
      default: throw { name: 'RenderError', message: `Unknown blending value '${material.blending}'.` };
    }   

    for (const property in material) {
      let value = material[property];
      if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
        material[property] = new THREE.Color(value.r, value.g, value.b);
      }
    }
           
    if (material.normalScale) {
      material.normalScale = new THREE.Vector2(material.normalScale.x, material.normalScale.y);
    }
    
    // Color spaces according to https://threejs.org/docs/#manual/en/introduction/Color-management
    for (const property in material) {
      if (material[property] === undefined) 
        continue;
      
      if (property === 'envMap') {
        material.envMap = new THREE.TextureLoader().load(material.envMap.image);
        material.envMap.colorSpace = THREE.SRGBColorSpace;   
        if (material.ior || material.refractionRatio)
          material.envMap.mapping = THREE.EquirectangularRefractionMapping;
        else
          material.envMap.mapping = THREE.EquirectangularReflectionMapping;
      }
      else if (property === 'matcap') {
        material.matcap = SvoxToThreeMeshConverter._generateTexture(material.matcap.image, THREE.SRGBColorSpace);
      }
      else if ([ 'map', 'emissiveMap', 'specularColorMap' ].includes(property)) {
        material[property] = SvoxToThreeMeshConverter._generateTexture(material[property].image, THREE.SRGBColorSpace, 
                                                                       material[property].uscale, material[property].vscale, 
                                                                       material[property].uoffset, material[property].voffset, 
                                                                       material[property].rotation);
      }
      else if (property.endsWith('Map')) {
        material[property] = SvoxToThreeMeshConverter._generateTexture(material[property].image, THREE.LinearSRGBColorSpace, 
                                                                       material[property].uscale, material[property].vscale, 
                                                                       material[property].uoffset, material[property].voffset, 
                                                                       material[property].rotation);
      }
    }

    let threeMaterial = null;
    let type = material.type;
    delete material.index;
    delete material.type;
    for(const property in material) {
      if (material[property] === undefined || SVOX.MATERIALDEFINITIONS[property] && !SVOX.MATERIALDEFINITIONS[property][type]) {
        delete material[property];
      } 
    }
    
    switch (type) {

      case 'standard':
        threeMaterial = new THREE.MeshStandardMaterial(material); 
        break;        

      case 'basic':
        threeMaterial = new THREE.MeshBasicMaterial(material); 
        break;        

      case 'lambert':
        threeMaterial = new THREE.MeshLambertMaterial(material); 
        break;        

      case 'phong':
        threeMaterial = new THREE.MeshPhongMaterial(material); 
        break;        

      case 'physical':
        threeMaterial = new THREE.MeshPhysicalMaterial(material); 
        break;    
        
      case 'matcap':
        threeMaterial = new THREE.MeshMatcapMaterial(material); 
        break;        

      case 'toon':
        threeMaterial = new THREE.MeshToonMaterial(material); 
        break;        

      case 'normal':
        threeMaterial = new THREE.MeshNormalMaterial(material); 
        break;        

      default: {
        throw {
          name: 'SyntaxError',
          message: `Unknown tmaterial type '${type}'.`
        };            
      }
    }

    return threeMaterial;
  }
  
  static _generateTexture(image, colorSpace, uscale, vscale, uoffset, voffset, rotation) { 
    let threetexture = new THREE.TextureLoader().load( image );
    threetexture.colorSpace = colorSpace;
    threetexture.repeat.set(1 / uscale, 1 / vscale);
    threetexture.wrapS = THREE.RepeatWrapping;
    threetexture.wrapT = THREE.RepeatWrapping;
    threetexture.offset = new THREE.Vector2(uoffset, voffset);
    threetexture.rotation = rotation * Math.PI / 180;
    return threetexture;
  }
  
}

// =====================================================
// ../smoothvoxels/aframe/worker.js
// =====================================================

const workerScript = `

try {
  importScripts('https://cdn.jsdelivr.net/gh/SamuelVanEgmond/Smooth-Voxels@v2.1.0/dist/smoothvoxels.min.js');
}
catch {
  // For local development before the actual release 
  importScripts(location.origin + '/smoothvoxels.js');
}

onmessage = function(event) {
  try {
    let svoxmesh = generateModel(event.data.svoxModel, event.data.modelName);
  
    let transferables = [ svoxmesh.indices.buffer, svoxmesh.positions.buffer, svoxmesh.normals.buffer ];
    if (svoxmesh.colors)
      transferables.push(svoxmesh.colors.buffer);
    if (svoxmesh.uvs)
      transferables.push(svoxmesh.uvs.buffer);
    if (svoxmesh.data) {
      for (let d=0;d<svoxmesh.data.length;d++) {
          let data = svoxmesh.data[d];
          transferables.push(data.values.buffer);
      }
    }

    postMessage( { svoxmesh, elementId:event.data.elementId, worker:event.data.worker } , transferables);
  }
  catch (err) {
    SVOX.logError(err);
  }
};


function generateModel(svoxModel, modelName) {
  let _MISSING = "model size=9,scale=0.05,material lighting=flat,colors=B:#FF8800 C:#FF0000 A:#FFFFFF,voxels 10B7-2(2B2-3C2-2B4-C2-)2B2-3C2-2B7-11B7-B-6(7A2-)7A-B7-2B2-3C2-B-6(7A2-)7A-B2-3C2-2B2-C4-B-2(7A-C7A2C)7A-C7AC-7A-B2-C4-2B2-3C2-B3(-7A-C7AC)-7A-B2-3C2-2B2-C4-B-7A-C2(7AC-7A2C)7AC-7A-B2-C4-2B2-3C2-B-6(7A2-)7A-B2-3C2-2B7-B-6(7A2-)7A-B7-11B7-2(2B2-3C2-2B2-C4-)2B2-3C2-2B7-10B";
  let _ERROR   = "model size=9,scale=0.05,material lighting=flat,colors=A:#FFFFFF B:#FF8800 C:#FF0000,voxels 10B7-2B-C3-C-2B2-C-C2-2B3-C3-2B2-C-C2-2B-C3-C-2B7-11B7-B-6(7A2-)7A-B7-2B-C3-C-B-7A-C7AC-2(7A2-)7A-C7AC-7A-B-C3-C-2B2-C-C2-B-7A2-2(7A-C7AC-)7A2-7A-B2-C-C2-2B3-C3-B-2(7A2-)7A-C7AC-2(7A2-)7A-B3-C3-2B2-C-C2-B-7A2-2(7A-C7AC-)7A2-7A-B2-C-C2-2B-C3-C-B-7A-C7AC-2(7A2-)7A-C7AC-7A-B-C3-C-2B7-B-6(7A2-)7A-B7-11B7-2B-C3-C-2B2-C-C2-2B3-C3-2B2-C-C2-2B-C3-C-2B7-10B";

  let error = undefined;
  if (!svoxModel || svoxModel.trim() === '') {
    error = { name:'ConfigError', message:'Model not found' };
    svoxModel = _MISSING;
  }

  let model = null;
  try {        
      model = ModelReader.readFromString(svoxModel, modelName);
  }
  catch (err) {
    error = err;
    model = ModelReader.readFromString(_ERROR);
  }
  
  let svoxmesh = SvoxMeshGenerator.generate(model, modelName);
  svoxmesh.error = error;
  
  return svoxmesh;
}
`;

var workerUrl = URL.createObjectURL(new Blob([workerScript], {type: 'application/javascript'}));

// =====================================================
// ../smoothvoxels/aframe/workerpool.js
// =====================================================

class WorkerPool {

  // workerfile: e.g. "/smoothvoxelworker.js"
  constructor(workerFile, resultHandler, resultCallback) {
    this._workerFile = workerFile;
    this._resultHandler = resultHandler;
    this._resultCallback = resultCallback;
    this._nrOfWorkers = window.navigator.hardwareConcurrency;
    this._workers = []; // The actual workers
    this._free = [];    // Array of free worker indexes
    this._tasks = [];   // Array of tasks to perform
  }

  executeTask(task) {
    // Create max nrOfWorkers web workers
    if (this._workers.length < this._nrOfWorkers) {
      
      // Create a new worker and mark it as free by adding its index to the free array
      let worker = new Worker(this._workerFile);
      
      // On message handler
      let _this = this;
      worker.onmessage = function(task) {
        
          // Mark the worker as free again, process the next task and process the result
          _this._free.push(event.data.worker);        
          _this._processNextTask();
          _this._resultCallback.apply(_this._resultHandler, [ event.data ]);
      };
      
      this._free.push(this._workers.length);
      this._workers.push(worker);
    }
    
    this._tasks.push(task);
    
    this._processNextTask();    
  }
  
  _processNextTask() {
    if (this._tasks.length > 0 && this._free.length > 0) {
      let task = this._tasks.shift();
      task.worker = this._free.shift();
      let worker = this._workers[task.worker];
      worker.postMessage(task);
    }    
  }

};

// =====================================================
// ../smoothvoxels/aframe/smoothvoxels.js
// =====================================================

// We are combining this file with others in the minified version that will be used also in the worker.
// Do not register the svox component inside the worker
if("undefined"!==typeof window) {

if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

SVOX.WORKERPOOL = null;

/**
 * Smooth Voxels component for A-Frame.
 */
AFRAME.registerComponent('svox', {
  schema: {
    model: { type:"string" }, 
    worker: { type:"boolean", default:false }
  },

  /**
   * Set if component needs multiple instancing.
   */
  multiple: false,

  _ERROR: `model size=9,scale=0.05
light intensity=0.8
light direction=1 1 0,intensity=0.4
material type=basic,lighting=flat,colors=A:#FFF B:#F80,ao=0.1 0.5
group id=cross,prefab=true,scale= 1 0.5 1
material type=basic,lighting=flat,colors=C:#F00,group=cross
group id=nx, clone=cross,rotation=0 45 90,position=-4 0 0
group id=px, clone=cross,rotation=0 45 90,position=4 0 0
group id=ny, clone=cross,rotation=0 45 0,position=0 -4 0
group id=py, clone=cross,rotation=0 45 0,position=0 4 0
group id=nz, clone=cross,rotation=90 0 45,position=0 0 -4
group id=pz, clone=cross,rotation=90 0 45,position=0 0 4
voxels 10B6(7-2B)7-11B7-B-6(7A2-)7A-B7-2(2B7-B-6(7A2-)7A-B3-C3-)2B7-B-6(7A2-)7A-B-5C-2(2B7-B-6(7A2-)7A-B3-C3-)2B7-B-6(7A2-)7A-B7-11B6(7-2B)7-10B`,

  _MISSING: `model size=9 10 9,scale=0.05
light intensity=0.8
light direction=1 1 0,intensity=0.4
material type=basic,lighting=flat,colors=A:#FFF B:#F80,ao=0.1 0.5
group id=questionmark,prefab=true,scale=0.5 0.5 0.6
material type=basic,lighting=both,colors=C:#F00,deform=1,clamp=y,group=questionmark
group id=nx,clone=questionmark,rotation=0 -90 90,position=-4 0 0
group id=px,clone=questionmark,rotation=0 90 -90,position=4 0 0
group id=ny,clone=questionmark,rotation=180 0 0,position=0 -4 0
group id=py,clone=questionmark,rotation=0 0 0,position=0 4 0
group id=nz,clone=questionmark,rotation=90 180 0,position=0 0 -4
group id=pz,clone=questionmark,rotation=90 0 0,position=0 0 4
voxels 10B6(7-2B)7-10B2-4C3-2(B7-B-6(7A2-)7A-B7-B-2(2C2-))B7-B-6(7A2-)7A-B7-B4-2C3-2(B7-B-6(7A2-)7A-B7-B3-2C4-)B7-B-6(7A2-)7A-B7-B9-B7-B-6(7A2-)7A-B7-B3-2C4-10B6(7-2B)7-10B3-2C4-`,
  
  _workerPool: null,
  
  /**
   * Called once when component is attached. Generally for initial setup.
   */
  init: function () { 
    let el = this.el;
    let data = this.data;
    let useWorker = data.worker;
    let error = false;
    
    let modelName = data.model;
    let modelString = SVOX.models[modelName];
    if (!modelString) {
      SVOX.logError({ name:'ConfigError', message:`(${modelName}) Model ${modelName} not found`});
      modelString = this._MISSING;
      modelName ='_MISSING';
      error = true;
      useWorker = false;
    }

    if (!useWorker) {
      this._generateModel(modelString, modelName, el, error);
    }
    else {
      this._generateModelInWorker(modelString, modelName, el);
    }
  },
  
  _generateModel: function(modelString, modelName, el, error) {
    let t0 = performance.now();

    let model;
    try {        
        model = ModelReader.readFromString(modelString, modelName);
    }
    catch (ex) {
      SVOX.logError(ex);
      model = ModelReader.readFromString(this._ERROR, '_ERROR');
      error = true;
    }
    
    try {        
        //let meshGenerator = new MeshGenerator();
        //this.mesh = meshGenerator.generate(model);
    
        let svoxmesh = SvoxMeshGenerator.generate(model);
        this.mesh = SvoxToThreeMeshConverter.generate(svoxmesh);
      
        // Log stats
        let t1 = performance.now();
        let statsText = `Voxels: ${model.voxels.count}  Time: ${Math.round(t1 - t0)/1000}s. Verts:${(svoxmesh.positions.length / 3).toLocaleString()} Faces:${(svoxmesh.indices.length / 3).toLocaleString()} Materials:${this.mesh.material.length}`;
        //console.log(`SVOX ${this.data.model}:  ${statsText}`);     
        let statsEl = document.getElementById('svoxstats');
        if (statsEl && !error)
          statsEl.innerHTML = `Last render: ` + statsText; 
      
        el.setObject3D('mesh', this.mesh);
    }
    catch (error) {
      SVOX.logError(error);
    }    
  },
  
  _generateModelInWorker: function(modelString, modelName, el) {
    // Make sure the element has an Id, create a task in the task array and process it
    if (!el.id)
      el.id = new Date().valueOf().toString(36) + Math.random().toString(36).substr(2);
    let task =  { svoxModel: modelString, modelName, elementId:el.id };    
    
    if (!SVOX.WORKERPOOL) {
      SVOX.WORKERPOOL = new WorkerPool(workerUrl, this, this._processResult);
    }
    SVOX.WORKERPOOL.executeTask(task);
  },
  
  _processResult: function(data) {
    if (data.svoxmesh.error) {
      SVOX.logError(data.svoxmesh.error)
    }
    else {
      let mesh = SvoxToThreeMeshConverter.generate(data.svoxmesh);
      let el = document.querySelector('#' + data.elementId);

      el.setObject3D('mesh', mesh);          
    }
  },
  
  _toSharedArrayBuffer(floatArray) {
    let buffer = new Float32Array(new ArrayBuffer(floatArray.length * 4));
    buffer.set(floatArray, 0);
    return buffer;
  },
  
  /**
   * Called when component is attached and when component data changes.
   * Generally modifies the entity based on the data.
   * NOT SUPPORTED BY THIS COMPONENT
   * @param {object} oldData The previous version of the data
   */
  update: function (oldData) { },

  /**
   * Called when a component is removed (e.g., via removeAttribute).
   */
  remove: function () { 
    let maps = ["map", "normalMap",  "roughnessMap", "metalnessMap", "emissiveMap", "matcap"];

    if (this.mesh) {                 // TODO: Test
      if (Array.isArray(this.mesh.material)) {

        // Multiple materials
        while (this.mesh.material.length > 0) {
          
           maps.forEach(function(map){
            if (this.mesh.material[0][map]) {
              this.mesh.material[0][map].dispose;
            }
          }, this);

          this.mesh.material[0].dispose();
          this.mesh.material.shift();
        }
      }
      else {
        
        // Single material
        this.mesh.material.dispose();
      }
      
      this.mesh.geometry.dispose();
      this.el.removeObject3D('mesh');
      delete this.mesh;      
    }
  },
  
  /**
   * Called on each scene tick.
   */
  // tick: function (t) { },

  /**
   * Called when entity pauses.
   * Use to stop or remove any dynamic or background behavior such as events.
   */
  pause: function () { },

  /**
   * Called when entity resumes.
   * Use to continue or add any dynamic or background behavior such as events.
   */
  play: function () { },

  /**
   * Event handlers that automatically get attached or detached based on scene state.
   */
  events: {
    // click: function (evt) { }
  }
});

}
