const { JSDOM } = require('jsdom');
const React = require('react');
const ReactDOM = require('react-dom/server');

// Set up DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock Three.js
global.THREE = {
  Scene: class {},
  PerspectiveCamera: class {},
  WebGLRenderer: class {},
  Mesh: class {},
  BufferGeometry: class {},
  MeshPhongMaterial: class {},
  PointLight: class {},
  AmbientLight: class {},
  Vector3: class {},
  Raycaster: class {},
  Clock: class {},
};

// Load and render the app
try {
  console.log('Loading bundle...');
  const bundle = require('./dist/bundle.js');
  console.log('Bundle loaded successfully');

  // Try to render (this will catch errors)
  console.log('Attempting to render app...');
  // The bundle should have mounted the app

} catch (error) {
  console.error('ERROR CAUGHT:');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);

  if (error.message.includes('Cannot access')) {
    console.error('\n🔴 TDZ ERROR DETECTED');
    const match = error.message.match(/Cannot access '([^']+)'/);
    if (match) {
      console.error(`Variable that caused error: ${match[1]}`);
    }
  }
}
