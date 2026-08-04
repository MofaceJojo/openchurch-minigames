/* Holy Bubbles · WebAudio 音频引擎
   - BGM：基于 audio-data.js 合成（无外部文件、无版权）
   - SFX：程序化合成（放泡、爆炸、戳破/净化、道具、死亡、胜利）
   - 统一静音控制、首次用户手势解锁
*/

"use strict";

var Sfx = (function(){
  var actx = null;
  var masterGain = null;
  var muted = false;
  var bgmNode = null;       // 当前 BGM 循环源节点数组
  var bgmScheduleTimer = null;
  var nextLoopTime = 0;
  var loopDuration = 0;
  var unlocked = false;

  // ========== 基础设施 ==========
  function ensureCtx(){
    if(!actx){
      actx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = actx.createGain();
      masterGain.connect(actx.destination);
      masterGain.gain.value = 0.6;
    }
    if(actx.state === "suspended") actx.resume();
    return actx;
  }

  function unlock(){
    if(unlocked) return;
    ensureCtx();
    if(actx.state === "suspended") actx.resume();
    unlocked = true;
  }

  // 绑定首次手势解锁
  function bindUnlock(){
    ["pointerdown","keydown","touchstart"].forEach(function(evt){
      window.addEventListener(evt, unlock, {once:true, passive:true});
    });
  }
  bindUnlock();

  function setMuted(m){
    muted = !!m;
    if(masterGain) masterGain.gain.value = muted ? 0 : 0.6;
  }
  function isMuted(){ return muted; }

  // ========== 合成器工具 ==========
  function createOsc(type, freq, gainVal, startTime, endTime, params){
    var ctx = ensureCtx();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(masterGain);

    var a = params.attack || 0.01;
    var d = params.decay || 0.1;
    var s = params.sustain !== undefined ? params.sustain : 0.3;
    var r = params.release || 0.2;
    var peak = gainVal || 0.3;
    var t = startTime || ctx.currentTime;
    var dur = (endTime ? endTime - t : (a+d+r));

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + a);
    gain.gain.linearRampToValueAtTime(peak * s, t + a + d);
    gain.gain.linearRampToValueAtTime(0, t + a + d + r);

    osc.start(t);
    osc.stop(t + a + d + r + 0.02);
    return osc;
  }

  function freqFromMidi(midi){ return 440 * Math.pow(2, (midi - 69) / 12); }

  // 合成复合音色（基频 + 泛音）
  function playNote(instDef, midi, time, dur, vel){
    var ctx = ensureCtx();
    var baseFreq = freqFromMidi(midi);
    var harm = instDef.harm || [1];
    var gainVal = (instDef.gain || 0.2) * (vel || 1);
    var oscNodes = [];
    harm.forEach(function(h, idx){
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = instDef.type || "sine";
      osc.frequency.value = baseFreq * h;
      osc.connect(gain);
      gain.connect(masterGain);
      var g = gainVal / (idx + 1); // 泛音递减
      var a = instDef.attack || 0.01;
      var d = instDef.decay || 0.2;
      var s = instDef.sustain !== undefined ? instDef.sustain : 0.2;
      var r = instDef.release || 0.3;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(g, time + a);
      gain.gain.linearRampToValueAtTime(g * s, time + a + d);
      gain.gain.linearRampToValueAtTime(0, time + a + d + r);
      osc.start(time);
      osc.stop(time + a + d + r + 0.02);
      oscNodes.push(osc);
    });
    return oscNodes;
  }

  // 器乐音色定义（与 audio-data.js 对应）
  var INST_DEF = (typeof AudioData!=="undefined" && AudioData.INST) ? AudioData.INST : {
    bell:   { type:"sine",   harm:[1, 2.5, 4],   gain:0.18, attack:0.005, decay:0.35, sustain:0.15, release:0.8 },
    synth:  { type:"square", harm:[1, 3, 5],    gain:0.12, attack:0.01,  decay:0.2,  sustain:0.3,  release:0.25 },
    bass:   { type:"triangle",harm:[1, 2],      gain:0.22, attack:0.02,  decay:0.15, sustain:0.4,  release:0.3 },
    perc:   { type:"noise",  gain:0.1,  attack:0.001, decay:0.08, sustain:0, release:0.1 },
    chime:  { type:"sine",   harm:[1, 2, 3, 4, 5, 6], gain:0.15, attack:0.003, decay:0.4, sustain:0.1, release:1.2 }
  };

  // ========== BGM 调度 ==========
  function scheduleBgm(){
    if(muted || !AudioData) return;
    var ctx = ensureCtx();
    var now = ctx.currentTime;
    var beat = AudioData.BEAT;
    var swing = AudioData.SWING;
    var loopSec = AudioData.LOOP_SEC;

    // 如果已经在调度中，延续
    if(nextLoopTime === 0) nextLoopTime = now + 0.05; // 稍微延后开始

    function scheduleOneLoop(startTime){
      AudioData.tracks.forEach(function(tr){
        var inst = INST_DEF[tr.inst];
        if(!inst) return;
        tr.notes.forEach(function(note){
          var t = startTime + note.time * beat;
          // 轻微摇摆：偶数拍稍微推后
          if(swing > 0 && Math.abs((note.time % 1) - 0.5) < 0.01) t += swing * beat * 0.5;
          if(Array.isArray(note.pitch)){
            // 和弦
            note.pitch.forEach(function(p, idx){
              playNote(inst, p, t, note.dur * beat, (note.vel || 1) * 0.9);
            });
          }else{
            playNote(inst, note.pitch, t, note.dur * beat, note.vel || 1);
          }
        });
      });
    }

    // 当前循环
    scheduleOneLoop(nextLoopTime);
    nextLoopTime += loopSec;

    // 设置下一循环定时器（提前 100ms 调度）
    if(bgmScheduleTimer) clearTimeout(bgmScheduleTimer);
    bgmScheduleTimer = setTimeout(function(){
      if(!muted) scheduleBgm();
    }, (nextLoopTime - ctx.currentTime - 0.1) * 1000);
  }

  function startBgm(){
    if(muted) return;
    nextLoopTime = 0;
    scheduleBgm();
  }

  function stopBgm(){
    if(bgmScheduleTimer){ clearTimeout(bgmScheduleTimer); bgmScheduleTimer = null; }
    nextLoopTime = 0;
  }

  // ========== SFX 合成 ==========
  // 放圣泡：短促「啵」声
  function sfx_place(){
    if(muted) return;
    var ctx = ensureCtx(), t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + 0.2);
  }

  // 爆炸/圣光：「噗嗤」+ 宽频脉冲
  function sfx_pop(){
    if(muted) return;
    var ctx = ensureCtx(), t = ctx.currentTime;
    // 低频脉冲
    var osc1 = ctx.createOscillator();
    var gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(180, t);
    osc1.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    gain1.gain.setValueAtTime(0.35, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc1.connect(gain1); gain1.connect(masterGain);
    osc1.start(t); osc1.stop(t + 0.4);

    // 高频嘶嘶（白噪声滤波）
    var bufferSize = ctx.sampleRate * 0.3;
    var noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for(var i=0;i<bufferSize;i++) data[i] = Math.random()*2-1;
    var noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    var filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(8000, t + 0.2);
    var gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.18, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise.connect(filter); filter.connect(gain2); gain2.connect(masterGain);
    noise.start(t); noise.stop(t + 0.35);

    // 铃铛点缀
    playNote(INST_DEF.chime, 88, t + 0.02, 0.15, 0.6);
    playNote(INST_DEF.chime, 92, t + 0.06, 0.15, 0.5);
  }

  // 戳破/净化：清亮上行琶音 + 闪光感
  function sfx_absolve(){
    if(muted) return;
    var ctx = ensureCtx(), t = ctx.currentTime;
    var notes = [76, 79, 83, 88, 92]; // E5 G5 B5 E6 G#6
    notes.forEach(function(n, i){
      playNote(INST_DEF.chime, n, t + i * 0.04, 0.35, 0.7 * (1 - i*0.12));
    });
    // 闪光高频
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(2400, t + 0.4);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + 0.55);
  }

  // 道具拾取：上行滑音
  function sfx_chime(){
    if(muted) return;
    var ctx = ensureCtx(), t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.18);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + 0.3);
  }

  // 死亡：下行滑音 + 闷响
  function sfx_die(){
    if(muted) return;
    var ctx = ensureCtx(), t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.4);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + 0.55);
    // 低频闷响
    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.value = 80;
    gain2.gain.setValueAtTime(0.25, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(gain2); gain2.connect(masterGain);
    osc2.start(t); osc2.stop(t + 0.4);
  }

  // 过关/胜利：大调琶音
  function sfx_clear(){
    if(muted) return;
    var ctx = ensureCtx(), t = ctx.currentTime;
    var notes = [72, 76, 79, 84, 88, 92]; // C5 E5 G5 C6 E6 G#6
    notes.forEach(function(n, i){
      playNote(INST_DEF.bell, n, t + i * 0.07, 0.45, 0.8 * (1 - i*0.1));
    });
  }
  function sfx_win(){
    if(muted) return;
    var ctx = ensureCtx(), t = ctx.currentTime;
    // 更丰富的胜利乐句
    var phrase = [
      {n:72, d:0.2}, {n:76, d:0.2}, {n:79, d:0.2}, {n:84, d:0.4},
      {n:79, d:0.2}, {n:84, d:0.2}, {n:88, d:0.2}, {n:92, d:0.6},
      {n:96, d:0.8}
    ];
    phrase.forEach(function(p, i){
      var start = t + i * 0.12;
      playNote(INST_DEF.bell, p.n, start, p.d, 0.9);
      playNote(INST_DEF.chime, p.n + 12, start + 0.01, p.d * 0.8, 0.5);
    });
  }

  // 统一播放入口（core.js 传来的声音名）
  function play(name){
    if(muted) return;
    switch(name){
      case "place":  sfx_place(); break;
      case "pop":    sfx_pop(); break;
      case "absolve": sfx_absolve(); break;
      case "chime":  sfx_chime(); break;
      case "die":    sfx_die(); break;
      case "clear":  sfx_clear(); break;
      case "win":    sfx_win(); break;
      default: console.warn("Sfx: unknown sound", name);
    }
  }

  // 批量播放（core.js 每帧推送 sounds 数组）
  function playAll(names){
    if(muted || !names || !names.length) return;
    names.forEach(play);
  }

  return {
    init: unlock,
    setMuted: setMuted,
    isMuted: isMuted,
    play: play,
    playAll: playAll,
    startBgm: startBgm,
    stopBgm: stopBgm
  };
})();

if(typeof module!=="undefined") module.exports = Sfx;