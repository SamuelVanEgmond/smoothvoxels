# Smooth Voxels

![Gallery](https://github.com/SamuelVanEgmond/smoothvoxels/assets/95985602/5bf248cb-726e-4490-b2fd-2305f4fac160)

Are you a developer and not a 3D designer with crazy (or any) Blender skills? But you would still like to create your own 3D models, for instance for a great little WebXR game? Then Smooth Voxels is for you!

Smooth Voxels allows you to turn voxel models into low poly style or smooth organic looking models, even mixing styles in one model.

Smooth Voxels uses vertex averaging to produce a much smoother appearance than for instance marching cubes, as seen in this 7x7x7(!) voxel apple.

![AppleSmall](https://github.com/SamuelVanEgmond/smoothvoxels/assets/95985602/7d815f6f-a2f1-4964-8e78-4446f2a0e3f5)

Smooth Voxel models can be created in the Smooth Voxel Playground and exported to .glTF or .glb, or generated at runtime using the Open Source Library.

Extensive documentation can be found at [smoothvoxels.glitch.me](https://smoothvoxels.glitch.me/).

Or just check [the cheat sheet](https://smoothvoxels.glitch.me/cheatsheet.html).

But the best way to see what you can do is browsing and changing the examples on [The Smooth Voxel Playground](https://smoothvoxels.glitch.me/playground.html).

Note that this project lives at [glitch.com](https://www.glitch.com), GitHub contains the distribution, which can be linked from jsDelivr as shown below.

Refer to the [Smooth Voxels Examples](https://smoothvoxels-examples.glitch.me/) for full examples in A-Frame and Three.js.

**Including Smooth Voxels into A-Frame**
~~~~
<!-- Include the A-Frame and Smooth Voxels scripts -->
<script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/SamuelVanEgmond/Smooth-Voxels@v2.3.0/dist/smoothvoxels.min.js"></script>
~~~~

**Including Smooth Voxels into Three.js**
~~~~
<script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.min.js"
    }
  }
</script>

<!-- Include the Smooth Voxels script -->
<script src="https://cdn.jsdelivr.net/gh/SamuelVanEgmond/Smooth-Voxels@v2.3.0/dist/smoothvoxels.threejs.min.js"></script>

<script type="module">
  import * as THREE from 'three';

  // Ensure THREE is available for Smooth Voxels
  window.THREE = THREE;

  ...
~~~~

You can find [the release notes here](https://smoothvoxels.glitch.me/#ReleaseNotes).

Samuel van Egmond 
