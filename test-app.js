const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

(async () => {
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

    // Execute bundle in the JSDOM context
    dom.window.eval(bundleCode);

    // Wait a bit for React to render
    await new Promise(r => setTimeout(r, 500));

    console.log('✅ App loaded successfully without errors!');
    console.log('\nPage structure:');
    console.log('Root element:', dom.window.document.getElementById('root'));

  } catch (error) {
    console.error('\n❌ ERROR ENCOUNTERED:');
    console.error('Type:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);

    // Try to extract what variable caused the issue
    if (error.message.includes('Cannot access')) {
      const match = error.message.match(/Cannot access '([^']+)' before initialization/);
      if (match) {
        console.error(`\n🔴 TEMPORAL DEAD ZONE ERROR`);
        console.error(`Variable: ${match[1]}`);
        console.error('This means a const/let was accessed before its declaration.');
      }
    }
  }
})();
