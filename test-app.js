const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

(async () => {
  let errorCaught = false;
  let errorMessage = '';

  try {
    console.log('Setting up JSDOM...');

    // Read the HTML file
    const htmlPath = path.join(__dirname, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Create DOM with pre-loaded bundle to avoid network requests
    const dom = new JSDOM(html, {
      url: 'http://localhost:3000/',
      pretendToBeVisualMedia: true,
      resources: 'usable',
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;

    // Capture all errors
    let allErrors = [];
    const originalError = console.error;
    console.error = (...args) => {
      allErrors.push(args.join(' '));
      originalError.call(console, ...args);
    };

    // Mock THREE.js globally
    global.THREE = {
      Scene: class Scene {},
      PerspectiveCamera: class PerspectiveCamera { constructor() {} },
      WebGLRenderer: class WebGLRenderer { constructor() { this.domElement = document.createElement('canvas'); } setSize() {} render() {} dispose() {} },
      Mesh: class Mesh {},
      BufferGeometry: class BufferGeometry {},
      MeshPhongMaterial: class MeshPhongMaterial {},
      PointLight: class PointLight {},
      AmbientLight: class AmbientLight {},
      Vector3: class Vector3 {},
      Raycaster: class Raycaster {},
      Clock: class Clock {},
      Color: class Color { constructor(c) { this.hex = c || 0xffffff; } },
      Object3D: class Object3D { add() {} remove() {} },
      Group: class Group { add() {} remove() {} },
      InstancedBufferGeometry: class InstancedBufferGeometry {},
      ShaderMaterial: class ShaderMaterial {},
      InstancedMesh: class InstancedMesh {},
      Sphere: class Sphere {},
      Box3: class Box3 {},
      Matrix4: class Matrix4 {},
      Quaternion: class Quaternion {},
    };

    // Load bundle directly into the window
    console.log('Loading bundle into JSDOM...');
    const bundlePath = path.join(__dirname, 'bundle.js');
    const bundleCode = fs.readFileSync(bundlePath, 'utf8');

    // Execute bundle in the JSDOM context with error catching
    try {
      dom.window.eval(bundleCode);
    } catch (e) {
      errorCaught = true;
      errorMessage = e.message;
      console.error('\n❌ SYNC ERROR DURING BUNDLE LOAD:');
      console.error('Message:', e.message);
      console.error('Stack:', e.stack);
    }

    // Wait for async rendering to complete
    console.log('Waiting for async rendering...');
    await new Promise(r => setTimeout(r, 2000));

    if (errorCaught) {
      console.error('\n🔴 TEMPORAL DEAD ZONE ERROR');
      const match = errorMessage.match(/Cannot access '([^']+)'/);
      if (match) {
        console.error(`Variable: ${match[1]}`);
      }
      process.exit(1);
    }

    if (allErrors.length > 0) {
      console.error('\n❌ ERRORS DURING RENDERING:');
      allErrors.forEach(err => {
        if (err.includes('Cannot access')) {
          console.error(err);
          const match = err.match(/Cannot access '([^']+)'/);
          if (match) {
            console.error(`\n🔴 Variable causing TDZ error: ${match[1]}`);
          }
        }
      });
      process.exit(1);
    }

    console.log('\n✅ App loaded and rendered successfully without errors!');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();
