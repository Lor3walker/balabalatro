/* 低频漩涡背景。WebGL 不可用时保留 CSS 毛毡桌面。 */
(function (BT) {
  'use strict';
  var gl, program, time, resolution, canvas;
  function init(el) {
    canvas = el; gl = el.getContext('webgl', { alpha: true, antialias: false }); if (!gl) return;
    function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('背景着色器编译失败'); return s; }
    try {
      program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, 'precision mediump float;uniform vec2 res;uniform float t;void main(){vec2 p=(gl_FragCoord.xy-.5*res)/res.y;float r=length(p);float a=atan(p.y,p.x)+r*4.-t*.04;float v=sin(a*3.+sin(r*7.-t*.09)*2.)*.5+.5;vec3 c=mix(vec3(.035,.13,.14),vec3(.09,.25,.23),v);c+=vec3(.07,.035,.005)*pow(v,9.);c*=1.-r*.4;gl_FragColor=vec4(c,1.);}'));
      gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('背景着色器链接失败'); gl.useProgram(program);
      var buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      time = gl.getUniformLocation(program, 't'); resolution = gl.getUniformLocation(program, 'res');
    } catch (e) { console.warn(e.message); gl = null; }
  }
  function frame(seconds, reduced) {
    if (!gl) return;
    var w = Math.round(canvas.clientWidth * 0.75), h = Math.round(canvas.clientHeight * 0.75);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(resolution, w, h); gl.uniform1f(time, reduced ? 0 : seconds); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  BT.Background = { init: init, frame: frame };
})(window.BT);
