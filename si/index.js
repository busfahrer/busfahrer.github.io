
import init, { Emu } from "./build/emu8080_wasm.js";
console.log("XXX trigger init");
await init();
const emu = Emu.new();
emu.load_prog(invaders, 0x0);

const WIDTH = 224;
const HEIGHT = 256;

const backgroundColor = 0xFF000000;

let x = 0;
let y = 0;

let KEYS = Array.from([
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
]);

let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d');
let imagedata = context.createImageData(WIDTH, HEIGHT);

let bufarray = new ArrayBuffer(WIDTH * HEIGHT * 4);
let buf8     = new Uint8Array(bufarray);
let buf32    = new Uint32Array(bufarray);

const clear = color => { for (var i = 0; i < buf32.length; i++) buf32[i] = color || backgroundColor; };
const flip = () => { imagedata.data.set(buf8); context.putImageData(imagedata, 0, 0); }
const flipbuf = (buf) => { imagedata.data.set(buf); context.putImageData(imagedata, 0, 0); }
const setPixel = (x, y, color) => buf32[y * WIDTH + x] = color;


function getCursorPosition(event) {
  const rect = canvas.getBoundingClientRect()
  const x0 = event.clientX - rect.left
  const y0 = event.clientY - rect.top
  const w = rect.width;
  const h = rect.height;
  const x = (x0 / w) * 224;
  const y = (y0 / h) * 256;

  console.log(x, y);

  return { x, y };
}


function handleClick(e, val) {
  const { x, y } = getCursorPosition(e);
  if (y > 240) {
    emu.coin_switch(val);
    emu.p1shot(val);
  }
}

function pulseKey(fn) {
    fn(true);
    setTimeout(() => fn(false), 20);
}

function hasTouch(e, fn) {
  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i];
    const { x, y } = getCursorPosition(touch);
    if (fn(x, y)) {
      return true;
    }
  }

  return false;
}

const hasLeftTouch = e => hasTouch(e, (x, y) => (y < 240 && x < 74));
const hasRightTouch = e => hasTouch(e, (x, y) => (y < 240 && x > 148));
const hasCenterTouch = e => hasTouch(e, (x, y) => (y < 240 && x > 74 && x < 148));
const hasBarTouch = e => hasTouch(e, (x, y) => (y > 240));

//document.body.addEventListener('touchstart', (e) => { console.warn(">>> body click"); pulseKey(emu.p1shot.bind(emu)); });

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  console.log("> start");
  //e.preventDefault();
  console.log("touchstart", e)
  const touchCount = e.touches.length;
  console.log("touchstart l", touchCount)
  const { x, y } = getCursorPosition(e.touches[0]);
  console.log("touchstart", x, y);

  if (hasLeftTouch(e)) { emu.p1left(true); pulseKey(emu.p1start.bind(emu)); }
  if (hasRightTouch(e)) { emu.p1right(true); pulseKey(emu.p1start.bind(emu)); }
  if (hasBarTouch(e)) { pulseKey(emu.coin_switch.bind(emu)); pulseKey(emu.p1shot.bind(emu)); }
  if (hasCenterTouch(e)) { pulseKey(emu.p1start.bind(emu)); pulseKey(emu.p1shot.bind(emu)); }
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  console.log("> end");
  //e.preventDefault();
  const touchCount = e.touches.length;
  console.log("touchend", touchCount);
  if (!hasLeftTouch(e)) { emu.p1left(false); }
  if (!hasRightTouch(e)) { emu.p1right(false); } });
canvas.addEventListener('mousedown', function(e) {
  const { x, y } = getCursorPosition(e);
  //if (x > 112) {
    //emu.p1right(true);
  //} else {
    //emu.p1left(true);
  //}
});

canvas.addEventListener('mouseup', function(e) {
  const { x, y } = getCursorPosition(e);
  if (y < 240) {
    if (x > 112) {
      emu.p1right(false);
    } else {
      emu.p1left(false);
    }
  }
});

canvas.addEventListener('click', function(e) {
  const { x, y } = getCursorPosition(e);
  if (y > 240) {
    pulseKey(emu.coin_switch.bind(emu));
    pulseKey(emu.p1shot.bind(emu));
  } else {
    pulseKey(emu.p1start.bind(emu));
  }
});

function handleKey(key, val) {
  switch (key) {
    case 'c': return emu.coin_switch(val);
    case 'Enter': return emu.coin_switch(val);
    case 'a': return emu.p1left(val);
    case 'ArrowLeft': return emu.p1left(val);
    case 'd': return emu.p1right(val);
    case 'ArrowRight': return emu.p1right(val);
    case 'w': return emu.p1shot(val);
    case ' ': return emu.p1shot(val);
    case 'Shift': return emu.p1shot(val);
    case '1': return emu.p1start(val);
    case 's': return emu.p1start(val);
  }
}

document.onkeydown = (e) => { const mappedKey = handleKey(e.key, true); }
document.onkeyup = (e) => { const mappedKey = handleKey(e.key, false); }

let frames = 0;

function draw() {
  //emu.reset_keys();
  KEYS.forEach((v, idx) => {
    //if (v) { emu.set_key(idx); }
  });
  x += 1;
  frames++;
  clear();
  //for (let i = 0; i < CYCLES_PER_FRAME; i++) {
  //emu.process_cycle();
  //}
  //emu.process_timers();
  //const fb = emu.get_framebuf();
  emu.run_cycles(16667);
  emu.try_fire_interrupt(0x1);
  emu.run_cycles(16667);
  emu.try_fire_interrupt(0x2);
  //emu.render();
  //let framebuf = emu.get_framebuf();
  //render(&emu, &mut canvas, &framebuf);
  const fb = emu.get_framebuf();
  //console.log("fb is", fb);

  clear();
  for (let off = 0; off < WIDTH*HEIGHT; off++) {
    if (fb[off]) {
      //console.log("XXJS", fb[off].toString(16));
      buf32[off] = fb[off];
    }
  }
  flip();
  requestAnimationFrame(draw);
};

draw();

window.setInterval(function(){
  console.log("frames:", frames);
  frames = 0;
}, 1000);
