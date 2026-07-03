export const vsSource = `#version 300 es
  in vec3 aPosition;
  in vec3 aColor;
  uniform mat4 uMatrix;
  uniform float uYScale;
  out vec3 vColor;
  void main() {
    vec3 updatedPos = vec3(aPosition.x, aPosition.y * uYScale, aPosition.z);
    gl_Position = uMatrix * vec4(updatedPos, 1.0);
    vColor = aColor;
  }
`;

export const fsSource = `#version 300 es
  precision highp float;
  in vec3 vColor;
  out vec4 fragColor;
  void main() { fragColor = vec4(vColor, 1.0); }
`;

export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}
